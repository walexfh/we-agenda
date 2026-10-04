import { CalendarItem, InstallmentInfo } from '../types';
import { calculateMonthlyOccurrenceDate } from './recurrenceUtils';
import { parseISODateToLocal } from './dateUtils';

export interface InstallmentCalculationResult {
  totalAmountCents: number;
  installmentAmounts: number[];
  count: number;
}

/**
 * Calcula a divisão de centavos para N parcelas sem perder nenhum centavo.
 * Eventual resto da divisão é adicionado à 1ª parcela.
 */
export function calculateInstallmentAmounts(
  inputCents: number,
  count: number,
  isTotalAmount: boolean
): InstallmentCalculationResult {
  if (count <= 1) {
    return {
      totalAmountCents: inputCents,
      installmentAmounts: [inputCents],
      count: 1,
    };
  }

  let totalAmountCents: number;
  let installmentAmounts: number[] = [];

  if (isTotalAmount) {
    totalAmountCents = inputCents;
    const baseCents = Math.floor(inputCents / count);
    const remainder = inputCents - (baseCents * count);

    for (let i = 0; i < count; i++) {
      // Adiciona o resto na 1ª parcela para que a soma seja 100% exata
      const amount = i === 0 ? baseCents + remainder : baseCents;
      installmentAmounts.push(amount);
    }
  } else {
    // inputCents é o valor de cada parcela
    const perInstallmentCents = inputCents;
    totalAmountCents = perInstallmentCents * count;
    installmentAmounts = Array(count).fill(perInstallmentCents);
  }

  return {
    totalAmountCents,
    installmentAmounts,
    count,
  };
}

/**
 * Cria os N itens de calendário para uma compra parcelada, com datas de vencimento mensais
 * e respeitando o ajuste para meses menores (ex: dia 31 -> 28 fev -> 31 mar).
 */
export function createInstallmentItems(
  baseItem: Omit<CalendarItem, 'id'>,
  count: number,
  isTotalAmount: boolean,
  generateId: () => string
): CalendarItem[] {
  if (count <= 1) {
    return [{
      ...baseItem,
      id: generateId(),
    }];
  }

  const inputCents = baseItem.amountCents || 0;
  const { totalAmountCents, installmentAmounts } = calculateInstallmentAmounts(inputCents, count, isTotalAmount);
  const groupId = generateId();

  const [startYear, startMonthRaw, startDay] = baseItem.dateStr.split('-').map(Number);
  const startMonth = startMonthRaw - 1; // 0-indexed
  const originalDayOfMonth = startDay;

  const items: CalendarItem[] = [];

  for (let i = 0; i < count; i++) {
    const occurrenceDateStr = calculateMonthlyOccurrenceDate(startYear, startMonth, originalDayOfMonth, i);
    const occurrenceDate = parseISODateToLocal(occurrenceDateStr);
    const currentNumber = i + 1;
    const amountCents = installmentAmounts[i];

    const installmentInfo: InstallmentInfo = {
      current: currentNumber,
      total: count,
      groupId,
      totalAmountCents,
    };

    // Sufixa o título com o número da parcela (ex: "Notebook (1/10)")
    const installmentTitle = `${baseItem.title} (${currentNumber}/${count})`;

    const item: CalendarItem = {
      ...baseItem,
      id: generateId(),
      date: occurrenceDate,
      dateStr: occurrenceDateStr,
      title: installmentTitle,
      amountCents,
      installment: installmentInfo,
      // Se a 1ª parcela foi criada como paga na data atual, as parcelas futuras permanecem pendentes
      isPaid: i === 0 ? Boolean(baseItem.isPaid) : false,
      partialPayments: [],
    };

    items.push(item);
  }

  return items;
}
