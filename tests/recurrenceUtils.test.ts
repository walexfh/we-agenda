import { describe, it, expect } from 'vitest';
import { 
  calculateMonthlyOccurrenceDate, 
  generateOccurrencesForInterval, 
  deleteSingleOccurrence, 
  deleteFutureOccurrences, 
  updateSingleOccurrence, 
  splitAndAdvanceSeries, 
  toggleSeriesOccurrencePaid 
} from '../utils/recurrenceUtils';
import { RecurrenceSeries } from '../types';
import { parseISODateToLocal } from '../utils/dateUtils';

describe('recurrenceUtils - Recorrências e Séries', () => {
  it('calcula recorrência mensal no dia 31 em ano bissexto e não bissexto restaurando o dia 31', () => {
    // Ano bissexto 2024:
    // Janeiro (31) -> Fevereiro (29) -> Março (31) -> Abril (30) -> Maio (31)
    const jan2024 = calculateMonthlyOccurrenceDate(2024, 0, 31, 0);
    expect(jan2024).toBe('2024-01-31');

    const feb2024 = calculateMonthlyOccurrenceDate(2024, 0, 31, 1);
    expect(feb2024).toBe('2024-02-29'); // Ano bissexto tem 29 dias

    const mar2024 = calculateMonthlyOccurrenceDate(2024, 0, 31, 2);
    expect(mar2024).toBe('2024-03-31'); // Retorna ao dia 31

    const apr2024 = calculateMonthlyOccurrenceDate(2024, 0, 31, 3);
    expect(apr2024).toBe('2024-04-30'); // Abril tem 30 dias

    const may2024 = calculateMonthlyOccurrenceDate(2024, 0, 31, 4);
    expect(may2024).toBe('2024-05-31'); // Retorna ao dia 31

    // Ano comum 2026 (fevereiro com 28 dias):
    const feb2026 = calculateMonthlyOccurrenceDate(2026, 0, 31, 1);
    expect(feb2026).toBe('2026-02-28');

    const mar2026 = calculateMonthlyOccurrenceDate(2026, 0, 31, 2);
    expect(mar2026).toBe('2026-03-31');
  });

  it('gera apenas as ocorrências para o intervalo consultado (sem listas infinitas nem limite arbitrário de 12)', () => {
    const series: RecurrenceSeries = {
      id: 'series-daily-test',
      rule: {
        seriesId: 'series-daily-test',
        frequency: 'daily',
        startDate: '2026-01-01',
      },
      templateItem: {
        type: 'expense',
        title: 'Café Diário',
        amountCents: 500,
        isPaid: false,
      },
      exceptions: {},
    };

    // Consulta intervalo de 10 dias em outubro de 2026 (mesmo sem limite de término)
    const start = parseISODateToLocal('2026-10-01');
    const end = parseISODateToLocal('2026-10-10');

    const occurrences = generateOccurrencesForInterval(series, start, end);
    expect(occurrences.length).toBe(10);
    expect(occurrences[0].dateStr).toBe('2026-10-01');
    expect(occurrences[9].dateStr).toBe('2026-10-10');
  });

  it('exclui apenas uma ocorrência pontual sem afetar as demais', () => {
    const series: RecurrenceSeries = {
      id: 'series-weekly-test',
      rule: {
        seriesId: 'series-weekly-test',
        frequency: 'weekly',
        startDate: '2026-10-01',
      },
      templateItem: {
        type: 'appointment',
        title: 'Reunião de Equipe',
      },
      exceptions: {},
    };

    // Ocorrências esperadas: 2026-10-01, 2026-10-08, 2026-10-15, 2026-10-22
    const start = parseISODateToLocal('2026-10-01');
    const end = parseISODateToLocal('2026-10-25');

    const beforeDelete = generateOccurrencesForInterval(series, start, end);
    expect(beforeDelete.length).toBe(4);

    // Exclui a ocorrência de 2026-10-08
    const updatedSeries = deleteSingleOccurrence(series, '2026-10-08');
    const afterDelete = generateOccurrencesForInterval(updatedSeries, start, end);

    expect(afterDelete.length).toBe(3);
    expect(afterDelete.find(it => it.dateStr === '2026-10-08')).toBeUndefined();
    expect(afterDelete.find(it => it.dateStr === '2026-10-01')).toBeDefined();
    expect(afterDelete.find(it => it.dateStr === '2026-10-15')).toBeDefined();
  });

  it('exclui esta e as futuras ocorrências preservando ocorrências anteriores', () => {
    const series: RecurrenceSeries = {
      id: 'series-monthly-test',
      rule: {
        seriesId: 'series-monthly-test',
        frequency: 'monthly',
        startDate: '2026-01-10',
        originalDayOfMonth: 10,
      },
      templateItem: {
        type: 'income',
        title: 'Aluguel Recebido',
        amountCents: 200000,
        isPaid: true,
      },
      exceptions: {},
    };

    // Exclui a partir de 2026-04-10 em diante
    const updated = deleteFutureOccurrences(series, '2026-04-10');
    expect(updated).not.toBeNull();
    expect(updated!.rule.endDate).toBe('2026-04-09');

    // Verifica que janeiro, fevereiro e março continuam existindo
    const intervalAll = generateOccurrencesForInterval(
      updated!,
      parseISODateToLocal('2026-01-01'),
      parseISODateToLocal('2026-12-31')
    );
    expect(intervalAll.length).toBe(3);
    expect(intervalAll.map(o => o.dateStr)).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
  });

  it('altera apenas uma ocorrência pontual via override sem alterar o template da série', () => {
    const series: RecurrenceSeries = {
      id: 'series-edit-single',
      rule: {
        seriesId: 'series-edit-single',
        frequency: 'weekly',
        startDate: '2026-10-01',
      },
      templateItem: {
        type: 'expense',
        title: 'Treino',
        amountCents: 5000,
      },
      exceptions: {},
    };

    // Altera apenas o dia 2026-10-08
    const updated = updateSingleOccurrence(series, '2026-10-08', {
      title: 'Treino Especial',
      amountCents: 7500,
    });

    const occurrences = generateOccurrencesForInterval(
      updated,
      parseISODateToLocal('2026-10-01'),
      parseISODateToLocal('2026-10-15')
    );

    const oct01 = occurrences.find(o => o.dateStr === '2026-10-01')!;
    const oct08 = occurrences.find(o => o.dateStr === '2026-10-08')!;
    const oct15 = occurrences.find(o => o.dateStr === '2026-10-15')!;

    expect(oct01.title).toBe('Treino');
    expect(oct01.amountCents).toBe(5000);

    expect(oct08.title).toBe('Treino Especial');
    expect(oct08.amountCents).toBe(7500);

    expect(oct15.title).toBe('Treino');
    expect(oct15.amountCents).toBe(5000);
  });

  it('alterar esta e as próximas recalcula a série e preserva o histórico anterior sem duplicidades', () => {
    const series: RecurrenceSeries = {
      id: 'series-advance-test',
      rule: {
        seriesId: 'series-advance-test',
        frequency: 'monthly',
        startDate: '2026-01-05',
        originalDayOfMonth: 5,
      },
      templateItem: {
        type: 'expense',
        title: 'Internet Antiga',
        amountCents: 10000,
      },
      exceptions: {},
    };

    // A partir de 2026-03-05, altera para "Fibra 500MB" por R$ 130,00
    const { updatedOldSeries, newSeries } = splitAndAdvanceSeries(
      series,
      '2026-03-05',
      {
        type: 'expense',
        title: 'Fibra 500MB',
        amountCents: 13000,
      },
      '2026-03-05',
      'series-advance-new'
    );

    expect(updatedOldSeries).not.toBeNull();
    expect(updatedOldSeries!.rule.endDate).toBe('2026-03-04');

    // Histórico da série antiga: janeiro e fevereiro
    const oldOccurrences = generateOccurrencesForInterval(
      updatedOldSeries!,
      parseISODateToLocal('2026-01-01'),
      parseISODateToLocal('2026-12-31')
    );
    expect(oldOccurrences.length).toBe(2);
    expect(oldOccurrences[0].title).toBe('Internet Antiga');
    expect(oldOccurrences[1].title).toBe('Internet Antiga');

    // Nova série a partir de março
    const newOccurrences = generateOccurrencesForInterval(
      newSeries,
      parseISODateToLocal('2026-01-01'),
      parseISODateToLocal('2026-05-31')
    );
    expect(newOccurrences.length).toBe(3); // Março, Abril, Maio
    expect(newOccurrences[0].dateStr).toBe('2026-03-05');
    expect(newOccurrences[0].title).toBe('Fibra 500MB');
    expect(newOccurrences[0].amountCents).toBe(13000);
  });

  it('pagamento de uma ocorrência não marca todas como pagas', () => {
    const series: RecurrenceSeries = {
      id: 'series-paid-test',
      rule: {
        seriesId: 'series-paid-test',
        frequency: 'monthly',
        startDate: '2026-01-15',
        originalDayOfMonth: 15,
      },
      templateItem: {
        type: 'expense',
        title: 'Condomínio',
        amountCents: 45000,
        isPaid: false,
      },
      exceptions: {},
    };

    // Marca apenas o mês de janeiro como pago
    const updated = toggleSeriesOccurrencePaid(series, '2026-01-15', false);

    const occurrences = generateOccurrencesForInterval(
      updated,
      parseISODateToLocal('2026-01-01'),
      parseISODateToLocal('2026-03-31')
    );

    const jan = occurrences.find(o => o.dateStr === '2026-01-15')!;
    const feb = occurrences.find(o => o.dateStr === '2026-02-15')!;
    const mar = occurrences.find(o => o.dateStr === '2026-03-15')!;

    expect(jan.isPaid).toBe(true);
    expect(feb.isPaid).toBe(false); // Mantém pendente!
    expect(mar.isPaid).toBe(false); // Mantém pendente!
  });
});
