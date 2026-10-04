import { describe, it, expect } from 'vitest';
import { CalendarItem, FinancialSummary } from '../types';
import { parseISODateToLocal } from '../utils/dateUtils';

// Função pura para testar o cálculo exato do resumo financeiro
export function calculateFinancialSummaryForItems(items: CalendarItem[]): FinancialSummary {
  let incomeReceivedCents = 0;
  let expensePaidCents = 0;
  let incomePendingCents = 0;
  let expensePendingCents = 0;

  for (const item of items) {
    const amount = item.amountCents || 0;
    if (item.type === 'income') {
      if (item.isPaid) {
        incomeReceivedCents += amount;
      } else {
        incomePendingCents += amount;
      }
    } else if (item.type === 'expense') {
      if (item.isPaid) {
        expensePaidCents += amount;
      } else {
        expensePendingCents += amount;
      }
    }
  }

  const realizedResultCents = incomeReceivedCents - expensePaidCents;
  const forecastResultCents = (incomeReceivedCents + incomePendingCents) - (expensePaidCents + expensePendingCents);

  return {
    incomeReceivedCents,
    expensePaidCents,
    incomePendingCents,
    expensePendingCents,
    realizedResultCents,
    forecastResultCents,
  };
}

describe('financialSummary - Separação Rigorosa entre Realizado e Previsto', () => {
  it('calcula corretamente realizado e previsto separando pagos de pendentes', () => {
    const sampleItems: CalendarItem[] = [
      // Receita já recebida: R$ 5.000,00 (500000 centavos)
      {
        id: '1',
        title: 'Salário',
        type: 'income',
        amountCents: 500000,
        isPaid: true,
        date: parseISODateToLocal('2026-10-05'),
        dateStr: '2026-10-05',
      },
      // Receita a receber (pendente): R$ 1.200,00 (120000 centavos)
      {
        id: '2',
        title: 'Freelance a receber',
        type: 'income',
        amountCents: 120000,
        isPaid: false,
        date: parseISODateToLocal('2026-10-20'),
        dateStr: '2026-10-20',
      },
      // Despesa já paga: R$ 1.500,00 (150000 centavos)
      {
        id: '3',
        title: 'Aluguel Pago',
        type: 'expense',
        amountCents: 150000,
        isPaid: true,
        date: parseISODateToLocal('2026-10-10'),
        dateStr: '2026-10-10',
      },
      // Despesa a pagar (pendente): R$ 800,00 (80000 centavos)
      {
        id: '4',
        title: 'Cartão de Crédito',
        type: 'expense',
        amountCents: 80000,
        isPaid: false,
        date: parseISODateToLocal('2026-10-25'),
        dateStr: '2026-10-25',
      },
      // Compromisso sem valor (não deve interferir no balanço)
      {
        id: '5',
        title: 'Dentista',
        type: 'appointment',
        startTime: '10:00',
        endTime: '11:00',
        date: parseISODateToLocal('2026-10-12'),
        dateStr: '2026-10-12',
      },
    ];

    const summary = calculateFinancialSummaryForItems(sampleItems);

    // 1. Receitas recebidas: R$ 5.000,00
    expect(summary.incomeReceivedCents).toBe(500000);

    // 2. Contas a receber: R$ 1.200,00
    expect(summary.incomePendingCents).toBe(120000);

    // 3. Despesas pagas: R$ 1.500,00
    expect(summary.expensePaidCents).toBe(150000);

    // 4. Contas a pagar: R$ 800,00
    expect(summary.expensePendingCents).toBe(80000);

    // 5. Resultado realizado = 5.000,00 - 1.500,00 = R$ 3.500,00 (350000 centavos)
    expect(summary.realizedResultCents).toBe(350000);

    // 6. Resultado previsto = (5000 + 1200) - (1500 + 800) = 6200 - 2300 = R$ 3.900,00 (390000 centavos)
    expect(summary.forecastResultCents).toBe(390000);
  });
});
