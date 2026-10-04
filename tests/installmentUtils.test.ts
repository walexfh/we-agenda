import { describe, it, expect } from 'vitest';
import { 
  calculateInstallmentAmounts, 
  createInstallmentItems 
} from '../utils/installmentUtils';
import { CalendarItem } from '../types';

describe('installmentUtils (Etapa 6)', () => {
  it('calcula divisão de centavos com precisão exata sem perder nenhum centavo', () => {
    // R$ 100,00 dividido em 3x = 10000 centavos / 3
    // Deve gerar: 3334 centavos (1ª parcela com resto) + 3333 centavos + 3333 centavos
    const res = calculateInstallmentAmounts(10000, 3, true);
    expect(res.count).toBe(3);
    expect(res.totalAmountCents).toBe(10000);
    expect(res.installmentAmounts).toEqual([3334, 3333, 3333]);
    expect(res.installmentAmounts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('calcula valor total quando o usuário informa o valor por parcela', () => {
    // 5x de R$ 250,50 (25050 centavos)
    const res = calculateInstallmentAmounts(25050, 5, false);
    expect(res.totalAmountCents).toBe(125250); // R$ 1.252,50
    expect(res.installmentAmounts).toHaveLength(5);
    expect(res.installmentAmounts.every(v => v === 25050)).toBe(true);
  });

  it('gera lançamentos de parcelamento com datas mensais e ajuste no dia 31', () => {
    let idCounter = 1;
    const generateId = () => `mock-id-${idCounter++}`;

    const baseItem: Omit<CalendarItem, 'id'> = {
      date: new Date(2026, 0, 31),
      dateStr: '2026-01-31',
      type: 'expense',
      title: 'Notebook Dell',
      amountCents: 300000, // R$ 3.000,00
      isPaid: true, // 1ª parcela paga
    };

    const installments = createInstallmentItems(baseItem, 3, true, generateId);
    expect(installments).toHaveLength(3);

    // 1ª Parcela: 31 de janeiro de 2026
    expect(installments[0].dateStr).toBe('2026-01-31');
    expect(installments[0].title).toBe('Notebook Dell (1/3)');
    expect(installments[0].isPaid).toBe(true);
    expect(installments[0].installment?.current).toBe(1);
    expect(installments[0].installment?.total).toBe(3);

    // 2ª Parcela: Ajusta para 28 de fevereiro de 2026 (ano não bissexto)
    expect(installments[1].dateStr).toBe('2026-02-28');
    expect(installments[1].title).toBe('Notebook Dell (2/3)');
    expect(installments[1].isPaid).toBe(false); // Parcelas futuras pendentes
    expect(installments[1].installment?.current).toBe(2);

    // 3ª Parcela: Restaura dia 31 de março de 2026!
    expect(installments[2].dateStr).toBe('2026-03-31');
    expect(installments[2].title).toBe('Notebook Dell (3/3)');
    expect(installments[2].installment?.current).toBe(3);

    // Todas as parcelas compartilham o mesmo groupId
    const groupId = installments[0].installment?.groupId;
    expect(groupId).toBeDefined();
    expect(installments[1].installment?.groupId).toBe(groupId);
    expect(installments[2].installment?.groupId).toBe(groupId);
  });
});
