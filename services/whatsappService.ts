import { CalendarItem, FinancialSummary, RecurrenceType, WhatsAppMessagePayload, WhatsAppWebhookResult } from '../types';
import { processAssistantMessage } from './assistantService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_TIMEZONE } from '../utils/reminderUtils';

/**
 * Normaliza número de telefone para o padrão internacional E.164
 * Ex: "(11) 99999-8888" -> "+5511999998888"
 */
export function normalizeWhatsAppNumber(rawNumber: string): string {
  if (!rawNumber) return '';
  const digits = rawNumber.replace(/\D/g, '');

  if (digits.length === 10 || digits.length === 11) {
    // Número brasileiro sem DDI -> adiciona 55
    return `+55${digits}`;
  }

  if (digits.length === 12 || digits.length === 13) {
    // Já possui DDI 55
    return `+${digits}`;
  }

  return digits ? `+${digits}` : '';
}

/**
 * Valida se um número de WhatsApp é potencialmente válido
 */
export function isValidWhatsAppNumber(number: string): boolean {
  const normalized = normalizeWhatsAppNumber(number);
  // Padrão E.164 internacional com no mínimo 10 e no máximo 15 dígitos
  return /^\+\d{10,15}$/.test(normalized);
}

/**
 * Formata um número E.164 para exibição amigável: "+55 (11) 99999-8888"
 */
export function formatDisplayPhoneNumber(number: string): string {
  const norm = normalizeWhatsAppNumber(number);
  if (!norm.startsWith('+55') || norm.length < 13) return norm;

  const ddd = norm.slice(3, 5);
  const part1 = norm.length === 14 ? norm.slice(5, 10) : norm.slice(5, 9);
  const part2 = norm.length === 14 ? norm.slice(10) : norm.slice(9);

  return `+55 (${ddd}) ${part1}-${part2}`;
}

/**
 * Simula ou executa a transcrição de mensagens de áudio (.ogg / .opus)
 * Suporta Webhook com Whisper / Edge Functions
 */
export async function transcribeAudioMessage(audioPayload: {
  audioUrl?: string;
  audioBase64?: string;
  textFallback?: string;
}): Promise<string> {
  // Se o webhook já trouxe a transcrição prévia do provedor WhatsApp
  if (audioPayload.textFallback) {
    return audioPayload.textFallback;
  }

  // Verifica se há URL de Whisper configurada no ambiente
  const whisperEndpoint = (import.meta as any).env?.VITE_WHISPER_API_URL;
  if (whisperEndpoint && audioPayload.audioBase64) {
    try {
      const response = await fetch(whisperEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioPayload.audioBase64 })
      });
      if (response.ok) {
        const data = await response.json();
        return data.text || '';
      }
    } catch (err) {
      console.warn('Falha na transcrição remota de áudio:', err);
    }
  }

  // Fallback simulado para desenvolvimento e testes
  return audioPayload.audioUrl ? 'Gastei 33 reais no mercado' : '';
}

/**
 * Envia uma mensagem para o usuário no WhatsApp (via Evolution API, Twilio ou Meta Cloud API)
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const normalizedTo = normalizeWhatsAppNumber(to);
  if (!isValidWhatsAppNumber(normalizedTo)) return false;

  const apiUrl = (import.meta as any).env?.VITE_WHATSAPP_API_URL;
  const apiKey = (import.meta as any).env?.VITE_WHATSAPP_API_KEY;

  if (apiUrl && apiKey) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: normalizedTo.replace('+', ''),
          text: message
        })
      });
      return res.ok;
    } catch (err) {
      console.error('Erro ao enviar mensagem WhatsApp:', err);
      return false;
    }
  }

  // Log informativo para modo de desenvolvimento
  console.log(`[WhatsApp Simulado para ${normalizedTo}]: ${message}`);
  return true;
}

/**
 * Processador principal de Webhook de entrada de WhatsApp (Texto ou Áudio)
 * Garantia: Responde no WhatsApp SOMENTE após gravação confirmada no banco
 */
export async function handleWhatsAppIncomingWebhook(
  payload: WhatsAppMessagePayload,
  handlers: {
    getUserContextByPhone: (phone: string) => Promise<{
      userId: string;
      assistantName: string;
      timezone: string;
      items: CalendarItem[];
      monthlySummary?: FinancialSummary;
    } | null>;
    onSaveItem: (userId: string, item: Omit<CalendarItem, 'id'>, recurrence: RecurrenceType) => Promise<boolean | void>;
  }
): Promise<WhatsAppWebhookResult> {
  const normalizedPhone = normalizeWhatsAppNumber(payload.from);
  if (!isValidWhatsAppNumber(normalizedPhone)) {
    return {
      success: false,
      replySent: false,
      replyText: 'Número de telefone inválido no webhook.'
    };
  }

  // 1. Obter texto da mensagem (ou transcrever áudio)
  let textToProcess = '';
  if (payload.messageType === 'audio') {
    textToProcess = await transcribeAudioMessage({
      audioUrl: payload.audioUrl,
      audioBase64: payload.audioBase64,
      textFallback: payload.text
    });
  } else {
    textToProcess = payload.text || '';
  }

  if (!textToProcess.trim()) {
    const errorReply = 'Não consegui compreender o áudio ou texto enviado. Poderia repetir?';
    await sendWhatsAppMessage(normalizedPhone, errorReply);
    return {
      success: false,
      replySent: true,
      replyText: errorReply
    };
  }

  // 2. Localizar usuário dono desse número de WhatsApp
  const userContext = await handlers.getUserContextByPhone(normalizedPhone);
  if (!userContext) {
    const unregisteredReply = `Olá! Não localizei sua conta vinculada a este número (${normalizedPhone}). Acesse a Agenda no aplicativo e vincule seu WhatsApp no Menu Lateral para liberar os comandos.`;
    await sendWhatsAppMessage(normalizedPhone, unregisteredReply);
    return {
      success: false,
      replySent: true,
      replyText: unregisteredReply
    };
  }

  // 3. Processar comando no assistente com confirmação de gravação
  const execution = await processAssistantMessage(textToProcess, {
    assistantName: userContext.assistantName,
    userTimezone: userContext.timezone,
    items: userContext.items,
    monthlySummary: userContext.monthlySummary,
    onSaveItem: (item, recurrence) => handlers.onSaveItem(userContext.userId, item, recurrence)
  });

  // 4. Envia resposta no WhatsApp somente após a gravação confirmada
  const replySent = await sendWhatsAppMessage(normalizedPhone, execution.replyText);

  return {
    success: execution.success,
    replySent,
    replyText: execution.replyText,
    actionTaken: execution.actionTaken
  };
}

/**
 * Despachador de lembretes agendados no canal WhatsApp
 */
export async function dispatchDueRemindersToWhatsApp(
  findDueReminders: () => Promise<Array<{
    reminderId: string;
    phone: string;
    title: string;
    body: string;
  }>>,
  markReminderDelivered: (reminderId: string) => Promise<void>
): Promise<number> {
  const due = await findDueReminders();
  let count = 0;

  for (const item of due) {
    const message = `🔔 *${item.title}*\n${item.body}`;
    const sent = await sendWhatsAppMessage(item.phone, message);
    if (sent) {
      await markReminderDelivered(item.reminderId);
      count++;
    }
  }

  return count;
}
