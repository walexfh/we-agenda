import { describe, it, expect, vi } from 'vitest';
import { 
  normalizeWhatsAppNumber, 
  isValidWhatsAppNumber, 
  formatDisplayPhoneNumber,
  transcribeAudioMessage,
  handleWhatsAppIncomingWebhook,
  dispatchDueRemindersToWhatsApp
} from '../services/whatsappService';

describe('whatsappService — Integração WhatsApp por Texto e Áudio (Etapa 5)', () => {
  it('normaliza números de telefone brasileiros para padrão internacional E.164', () => {
    expect(normalizeWhatsAppNumber('(11) 99999-8888')).toBe('+5511999998888');
    expect(normalizeWhatsAppNumber('11999998888')).toBe('+5511999998888');
    expect(normalizeWhatsAppNumber('+5511999998888')).toBe('+5511999998888');
    expect(normalizeWhatsAppNumber('5511999998888')).toBe('+5511999998888');
  });

  it('valida números de WhatsApp válidos e rejeita inválidos', () => {
    expect(isValidWhatsAppNumber('+5511999998888')).toBe(true);
    expect(isValidWhatsAppNumber('(21) 98888-7777')).toBe(true);
    expect(isValidWhatsAppNumber('123')).toBe(false);
    expect(isValidWhatsAppNumber('')).toBe(false);
  });

  it('formata número para exibição amigável', () => {
    expect(formatDisplayPhoneNumber('+5511999998888')).toBe('+55 (11) 99999-8888');
  });

  it('processa transcrição de áudio com fallback resiliente', async () => {
    const text = await transcribeAudioMessage({
      audioUrl: 'https://example.com/audio.ogg'
    });
    expect(text).toBe('Gastei 33 reais no mercado');
  });

  it('processa mensagem recebida via webhook com confirmação transacional', async () => {
    const saveMock = vi.fn().mockResolvedValue(true);
    const getUserMock = vi.fn().mockResolvedValue({
      userId: 'user-abc',
      assistantName: 'Jarves',
      timezone: 'America/Sao_Paulo',
      items: []
    });

    const webhookResult = await handleWhatsAppIncomingWebhook(
      {
        from: '+5511999998888',
        messageType: 'text',
        text: 'Jarves, gastei 33 reais no mercado.'
      },
      {
        getUserContextByPhone: getUserMock,
        onSaveItem: saveMock
      }
    );

    // 1. Localizou usuário pelo telefone
    expect(getUserMock).toHaveBeenCalledWith('+5511999998888');

    // 2. Gravou a despesa antes de responder
    expect(saveMock).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({
        type: 'expense',
        amountCents: 3300,
        isPaid: true
      }),
      'once'
    );

    // 3. Respondeu com confirmação da gravação
    expect(webhookResult.success).toBe(true);
    expect(webhookResult.replySent).toBe(true);
    expect(webhookResult.replyText).toMatch(/33,00/);
  });

  it('informa educadamente caso o número não esteja vinculado', async () => {
    const saveMock = vi.fn();
    const getUserMock = vi.fn().mockResolvedValue(null); // Usuário não encontrado

    const webhookResult = await handleWhatsAppIncomingWebhook(
      {
        from: '+5521999990000',
        messageType: 'text',
        text: 'Jarves, gastei 50 reais'
      },
      {
        getUserContextByPhone: getUserMock,
        onSaveItem: saveMock
      }
    );

    // Não gravou nada
    expect(saveMock).not.toHaveBeenCalled();
    expect(webhookResult.success).toBe(false);
    expect(webhookResult.replyText).toContain('Não localizei sua conta');
  });

  it('despacha lembretes devidos para o canal WhatsApp', async () => {
    const mockDue = [
      {
        reminderId: 'rem-1',
        phone: '+5511999998888',
        title: 'Vencimento de Conta',
        body: 'Fatura de Luz no valor de R$ 120,00'
      }
    ];

    const markDeliveredMock = vi.fn().mockResolvedValue(undefined);

    const count = await dispatchDueRemindersToWhatsApp(
      async () => mockDue,
      markDeliveredMock
    );

    expect(count).toBe(1);
    expect(markDeliveredMock).toHaveBeenCalledWith('rem-1');
  });
});
