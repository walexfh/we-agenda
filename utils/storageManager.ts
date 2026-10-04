import { CalendarItem, RecurrenceSeries, UserProfile } from '../types';
import { normalizeLegacyDate, formatDateToISO } from './dateUtils';
import { legacyFloatToCents } from './moneyUtils';

export const CURRENT_SCHEMA_VERSION = 2;

const KEY_CURRENT_USER = 'fincal_current_user';
const KEY_USERS = 'fincal_users';
const KEY_THEME = 'fincal_theme';
const KEY_VERSION_PREFIX = 'fincal_storage_version_';
const KEY_ITEMS_PREFIX = 'fincal_items_';
const KEY_SERIES_PREFIX = 'fincal_series_';
const KEY_PROFILE_PREFIX = 'fincal_profile_';
const KEY_BACKUP_PREFIX = 'fincal_backup_v1_';
const KEY_CORRUPTED_PREFIX = 'fincal_corrupted_';

export type StorageLoadResult =
  | { status: 'success'; items: CalendarItem[]; series: RecurrenceSeries[]; profile: UserProfile }
  | { status: 'corrupted'; rawContent: string; backupKey: string; error: string }
  | { status: 'unavailable'; error: string };

export interface StorageSaveResult {
  success: boolean;
  error?: string;
}

/**
 * Gera um identificador único padrão UUID v4.
 * Substitui o antigo Date.now().toString() que permitia colisões.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Verifica se o armazenamento local está funcionalmente acessível.
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__fincal_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Carrega os dados do usuário com validação de esquema, backup preventivo e proteção contra corrupção.
 * Se o JSON estiver corrompido, NÃO apaga nem substitui silenciosamente por lista vazia.
 */
export function loadUserData(userId: string): StorageLoadResult {
  if (!isStorageAvailable()) {
    return {
      status: 'unavailable',
      error: 'O armazenamento local está indisponível neste navegador (navegação privada restrita ou sem permissão).'
    };
  }

  const itemsKey = `${KEY_ITEMS_PREFIX}${userId}`;
  const seriesKey = `${KEY_SERIES_PREFIX}${userId}`;
  const profileKey = `${KEY_PROFILE_PREFIX}${userId}`;
  const versionKey = `${KEY_VERSION_PREFIX}${userId}`;

  const rawItems = localStorage.getItem(itemsKey);
  const rawSeries = localStorage.getItem(seriesKey);
  const rawProfile = localStorage.getItem(profileKey);
  const currentVersion = parseInt(localStorage.getItem(versionKey) || '1', 10);

  // Perfil do usuário
  let profile: UserProfile = { name: userId };
  if (rawProfile) {
    try {
      profile = JSON.parse(rawProfile);
    } catch {
      // Falha não crítica para o perfil
    }
  }

  // Séries recorrentes
  let series: RecurrenceSeries[] = [];
  if (rawSeries) {
    try {
      series = JSON.parse(rawSeries);
    } catch {
      series = [];
    }
  }

  // Se não houver itens prévios, inicializa versão 2 vazia
  if (!rawItems || rawItems.trim() === '') {
    localStorage.setItem(versionKey, CURRENT_SCHEMA_VERSION.toString());
    return { status: 'success', items: [], series, profile };
  }

  // Tentativa de deserialização
  let parsedRawItems: any;
  try {
    parsedRawItems = JSON.parse(rawItems);
  } catch (err: any) {
    // PROTEÇÃO CONTRA CORRUPÇÃO SILENCIOSA:
    // Nunca substituir por lista vazia! Preserva o conteúdo bruto em chave de emergência.
    const backupKey = `${KEY_CORRUPTED_PREFIX}${userId}_${Date.now()}`;
    try {
      localStorage.setItem(backupKey, rawItems);
    } catch {
      // Ignora falha de escrita caso não haja espaço
    }

    return {
      status: 'corrupted',
      rawContent: rawItems,
      backupKey,
      error: err?.message || 'Arquivo de dados em formato JSON corrompido ou truncado.'
    };
  }

  if (!Array.isArray(parsedRawItems)) {
    const backupKey = `${KEY_CORRUPTED_PREFIX}${userId}_${Date.now()}`;
    try {
      localStorage.setItem(backupKey, rawItems);
    } catch {}
    return {
      status: 'corrupted',
      rawContent: rawItems,
      backupKey,
      error: 'O conteúdo de itens armazenados não é uma lista válida.'
    };
  }

  // MIGRAÇÃO VERSIONADA (Executada apenas se versão < 2)
  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    // 1. Criar cópia recuperável antes de migrar (sem copiar senhas, apenas registros locais)
    const backupKey = `${KEY_BACKUP_PREFIX}${userId}_${Date.now()}`;
    try {
      localStorage.setItem(backupKey, rawItems);
    } catch (e) {
      console.warn('Não foi possível gravar backup pré-migração (espaço insuficiente).');
    }

    // 2. Migrar cada item antigo para o formato V2
    const migratedItems: CalendarItem[] = parsedRawItems.map((oldItem: any) => {
      const normalizedDate = normalizeLegacyDate(oldItem.date);

      // Tratamento de valores financeiros em centavos
      let amountCents: number | undefined;
      if (oldItem.type === 'income' || oldItem.type === 'expense') {
        if (typeof oldItem.amountCents === 'number') {
          amountCents = Math.round(oldItem.amountCents);
        } else if (typeof oldItem.amount === 'number') {
          amountCents = legacyFloatToCents(oldItem.amount);
        } else {
          amountCents = 0;
        }
      }

      return {
        id: oldItem.id || generateUUID(),
        date: normalizedDate.date,
        dateStr: normalizedDate.dateStr,
        type: oldItem.type || 'appointment',
        title: String(oldItem.title || '').trim() || 'Sem título',
        description: oldItem.description || '',
        startTime: oldItem.startTime,
        endTime: oldItem.endTime,
        color: oldItem.color,
        alertMinutes: oldItem.alertMinutes || 0,
        amountCents,
        isPaid: Boolean(oldItem.isPaid),
        recurrenceId: oldItem.recurrenceId,
      };
    });

    // 3. Salvar itens migrados e marcar versão 2
    try {
      localStorage.setItem(itemsKey, JSON.stringify(migratedItems));
      localStorage.setItem(versionKey, CURRENT_SCHEMA_VERSION.toString());
    } catch (saveErr) {
      console.error('Falha ao persistir migração v2:', saveErr);
    }

    return { status: 'success', items: migratedItems, series, profile };
  }

  // Se já estiver na versão 2, reidrata as datas para objetos Date locais sem distorção
  const items: CalendarItem[] = parsedRawItems.map((item: any) => {
    const normalized = normalizeLegacyDate(item.dateStr || item.date);
    return {
      ...item,
      date: normalized.date,
      dateStr: item.dateStr || normalized.dateStr,
      amountCents: item.amountCents !== undefined ? Math.round(item.amountCents) : (item.amount ? legacyFloatToCents(item.amount) : undefined)
    };
  });

  return { status: 'success', items, series, profile };
}

/**
 * Salva com segurança os itens e séries do usuário.
 * Trata erros de cota de armazenamento e falhas de gravação.
 */
export function saveUserData(
  userId: string,
  items: CalendarItem[],
  series: RecurrenceSeries[]
): StorageSaveResult {
  if (!userId) {
    return { success: false, error: 'Identificador de usuário não informado.' };
  }

  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'Armazenamento local indisponível neste navegador.'
    };
  }

  const itemsKey = `${KEY_ITEMS_PREFIX}${userId}`;
  const seriesKey = `${KEY_SERIES_PREFIX}${userId}`;
  const versionKey = `${KEY_VERSION_PREFIX}${userId}`;

  // Itens virtuais de séries não devem ser salvos diretamente na lista de itens independentes
  const nonVirtualItems = items.filter(i => !i.isVirtualOccurrence);

  try {
    const serializedItems = JSON.stringify(nonVirtualItems);
    const serializedSeries = JSON.stringify(series);

    localStorage.setItem(itemsKey, serializedItems);
    localStorage.setItem(seriesKey, serializedSeries);
    localStorage.setItem(versionKey, CURRENT_SCHEMA_VERSION.toString());

    return { success: true };
  } catch (err: any) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    const errorMsg = isQuota
      ? 'Espaço de armazenamento esgotado no navegador. Não foi possível salvar o registro.'
      : (err?.message || 'Falha ao salvar dados no armazenamento local.');

    return { success: false, error: errorMsg };
  }
}

/**
 * Salva o perfil do usuário sem tocar em senhas.
 */
export function saveUserProfile(userId: string, profile: UserProfile): StorageSaveResult {
  try {
    localStorage.setItem(`${KEY_PROFILE_PREFIX}${userId}`, JSON.stringify(profile));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Falha ao salvar perfil.' };
  }
}
