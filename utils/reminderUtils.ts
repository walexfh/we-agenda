import { CalendarItem, ReminderItem, ReminderChannel, ReminderStatus } from '../types';
import { formatCurrency } from './moneyUtils';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export const POPULAR_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3) - Padrão' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
  { value: 'UTC', label: 'UTC (Tempo Universal)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0/+1)' },
  { value: 'America/New_York', label: 'Nova York (GMT-5/-4)' }
];

/**
 * Valida se um identificador IANA de fuso horário é suportado pelo ambiente
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converte data local (YYYY-MM-DD) e horário local (HH:mm) em um fuso horário IANA para um objeto Date UTC
 */
export function parseZonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);

  const preliminaryUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(preliminaryUtc);
    const p: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        p[part.type] = Number(part.value);
      }
    }

    const targetHour = p.hour === 24 ? 0 : p.hour;
    const targetAsUtc = Date.UTC(p.year, p.month - 1, p.day, targetHour, p.minute, p.second, 0);
    const offsetMs = targetAsUtc - preliminaryUtc.getTime();

    return new Date(preliminaryUtc.getTime() - offsetMs);
  } catch {
    // Fallback gracioso para timestamp local caso haja falha inesperada no Intl
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }
}

/**
 * Formata minutos de antecipação para exibição amigável
 */
export function formatAdvanceMinutes(minutes?: number): string {
  if (minutes === undefined || minutes === 0) return 'No horário';
  if (minutes === 5) return '5 minutos antes';
  if (minutes === 10) return '10 minutos antes';
  if (minutes === 15) return '15 minutos antes';
  if (minutes === 30) return '30 minutos antes';
  if (minutes === 60) return '1 hora antes';
  if (minutes === 120) return '2 horas antes';
  if (minutes === 1440) return '1 dia antes';
  if (minutes === 2880) return '2 dias antes';
  return `${minutes} minutos antes`;
}

/**
 * Calcula a data e hora exata em que o lembrete deve disparar considerando fuso e antecipação
 */
export function calculateScheduledReminderTime(
  item: CalendarItem,
  userTimezone: string = DEFAULT_TIMEZONE
): { scheduledDate: Date; scheduledIso: string } | null {
  // Se não tem lembrete configurado (alertMinutes === 0 ou undefined)
  if (item.alertMinutes === undefined || item.alertMinutes === null || item.alertMinutes < 0) {
    return null;
  }

  // Finanças pagas não precisam de lembretes ativos
  if ((item.type === 'income' || item.type === 'expense') && item.isPaid) {
    return null;
  }

  const effectiveTz = isValidTimezone(userTimezone) ? userTimezone : DEFAULT_TIMEZONE;
  const timeStr = item.type === 'appointment' ? (item.startTime || '09:00') : (item.alertTime || '08:00');

  const baseEventUtc = parseZonedTimeToUtc(item.dateStr, timeStr, effectiveTz);
  const scheduledTimeMs = baseEventUtc.getTime() - (item.alertMinutes * 60 * 1000);
  const scheduledDate = new Date(scheduledTimeMs);

  return {
    scheduledDate,
    scheduledIso: scheduledDate.toISOString()
  };
}

/**
 * Cria ou atualiza um objeto de lembrete a partir de um item de calendário
 */
export function createReminderFromItem(
  item: CalendarItem,
  userId?: string,
  userTimezone: string = DEFAULT_TIMEZONE,
  channel: ReminderChannel = 'browser_notification'
): ReminderItem | null {
  const scheduleInfo = calculateScheduledReminderTime(item, userTimezone);
  if (!scheduleInfo) return null;

  let title = '';
  let body = '';

  if (item.type === 'appointment') {
    title = `📅 Compromisso: ${item.title}`;
    const advanceText = formatAdvanceMinutes(item.alertMinutes);
    body = `Horário: ${item.startTime || '09:00'} (${advanceText})`;
    if (item.description) {
      body += ` • ${item.description}`;
    }
  } else {
    const isExpense = item.type === 'expense';
    title = isExpense ? `💸 Vencimento: ${item.title}` : `💰 Recebimento: ${item.title}`;
    const formattedAmount = item.amountCents ? formatCurrency(item.amountCents) : '';
    const advanceText = formatAdvanceMinutes(item.alertMinutes);
    body = `Data: ${item.dateStr}${formattedAmount ? ' • ' + formattedAmount : ''} (${advanceText})`;
  }

  return {
    id: `rem_${item.id}_${item.alertMinutes ?? 0}`,
    userId,
    itemId: item.id,
    channel,
    scheduledAt: scheduleInfo.scheduledIso,
    status: 'scheduled',
    title,
    body,
    advanceMinutes: item.alertMinutes || 0,
    timezone: userTimezone,
    createdAt: new Date().toISOString()
  };
}

/**
 * Máquina de estados para transição válida de status de lembretes
 */
export function canTransitionReminderStatus(current: ReminderStatus, next: ReminderStatus): boolean {
  if (current === next) return true;
  
  switch (current) {
    case 'scheduled':
      return ['sent', 'delivered', 'failed', 'dismissed'].includes(next);
    case 'sent':
      return ['delivered', 'failed', 'dismissed'].includes(next);
    case 'failed':
      return ['scheduled', 'dismissed'].includes(next); // Permite retry
    case 'delivered':
      return ['dismissed'].includes(next);
    case 'dismissed':
      return false; // Estado terminal
    default:
      return false;
  }
}
