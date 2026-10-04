import { supabase, isSupabaseConfigured } from './supabaseClient';
import { CalendarItem, RecurrenceSeries, UserProfile } from '../types';
import { parseISODateToLocal } from '../utils/dateUtils';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local_demo';

export interface CloudDataResult {
  success: boolean;
  items?: CalendarItem[];
  series?: RecurrenceSeries[];
  profile?: UserProfile;
  error?: string;
}

/**
 * Carrega todos os itens e séries do usuário a partir do Supabase PostgreSQL.
 * RLS garante isolamento estrito contra auth.uid().
 */
export async function fetchCloudData(userId: string): Promise<CloudDataResult> {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return { success: false, error: 'Supabase não conectado.' };
  }

  try {
    // 1. Carregar perfil
    const { data: profileData } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const profile: UserProfile = {
      name: profileData?.name || '',
      avatar: profileData?.avatar_url || '',
    };

    // 2. Carregar itens da agenda
    const { data: itemsData, error: itemsError } = await supabase
      .from('calendar_items')
      .select('*')
      .eq('user_id', userId);

    if (itemsError) {
      return { success: false, error: itemsError.message };
    }

    const items: CalendarItem[] = (itemsData || []).map((row: any) => ({
      id: row.id,
      date: parseISODateToLocal(row.date_str),
      dateStr: row.date_str,
      type: row.type,
      title: row.title,
      description: row.description || '',
      startTime: row.start_time,
      endTime: row.end_time,
      color: row.color,
      alertMinutes: row.alert_minutes || 0,
      amountCents: row.amount_cents !== null ? Number(row.amount_cents) : undefined,
      isPaid: Boolean(row.is_paid),
      seriesId: row.series_id,
      recurrenceId: row.recurrence_id,
    }));

    // 3. Carregar séries recorrentes
    const { data: seriesData, error: seriesError } = await supabase
      .from('recurrence_series')
      .select('*')
      .eq('user_id', userId);

    if (seriesError) {
      return { success: false, error: seriesError.message };
    }

    const series: RecurrenceSeries[] = (seriesData || []).map((row: any) => ({
      id: row.id,
      rule: {
        seriesId: row.id,
        frequency: row.frequency,
        startDate: row.start_date,
        endDate: row.end_date,
        originalDayOfMonth: row.original_day_of_month,
      },
      templateItem: row.template_item || {},
      exceptions: row.exceptions || {},
    }));

    return {
      success: true,
      items,
      series,
      profile,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao buscar dados em nuvem.' };
  }
}

/**
 * Salva ou atualiza um item no Supabase PostgreSQL.
 */
export async function syncUpsertItem(userId: string, item: CalendarItem): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId) return false;

  // Itens virtuais pertencem a séries e não devem ser duplicados na tabela de itens
  if (item.isVirtualOccurrence) return true;

  try {
    const payload = {
      id: item.id,
      user_id: userId,
      date_str: item.dateStr,
      type: item.type,
      title: item.title,
      description: item.description || '',
      start_time: item.startTime || null,
      end_time: item.endTime || null,
      color: item.color || '#3b82f6',
      alert_minutes: item.alertMinutes || 0,
      amount_cents: item.amountCents !== undefined ? item.amountCents : null,
      is_paid: Boolean(item.isPaid),
      series_id: item.seriesId || null,
      recurrence_id: item.recurrenceId || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('calendar_items').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Exclui um item no Supabase PostgreSQL.
 */
export async function syncDeleteItem(userId: string, itemId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('calendar_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Salva ou atualiza uma série recorrente no Supabase PostgreSQL.
 */
export async function syncUpsertSeries(userId: string, series: RecurrenceSeries): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId) return false;

  try {
    const payload = {
      id: series.id,
      user_id: userId,
      frequency: series.rule.frequency,
      start_date: series.rule.startDate,
      end_date: series.rule.endDate || null,
      original_day_of_month: series.rule.originalDayOfMonth || null,
      template_item: series.templateItem,
      exceptions: series.exceptions || {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('recurrence_series').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Exclui uma série recorrente no Supabase PostgreSQL.
 */
export async function syncDeleteSeries(userId: string, seriesId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('recurrence_series')
      .delete()
      .eq('id', seriesId)
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Importação Explícita: Migra os registros salvos localmente neste navegador
 * para a conta autenticada no Supabase sem duplicidade e sem copiar senhas.
 */
export async function importLocalRecordsToCloud(
  userId: string,
  localItems: CalendarItem[],
  localSeries: RecurrenceSeries[]
): Promise<{ success: boolean; importedCount: number; error?: string }> {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return { success: false, importedCount: 0, error: 'Supabase não conectado.' };
  }

  try {
    // 1. Obter IDs já existentes na nuvem para evitar duplicidade
    const { data: existingCloudItems } = await supabase
      .from('calendar_items')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existingCloudItems || []).map((row: any) => row.id));

    // 2. Filtrar apenas itens novos não virtuais
    const nonVirtual = localItems.filter(i => !i.isVirtualOccurrence);
    const itemsToInsert = nonVirtual.filter(i => !existingIds.has(i.id)).map(item => ({
      id: item.id,
      user_id: userId,
      date_str: item.dateStr,
      type: item.type,
      title: item.title,
      description: item.description || '',
      start_time: item.startTime || null,
      end_time: item.endTime || null,
      color: item.color || '#3b82f6',
      alert_minutes: item.alertMinutes || 0,
      amount_cents: item.amountCents !== undefined ? item.amountCents : null,
      is_paid: Boolean(item.isPaid),
      series_id: item.seriesId || null,
      recurrence_id: item.recurrenceId || null,
    }));

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('calendar_items').insert(itemsToInsert);
      if (insertError) {
        return { success: false, importedCount: 0, error: insertError.message };
      }
    }

    // 3. Inserir séries recorrentes que não existam
    const { data: existingCloudSeries } = await supabase
      .from('recurrence_series')
      .select('id')
      .eq('user_id', userId);

    const existingSeriesIds = new Set((existingCloudSeries || []).map((row: any) => row.id));
    const seriesToInsert = localSeries.filter(s => !existingSeriesIds.has(s.id)).map(s => ({
      id: s.id,
      user_id: userId,
      frequency: s.rule.frequency,
      start_date: s.rule.startDate,
      end_date: s.rule.endDate || null,
      original_day_of_month: s.rule.originalDayOfMonth || null,
      template_item: s.templateItem,
      exceptions: s.exceptions || {},
    }));

    if (seriesToInsert.length > 0) {
      const { error: insertSeriesError } = await supabase.from('recurrence_series').insert(seriesToInsert);
      if (insertSeriesError) {
        return { success: false, importedCount: itemsToInsert.length, error: insertSeriesError.message };
      }
    }

    const totalImported = itemsToInsert.length + seriesToInsert.length;
    return { success: true, importedCount: totalImported };
  } catch (err: any) {
    return { success: false, importedCount: 0, error: err?.message || 'Falha ao importar dados.' };
  }
}
