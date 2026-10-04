import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format,
  getDaysInMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um objeto Date para a string canônica YYYY-MM-DD no fuso local.
 * Nunca utiliza toISOString().split('T')[0] para evitar desvios causados por UTC.
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma string YYYY-MM-DD em um objeto Date seguro no fuso local.
 * Fixado ao meio-dia (12:00:00) para garantir que variações de horário de verão
 * ou fuso nunca desloquem a data para o dia anterior ou seguinte.
 */
export function parseISODateToLocal(isoStr: string): Date {
  if (!isoStr || typeof isoStr !== 'string') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }

  const parts = isoStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  // Fallback caso a string tenha outro formato
  const parsed = new Date(isoStr);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
}

/**
 * Converte datas legadas (Date, string ISO com fuso ou YYYY-MM-DD) preservando o dia
 * no ambiente atual de execução. Documenta que o armazenamento antigo não informava o fuso original.
 */
export function normalizeLegacyDate(val: any): { date: Date; dateStr: string } {
  if (!val) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    return { date: d, dateStr: formatDateToISO(d) };
  }

  if (val instanceof Date) {
    const d = new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
    return { date: d, dateStr: formatDateToISO(d) };
  }

  if (typeof val === 'string') {
    // Se já for YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const d = parseISODateToLocal(val);
      return { date: d, dateStr: val };
    }
    // Se for string ISO com timestamp (ex: "2026-10-04T03:00:00.000Z")
    const dRaw = new Date(val);
    const d = new Date(dRaw.getFullYear(), dRaw.getMonth(), dRaw.getDate(), 12, 0, 0);
    return { date: d, dateStr: formatDateToISO(d) };
  }

  const fallback = new Date();
  const d = new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
  return { date: d, dateStr: formatDateToISO(d) };
}

/**
 * Gera a grade de dias exibida no calendário para o mês corrente.
 */
export const generateCalendarDays = (currentDate: Date): Date[] => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });

  return eachDayOfInterval({
    start: startDate,
    end: endDate,
  }).map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
};

export const formatDateDisplay = (date: Date): string => {
  return format(date, "d 'de' MMMM", { locale: ptBR });
};

export const formatMonthYear = (date: Date): string => {
  return format(date, "MMMM yyyy", { locale: ptBR });
};

/**
 * Validação de horários HH:mm no mesmo dia.
 * Retorna true se endTime for estritamente posterior a startTime.
 */
export function isEndTimeAfterStartTime(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [hStart, mStart] = startTime.split(':').map(Number);
  const [hEnd, mEnd] = endTime.split(':').map(Number);

  if (isNaN(hStart) || isNaN(mStart) || isNaN(hEnd) || isNaN(mEnd)) {
    return false;
  }

  const startMinutes = hStart * 60 + mStart;
  const endMinutes = hEnd * 60 + mEnd;

  return endMinutes > startMinutes;
}

/**
 * Retorna o número de dias de um determinado mês em um determinado ano (com suporte a anos bissextos).
 */
export function getDaysInGivenMonth(year: number, monthZeroIndexed: number): number {
  return getDaysInMonth(new Date(year, monthZeroIndexed, 1));
}