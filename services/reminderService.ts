import { CalendarItem, ReminderItem, ReminderStatus } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_TIMEZONE, createReminderFromItem, canTransitionReminderStatus } from '../utils/reminderUtils';

const LOCAL_REMINDERS_KEY = 'we_agenda_reminders_v1';
const DELIVERED_CACHE_KEY = 'we_agenda_delivered_reminders_cache';

/**
 * Obtém o status atual da permissão de notificações do navegador
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Solicita permissão ao usuário para disparar notificações no sistema
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Erro ao solicitar permissão de notificação:', err);
    return 'denied';
  }
}

/**
 * Registra o Service Worker para habilitar notificações e suporte offline
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('Registro de Service Worker falhou (esperado em ambiente local ou sem SSL):', err);
    return null;
  }
}

/**
 * Carrega a lista de lembretes armazenados localmente
 */
export function getLocalReminders(): ReminderItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persiste a lista de lembretes localmente
 */
export function saveLocalReminders(reminders: ReminderItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(reminders));
  } catch (e) {
    console.warn('Falha ao salvar lembretes locais:', e);
  }
}

/**
 * Sincroniza e reconcilia a fila de lembretes com a lista de itens da agenda
 */
export async function reconcileReminders(
  items: CalendarItem[],
  userId?: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<ReminderItem[]> {
  const existingReminders = getLocalReminders();
  const existingByItemId = new Map<string, ReminderItem>();
  for (const r of existingReminders) {
    existingByItemId.set(r.itemId, r);
  }

  const updatedReminders: ReminderItem[] = [];
  const currentItemIds = new Set<string>();

  for (const item of items) {
    currentItemIds.add(item.id);

    // Se o item tem lembrete ativo (alertMinutes > 0 e não está pago)
    if (item.alertMinutes && item.alertMinutes > 0 && !item.isPaid) {
      const existing = existingByItemId.get(item.id);
      
      // Se já foi entregue ou dispensado, manter o estado
      if (existing && (existing.status === 'delivered' || existing.status === 'dismissed')) {
        updatedReminders.push(existing);
        continue;
      }

      const generated = createReminderFromItem(item, userId, userTimezone);
      if (generated) {
        if (existing) {
          // Preserva status e atualiza horário caso tenha mudado
          updatedReminders.push({
            ...generated,
            status: existing.status,
            id: existing.id
          });
        } else {
          updatedReminders.push(generated);
        }
      }
    }
  }

  // Salvar localmente
  saveLocalReminders(updatedReminders);

  // Se o Supabase estiver configurado e o usuário logado, sincronizar com a nuvem
  if (isSupabaseConfigured() && supabase && userId) {
    try {
      // 1. Inserir/atualizar lembretes agendados
      for (const rem of updatedReminders) {
        if (rem.status === 'scheduled') {
          await supabase.from('reminders').upsert({
            id: rem.id.length === 36 ? rem.id : undefined, // se for uuid válido
            user_id: userId,
            item_id: rem.itemId,
            channel: rem.channel,
            scheduled_at: rem.scheduledAt,
            status: rem.status,
            title: rem.title,
            body: rem.body,
            advance_minutes: rem.advanceMinutes,
            timezone: rem.timezone
          }, { onConflict: 'user_id, item_id' });
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar fila de lembretes com a nuvem:', err);
    }
  }

  return updatedReminders;
}

/**
 * Dispara uma notificação do sistema (via Service Worker ou Notification nativa)
 */
export async function triggerNotification(title: string, body: string, data?: any): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Tentar via Service Worker Registration (funciona em segundo plano e com app minimizado)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          data
        } as NotificationOptions & { vibrate?: number[]; badge?: string });
        return true;
      }
    } catch {
      // Fallback para Notification direta
    }
  }

  // 2. Fallback para Notification API nativa
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico'
      });
      return true;
    } catch (err) {
      console.warn('Falha ao disparar Notification nativa:', err);
    }
  }

  return false;
}

/**
 * Processador periódico de lembretes ativos (Watcher local e em segundo plano)
 */
export class ReminderWatcher {
  private timer: any = null;
  private onTriggerCallback?: (reminder: ReminderItem) => void;

  constructor(onTrigger?: (reminder: ReminderItem) => void) {
    this.onTriggerCallback = onTrigger;
  }

  public start(): void {
    if (this.timer) return;
    this.checkDueReminders();
    this.timer = setInterval(() => {
      this.checkDueReminders();
    }, 30000); // Checa a cada 30 segundos
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkDueReminders(): Promise<void> {
    const reminders = getLocalReminders();
    const now = new Date();
    let hasChanges = false;

    for (const reminder of reminders) {
      if (reminder.status === 'scheduled') {
        const scheduledTime = new Date(reminder.scheduledAt);
        // Se a hora do agendamento chegou (ou passou por até 2 horas)
        if (scheduledTime <= now && (now.getTime() - scheduledTime.getTime()) < 2 * 60 * 60 * 1000) {
          // Dispara notificação no sistema
          const delivered = await triggerNotification(reminder.title, reminder.body, { itemId: reminder.itemId });
          
          reminder.status = delivered ? 'delivered' : 'sent';
          reminder.sentAt = new Date().toISOString();
          hasChanges = true;

          if (this.onTriggerCallback) {
            this.onTriggerCallback(reminder);
          }

          // Se estiver conectado ao Supabase, atualizar status na nuvem
          if (isSupabaseConfigured() && supabase && reminder.userId) {
            try {
              await supabase
                .from('reminders')
                .update({
                  status: reminder.status,
                  sent_at: reminder.sentAt
                })
                .match({ user_id: reminder.userId, item_id: reminder.itemId });
            } catch {
              // Falha silenciosa de rede
            }
          }
        }
      }
    }

    if (hasChanges) {
      saveLocalReminders(reminders);
    }
  }
}
