import { describe, it, expect } from 'vitest';
import { 
  getPaidAmountCents, 
  getRemainingAmountCents, 
  getPaymentStatus 
} from '../utils/moneyUtils';
import { CalendarItem, PartialPayment } from '../types';

describe('partialPayments (Etapa 6)', () => {
  const mockBaseExpense: CalendarItem = {
    id: 'exp-1',
    date: new Date(2026, 9, 10),
    dateStr: '2026-10-10',
    type: 'expense',
    title: 'Conserto do Carro',
    amountCents: 100000, // R$ 1.000,00
    isPaid: false,
  };

  it('calcula status unpaid quando não há amortizações e isPaid é falso', () => {
    expect(getPaidAmountCents(mockBaseExpense)).toBe(0);
    expect(getRemainingAmountCents(mockBaseExpense)).toBe(100000);
    expect(getPaymentStatus(mockBaseExpense)).toBe('unpaid');
  });

  it('calcula amortização parcial e saldo restante corretamente', () => {
    const amortizations: PartialPayment[] = [
      { id: 'p1', amountCents: 30000, dateStr: '2026-10-12', createdAt: new Date().toISOString() }, // R$ 300,00
      { id: 'p2', amountCents: 25000, dateStr: '2026-10-15', createdAt: new Date().toISOString() }, // R$ 250,00
    ];

    const itemWithPartials: CalendarItem = {
      ...mockBaseExpense,
      partialPayments: amortizations,
      isPaid: false,
    };

    expect(getPaidAmountCents(itemWithPartials)).toBe(55000); // R$ 550,00
    expect(getRemainingAmountCents(itemWithPartials)).toBe(45000); // R$ 450,00
    expect(getPaymentStatus(itemWithPartials)).toBe('partial');
  });

  it('marca como quitado/pago quando as amortizações cobrem 100% do valor', () => {
    const fullAmortizations: PartialPayment[] = [
      { id: 'p1', amountCents: 60000, dateStr: '2026-10-12', createdAt: new Date().toISOString() },
      { id: 'p2', amountCents: 40000, dateStr: '2026-10-15', createdAt: new Date().toISOString() },
    ];

    const fullyAmortizedItem: CalendarItem = {
      ...mockBaseExpense,
      partialPayments: fullAmortizations,
      isPaid: true,
    };

    expect(getPaidAmountCents(fullyAmortizedItem)).toBe(100000);
    expect(getRemainingAmountCents(fullyAmortizedItem)).toBe(0);
    expect(getPaymentStatus(fullyAmortizedItem)).toBe('paid');
  });

  it('retorna valor total quando o item é marcado diretamente como pago sem lista de amortizações', () => {
    const directlyPaidItem: CalendarItem = {
      ...mockBaseExpense,
      isPaid: true,
    };

    expect(getPaidAmountCents(directlyPaidItem)).toBe(100000);
    expect(getRemainingAmountCents(directlyPaidItem)).toBe(0);
    expect(getPaymentStatus(directlyPaidItem)).toBe('paid');
  });
});
