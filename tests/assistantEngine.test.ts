import { describe, it, expect, vi } from 'vitest';
import { 
  stripAssistantTrigger, 
  extractAmountInCents, 
  parseAssistantCommand, 
  DEFAULT_ASSISTANT_NAME 
} from '../utils/assistantEngine';
import { processAssistantMessage } from '../services/assistantService';
import { CalendarItem, FinancialSummary } from '../types';

describe('assistantEngine — NLU e Assistente Pessoal (Etapa 4)', () => {
  it('remove o nome do assistente no início do comando', () => {
    expect(stripAssistantTrigger('Jarves, gastei 33 reais no mercado', 'Jarves')).toBe('gastei 33 reais no mercado');
    expect(stripAssistantTrigger('Jarves: marcar dentista às 14h', 'Jarves')).toBe('marcar dentista às 14h');
    expect(stripAssistantTrigger('Mia, bom dia', 'Mia')).toBe('bom dia');
    expect(stripAssistantTrigger('gastei 33 no mercado', 'Jarves')).toBe('gastei 33 no mercado');
  });

  it('extrai quantias monetárias com precisão inteira em centavos', () => {
    expect(extractAmountInCents('gastei 33 reais no mercado')?.cents).toBe(3300);
    expect(extractAmountInCents('gastei 33 reais e 50 centavos')?.cents).toBe(3350);
    expect(extractAmountInCents('almoço de R$ 42,90')?.cents).toBe(4290);
    expect(extractAmountInCents('comprei por 15.50')?.cents).toBe(1550);
    expect(extractAmountInCents('recebi 1200 de freelance')?.cents).toBe(120000);
    expect(extractAmountInCents('paguei 50 conto na feira')?.cents).toBe(5000);
  });

  it('interpreta o caso de uso obrigatório: "Jarves, gastei 33 reais no mercado."', () => {
    const command = 'Jarves, gastei 33 reais no mercado.';
    const parsed = parseAssistantCommand(command, 'America/Sao_Paulo', 'Jarves');

    expect(parsed.intent).toBe('create_expense');
    expect(parsed.itemToSave).toBeDefined();
    expect(parsed.itemToSave?.type).toBe('expense');
    expect(parsed.itemToSave?.amountCents).toBe(3300);
    expect(parsed.itemToSave?.isPaid).toBe(true); // Gasto já efetuado
    expect(parsed.itemToSave?.title).toBe('Mercado');
    expect(parsed.confirmationMessage).toMatch(/33,00/);
  });

  it('interpreta agendamento de compromisso: "Dentista amanhã às 14h"', () => {
    const command = 'Dentista amanhã às 14h';
    const parsed = parseAssistantCommand(command, 'America/Sao_Paulo', 'Jarves');

    expect(parsed.intent).toBe('create_appointment');
    expect(parsed.itemToSave?.type).toBe('appointment');
    expect(parsed.itemToSave?.startTime).toBe('14:00');
    expect(parsed.itemToSave?.endTime).toBe('15:00');
    expect(parsed.itemToSave?.title).toContain('Dentista');
    expect(parsed.itemToSave?.alertMinutes).toBe(15);
  });

  it('interpreta registro de receita: "Recebi 1200 de freelance hoje"', () => {
    const command = 'Recebi 1200 de freelance hoje';
    const parsed = parseAssistantCommand(command, 'America/Sao_Paulo', 'Jarves');

    expect(parsed.intent).toBe('create_income');
    expect(parsed.itemToSave?.type).toBe('income');
    expect(parsed.itemToSave?.amountCents).toBe(120000); // R$ 1.200,00
    expect(parsed.itemToSave?.isPaid).toBe(true);
    expect(parsed.itemToSave?.title).toContain('Freelance');
  });

  it('interpreta consulta de agenda', () => {
    const command = 'Jarves, qual minha agenda de hoje?';
    const parsed = parseAssistantCommand(command, 'America/Sao_Paulo', 'Jarves');

    expect(parsed.intent).toBe('query_schedule');
    expect(parsed.queryDateStr).toBeDefined();
  });

  it('interpreta consulta de balanço financeiro', () => {
    const command = 'Quanto gastei este mês?';
    const parsed = parseAssistantCommand(command, 'America/Sao_Paulo', 'Jarves');

    expect(parsed.intent).toBe('query_balance');
  });
});

describe('assistantService — Garantia Transacional de Gravação Antes da Resposta', () => {
  it('grava o item no armazenamento ANTES de confirmar ao usuário', async () => {
    const saveMock = vi.fn().mockResolvedValue(true);

    const result = await processAssistantMessage('Jarves, gastei 33 reais no mercado.', {
      assistantName: 'Jarves',
      onSaveItem: saveMock
    });

    // 1. O gravador foi chamado
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amountCents: 3300,
        isPaid: true
      }),
      'once'
    );

    // 2. A confirmação só é retornada após o sucesso da gravação
    expect(result.success).toBe(true);
    expect(result.replyText).toMatch(/33,00/);
  });

  it('não retorna confirmação de sucesso se a gravação falhar', async () => {
    const saveMock = vi.fn().mockResolvedValue(false); // Falha de validação/persistência

    const result = await processAssistantMessage('Jarves, gastei 33 reais no mercado.', {
      assistantName: 'Jarves',
      onSaveItem: saveMock
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.replyText).toContain('dificuldade para salvar');
  });
});
