import { CalendarItem, RecurrenceSeries, RecurrenceRule, SeriesException, RecurrenceFrequency } from '../types';
import { formatDateToISO, parseISODateToLocal, getDaysInGivenMonth } from './dateUtils';

/**
 * Adiciona N dias a uma data formatada YYYY-MM-DD mantendo consistência de calendário local.
 */
function addDaysToISO(isoStr: string, daysToAdd: number): string {
  const d = parseISODateToLocal(isoStr);
  d.setDate(d.getDate() + daysToAdd);
  return formatDateToISO(d);
}

/**
 * Calcula o dia anterior a uma data YYYY-MM-DD.
 */
function getDayBeforeISO(isoStr: string): string {
  return addDaysToISO(isoStr, -1);
}

/**
 * Calcula a data de ocorrência mensal com suporte à regra do dia 31:
 * - Em meses menores (ex: fevereiro 28/29, abril 30), utiliza o último dia do mês.
 * - Em meses seguintes de 31 dias, restaura o dia 31 original.
 */
export function calculateMonthlyOccurrenceDate(
  startYear: number,
  startMonth: number,
  originalDayOfMonth: number,
  monthIndexOffset: number
): string {
  const totalMonths = startMonth + monthIndexOffset;
  const targetYear = startYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12; // 0-indexed

  const daysInMonth = getDaysInGivenMonth(targetYear, targetMonth);
  const actualDay = Math.min(originalDayOfMonth, daysInMonth);

  const monthStr = String(targetMonth + 1).padStart(2, '0');
  const dayStr = String(actualDay).padStart(2, '0');
  return `${targetYear}-${monthStr}-${dayStr}`;
}

/**
 * Gera as ocorrências de uma série recorrente dentro de um intervalo de datas [intervalStart, intervalEnd].
 * Apenas gera as ocorrências necessárias para o período visualizado, sem listas infinitas e sem
 * limitar silenciosamente a 12 itens.
 */
export function generateOccurrencesForInterval(
  series: RecurrenceSeries,
  intervalStart: Date,
  intervalEnd: Date
): CalendarItem[] {
  const { rule, templateItem, exceptions } = series;
  const occurrences: CalendarItem[] = [];

  const startISODate = rule.startDate;
  const endISODate = rule.endDate;

  const [startYear, startMonthRaw, startDay] = startISODate.split('-').map(Number);
  const startMonth = startMonthRaw - 1; // 0-indexed
  const originalDay = rule.originalDayOfMonth || startDay;

  const intervalStartISO = formatDateToISO(intervalStart);
  const intervalEndISO = formatDateToISO(intervalEnd);

  let currentISO = startISODate;
  let occurrenceIndex = 0;

  // Limite de segurança razoável para evitar loops infinitos caso haja regra anômala
  const MAX_OCCURRENCES_TO_SCAN = 1200;

  while (occurrenceIndex < MAX_OCCURRENCES_TO_SCAN) {
    if (rule.count && occurrenceIndex >= rule.count) {
      break;
    }

    if (endISODate && currentISO > endISODate) {
      break;
    }

    // Se a ocorrência já ultrapassou o fim do intervalo consultado, podemos parar
    // (apenas para sequências cronológicas lineares)
    if (currentISO > intervalEndISO) {
      break;
    }

    // Se a ocorrência estiver dentro do intervalo consultado
    if (currentISO >= intervalStartISO && currentISO <= intervalEndISO) {
      const exception = exceptions[currentISO];

      // Se foi excluída nesta data, não incluir
      if (!exception?.isDeleted) {
        const isPaid = exception?.isPaid !== undefined ? exception.isPaid : (templateItem.isPaid ?? false);
        const overrides = exception?.overrides || {};

        occurrences.push({
          ...templateItem,
          ...overrides,
          id: `${series.id}_${currentISO}`,
          date: parseISODateToLocal(currentISO),
          dateStr: currentISO,
          originalDateStr: currentISO,
          seriesId: series.id,
          isPaid,
          isVirtualOccurrence: true,
        });
      }
    }

    occurrenceIndex++;

    // Calcula a próxima ocorrência
    switch (rule.frequency) {
      case 'daily':
        currentISO = addDaysToISO(currentISO, 1);
        break;
      case 'weekly':
        currentISO = addDaysToISO(currentISO, 7);
        break;
      case 'biweekly':
        currentISO = addDaysToISO(currentISO, 14);
        break;
      case 'monthly':
        currentISO = calculateMonthlyOccurrenceDate(startYear, startMonth, originalDay, occurrenceIndex);
        break;
      default:
        return occurrences;
    }
  }

  return occurrences;
}

/**
 * Exclui apenas uma ocorrência pontual da série, adicionando uma exceção de exclusão.
 */
export function deleteSingleOccurrence(
  series: RecurrenceSeries,
  occurrenceDateStr: string
): RecurrenceSeries {
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [occurrenceDateStr]: {
        ...(series.exceptions[occurrenceDateStr] || {}),
        originalDate: occurrenceDateStr,
        isDeleted: true,
      },
    },
  };
}

/**
 * Exclui esta ocorrência e todas as futuras da série.
 * Preserva o histórico anterior encerrando a data final da regra no dia anterior.
 */
export function deleteFutureOccurrences(
  series: RecurrenceSeries,
  fromDateStr: string
): RecurrenceSeries | null {
  // Se a exclusão for antes ou na data inicial da série, a série inteira deixa de existir
  if (fromDateStr <= series.rule.startDate) {
    return null;
  }

  const newEndDate = getDayBeforeISO(fromDateStr);
  return {
    ...series,
    rule: {
      ...series.rule,
      endDate: newEndDate,
    },
  };
}

/**
 * Altera apenas uma ocorrência pontual da série, salvando override na exceção.
 */
export function updateSingleOccurrence(
  series: RecurrenceSeries,
  occurrenceDateStr: string,
  overrides: Partial<Omit<CalendarItem, 'id' | 'seriesId'>>
): RecurrenceSeries {
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [occurrenceDateStr]: {
        ...(series.exceptions[occurrenceDateStr] || {}),
        originalDate: occurrenceDateStr,
        overrides: {
          ...(series.exceptions[occurrenceDateStr]?.overrides || {}),
          ...overrides,
        },
      },
    },
  };
}

/**
 * Altera "Esta e as próximas ocorrências":
 * - Encerra a série original no dia anterior à data de corte.
 * - Cria uma nova série a partir da nova data com os parâmetros atualizados.
 * - Preserva integralmente o histórico das ocorrências anteriores sem deslocamentos incorretos.
 */
export function splitAndAdvanceSeries(
  series: RecurrenceSeries,
  fromDateStr: string,
  newBaseItem: Omit<CalendarItem, 'id' | 'date' | 'dateStr' | 'seriesId' | 'isVirtualOccurrence'>,
  newStartDateStr: string,
  newSeriesId: string
): { updatedOldSeries: RecurrenceSeries | null; newSeries: RecurrenceSeries } {
  // 1. Trata a série antiga
  let updatedOldSeries: RecurrenceSeries | null = null;
  if (fromDateStr > series.rule.startDate) {
    updatedOldSeries = {
      ...series,
      rule: {
        ...series.rule,
        endDate: getDayBeforeISO(fromDateStr),
      },
    };
  }

  // 2. Cria a nova série
  const [, , startDay] = newStartDateStr.split('-').map(Number);
  const newSeries: RecurrenceSeries = {
    id: newSeriesId,
    rule: {
      seriesId: newSeriesId,
      frequency: series.rule.frequency,
      startDate: newStartDateStr,
      endDate: series.rule.endDate,
      originalDayOfMonth: series.rule.frequency === 'monthly' ? startDay : undefined,
    },
    templateItem: {
      ...newBaseItem,
    },
    exceptions: {},
  };

  return { updatedOldSeries, newSeries };
}

/**
 * Alterna o status de pagamento de uma ocorrência específica sem afetar as demais.
 */
export function toggleSeriesOccurrencePaid(
  series: RecurrenceSeries,
  occurrenceDateStr: string,
  currentPaid: boolean
): RecurrenceSeries {
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [occurrenceDateStr]: {
        ...(series.exceptions[occurrenceDateStr] || {}),
        originalDate: occurrenceDateStr,
        isPaid: !currentPaid,
      },
    },
  };
}
