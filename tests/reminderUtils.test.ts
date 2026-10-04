import { describe, it, expect } from 'vitest';
import { 
  isValidTimezone, 
  parseZonedTimeToUtc, 
  formatAdvanceMinutes, 
  calculateScheduledReminderTime, 
  createReminderFromItem,
  canTransitionReminderStatus,
  DEFAULT_TIMEZONE
} from '../utils/reminderUtils';
import { CalendarItem } from '../types';

describe('reminderUtils — Fuso Horário e Agendamento de Lembretes (Etapa 3)', () => {
  it('valida identificadores IANA de fuso horário suportados', () => {
    expect(isValidTimezone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Europe/Lisbon')).toBe(true);
    expect(isValidTimezone('Invalid/Fuso_Inexistente')).toBe(false);
  });

  it('converte horário local de fuso horário em UTC com exatidão', () => {
    // 2026-10-15 às 10:00 em America/Sao_Paulo (UTC-3) deve resultar em 13:00 UTC
    const utcDate = parseZonedTimeToUtc('2026-10-15', '10:00', 'America/Sao_Paulo');
    expect(utcDate.toISOString()).toBe('2026-10-15T13:00:00.000Z');
  });

  it('formata texto de antecipação amigável', () => {
    expect(formatAdvanceMinutes(0)).toBe('No horário');
    expect(formatAdvanceMinutes(5)).toBe('5 minutos antes');
    expect(formatAdvanceMinutes(10)).toBe('10 minutos antes');
    expect(formatAdvanceMinutes(30)).toBe('30 minutos antes');
    expect(formatAdvanceMinutes(60)).toBe('1 hora antes');
    expect(formatAdvanceMinutes(120)).toBe('2 horas antes');
    expect(formatAdvanceMinutes(1440)).toBe('1 dia antes');
    expect(formatAdvanceMinutes(2880)).toBe('2 dias antes');
  });

  it('calcula o momento exato do lembrete respeitando a antecipação', () => {
    const appointment: CalendarItem = {
      id: 'apt-1',
      date: new Date(2026, 9, 15),
      dateStr: '2026-10-15',
      type: 'appointment',
      title: 'Consulta Médica',
      startTime: '10:00',
      endTime: '11:00',
      alertMinutes: 30, // 30 minutos antes
    };

    const scheduled = calculateScheduledReminderTime(appointment, 'America/Sao_Paulo');
    expect(scheduled).not.toBeNull();
    // 10:00 em SP = 13:00 UTC. 30 min antes = 12:30 UTC.
    expect(scheduled?.scheduledIso).toBe('2026-10-15T12:30:00.000Z');
  });

  it('cancela lembrete para lançamentos financeiros já pagos', () => {
    const paidBill: CalendarItem = {
      id: 'fin-1',
      date: new Date(2026, 9, 15),
      dateStr: '2026-10-15',
      type: 'expense',
      title: 'Fatura de Luz',
      amountCents: 15000,
      alertMinutes: 1440,
      isPaid: true, // Já paga!
    };

    const scheduled = calculateScheduledReminderTime(paidBill, 'America/Sao_Paulo');
    expect(scheduled).toBeNull();
  });

  it('gera lembrete com título e corpo adequados para compromisso e despesa', () => {
    const expense: CalendarItem = {
      id: 'exp-10',
      date: new Date(2026, 9, 20),
      dateStr: '2026-10-20',
      type: 'expense',
      title: 'Aluguel',
      amountCents: 185000, // R$ 1.850,00
      alertMinutes: 0,
      isPaid: false,
    };

    const reminder = createReminderFromItem(expense, 'user-123', 'America/Sao_Paulo');
    expect(reminder).not.toBeNull();
    expect(reminder?.title).toContain('Aluguel');
    expect(reminder?.body).toContain('R$');
    expect(reminder?.timezone).toBe('America/Sao_Paulo');
    expect(reminder?.status).toBe('scheduled');
  });

  it('valida máquina de estados de transição de lembrete', () => {
    expect(canTransitionReminderStatus('scheduled', 'sent')).toBe(true);
    expect(canTransitionReminderStatus('sent', 'delivered')).toBe(true);
    expect(canTransitionReminderStatus('delivered', 'dismissed')).toBe(true);
    expect(canTransitionReminderStatus('dismissed', 'scheduled')).toBe(false);
  });
});
