import { describe, it, expect } from 'vitest';
import { 
  formatDateToISO, 
  parseISODateToLocal, 
  normalizeLegacyDate, 
  isEndTimeAfterStartTime 
} from '../utils/dateUtils';

describe('dateUtils - Manipulação de Datas sem Deslocamento de Fuso', () => {
  it('converte e normaliza strings YYYY-MM-DD sem alterar o dia no calendário local', () => {
    const inputISO = '2026-10-04';
    const parsedDate = parseISODateToLocal(inputISO);

    // O dia deve ser exatamente 4, independente do timezone
    expect(parsedDate.getDate()).toBe(4);
    expect(parsedDate.getMonth()).toBe(9); // Outubro = mês 9 (0-indexed)
    expect(parsedDate.getFullYear()).toBe(2026);

    const backToISO = formatDateToISO(parsedDate);
    expect(backToISO).toBe(inputISO);
  });

  it('normaliza datas legadas preservando o dia exibido no ambiente atual', () => {
    // String ISO com timezone UTC (onde midnight UTC poderia recuar para o dia anterior no Brasil GMT-3)
    const legacyStr = '2026-10-04T00:00:00.000Z';
    const normalized = normalizeLegacyDate(legacyStr);

    // Deve ser preservado como dia local válido
    expect(normalized.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatDateToISO(normalized.date)).toBe(normalized.dateStr);
  });

  it('valida corretamente horários no mesmo dia exigindo término posterior ao início', () => {
    // Válidos (término posterior)
    expect(isEndTimeAfterStartTime('09:00', '10:00')).toBe(true);
    expect(isEndTimeAfterStartTime('08:30', '08:45')).toBe(true);
    expect(isEndTimeAfterStartTime('14:00', '14:01')).toBe(true);

    // Inválidos (horários iguais ou término anterior)
    expect(isEndTimeAfterStartTime('10:00', '10:00')).toBe(false);
    expect(isEndTimeAfterStartTime('15:00', '14:00')).toBe(false);
    expect(isEndTimeAfterStartTime('23:00', '01:00')).toBe(false); // Virada de dia não permitida nesta versão
    expect(isEndTimeAfterStartTime('', '10:00')).toBe(false);
    expect(isEndTimeAfterStartTime('10:00', '')).toBe(false);
  });
});
