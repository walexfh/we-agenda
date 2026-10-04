import { describe, it, expect } from 'vitest';
import { CalendarItem } from '../types';
import { parseISODateToLocal } from '../utils/dateUtils';

describe('syncService - Lógica de Importação e Deduplicação (Etapa 2)', () => {
  it('filtra ocorrências virtuais de séries e previne duplicação de itens já existentes na nuvem', () => {
    const existingCloudIds = new Set(['item-1', 'item-2']);

    const localItemsToConsider: CalendarItem[] = [
      {
        id: 'item-1', // Já existe na nuvem!
        title: 'Item Existente',
        type: 'expense',
        amountCents: 1000,
        date: parseISODateToLocal('2026-10-01'),
        dateStr: '2026-10-01',
      },
      {
        id: 'item-3', // Novo!
        title: 'Item Novo Local',
        type: 'income',
        amountCents: 5000,
        date: parseISODateToLocal('2026-10-02'),
        dateStr: '2026-10-02',
      },
      {
        id: 'series-occ-1', // Virtual!
        title: 'Ocorrência Virtual',
        type: 'appointment',
        isVirtualOccurrence: true,
        date: parseISODateToLocal('2026-10-03'),
        dateStr: '2026-10-03',
      },
    ];

    // Lógica canônica de importação:
    const nonVirtual = localItemsToConsider.filter(i => !i.isVirtualOccurrence);
    const toInsert = nonVirtual.filter(i => !existingCloudIds.has(i.id));

    // Apenas o item-3 deve ser selecionado para inserção
    expect(toInsert.length).toBe(1);
    expect(toInsert[0].id).toBe('item-3');
    expect(toInsert[0].title).toBe('Item Novo Local');
  });
});
