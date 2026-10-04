import { CalendarItem, FinancialSummary, RecurrenceType, AssistantParsedAction } from '../types';
import { parseAssistantCommand, DEFAULT_ASSISTANT_NAME } from '../utils/assistantEngine';
import { formatCurrency } from '../utils/moneyUtils';
import { DEFAULT_TIMEZONE } from '../utils/reminderUtils';

export interface AssistantExecutionResult {
  success: boolean;
  replyText: string;
  actionTaken?: AssistantParsedAction['intent'];
  createdItem?: Omit<CalendarItem, 'id'>;
}

/**
 * Executa o comando do assistente com garantia estrita de confirmação transacional:
 * "responder somente depois de confirmar a gravação."
 */
export async function processAssistantMessage(
  message: string,
  options: {
    assistantName?: string;
    userTimezone?: string;
    items?: CalendarItem[];
    monthlySummary?: FinancialSummary;
    onSaveItem: (item: Omit<CalendarItem, 'id'>, recurrence: RecurrenceType) => Promise<boolean | void>;
  }
): Promise<AssistantExecutionResult> {
  const {
    assistantName = DEFAULT_ASSISTANT_NAME,
    userTimezone = DEFAULT_TIMEZONE,
    items = [],
    monthlySummary,
    onSaveItem
  } = options;

  if (!message || !message.trim()) {
    return {
      success: false,
      replyText: `Oi! Como posso te ajudar hoje? Você pode ditar ou digitar despesas, receitas ou compromissos.`
    };
  }

  // 1. Interpretação NLU
  const parsed = parseAssistantCommand(message, userTimezone, assistantName);

  // 2. Consulta de Agenda
  if (parsed.intent === 'query_schedule' && parsed.queryDateStr) {
    const dayItems = items.filter(i => i.dateStr === parsed.queryDateStr);
    if (dayItems.length === 0) {
      return {
        success: true,
        actionTaken: 'query_schedule',
        replyText: `Você não tem compromissos ou vencimentos registrados para ${parsed.queryDateStr}.`
      };
    }

    const lines: string[] = [`Agenda para ${parsed.queryDateStr}:`];
    for (const item of dayItems) {
      if (item.type === 'appointment') {
        lines.push(`• 📅 ${item.title} (${item.startTime || '09:00'} - ${item.endTime || '10:00'})`);
      } else if (item.type === 'expense') {
        const status = item.isPaid ? 'pago' : 'a pagar';
        lines.push(`• 💸 ${item.title}: ${item.amountCents ? formatCurrency(item.amountCents) : ''} (${status})`);
      } else {
        const status = item.isPaid ? 'recebido' : 'a receber';
        lines.push(`• 💰 ${item.title}: ${item.amountCents ? formatCurrency(item.amountCents) : ''} (${status})`);
      }
    }

    return {
      success: true,
      actionTaken: 'query_schedule',
      replyText: lines.join('\n')
    };
  }

  // 3. Consulta de Balanço Financeiro
  if (parsed.intent === 'query_balance') {
    if (!monthlySummary) {
      return {
        success: true,
        actionTaken: 'query_balance',
        replyText: 'Não encontrei dados suficientes para calcular o resumo financeiro deste mês.'
      };
    }

    const reply = [
      `📊 Resumo Financeiro do Mês:`,
      `• Despesas pagas: ${formatCurrency(monthlySummary.expensePaidCents)}`,
      `• Contas a pagar pendentes: ${formatCurrency(monthlySummary.expensePendingCents)}`,
      `• Receitas recebidas: ${formatCurrency(monthlySummary.incomeReceivedCents)}`,
      `• Contas a receber pendentes: ${formatCurrency(monthlySummary.incomePendingCents)}`,
      `• Saldo realizado atual: ${formatCurrency(monthlySummary.realizedResultCents)}`
    ].join('\n');

    return {
      success: true,
      actionTaken: 'query_balance',
      replyText: reply
    };
  }

  // 4. Criação de Despesa, Receita ou Compromisso (Gravação Obrigatória ANTES da resposta)
  if (
    (parsed.intent === 'create_expense' || parsed.intent === 'create_income' || parsed.intent === 'create_appointment') &&
    parsed.itemToSave
  ) {
    try {
      // Gravação real persistida
      const saveResult = await onSaveItem(parsed.itemToSave, parsed.recurrence || 'once');
      
      // Se saveResult for explicitamente false, houve falha de validação ou persistência
      if (saveResult === false) {
        return {
          success: false,
          replyText: 'Tive uma dificuldade para salvar esse registro no seu calendário. Poderia conferir as informações e tentar novamente?'
        };
      }

      // Responde SOMENTE após confirmação bem-sucedida da gravação
      return {
        success: true,
        actionTaken: parsed.intent,
        createdItem: parsed.itemToSave,
        replyText: parsed.confirmationMessage || 'Registro salvo com sucesso no seu calendário!'
      };
    } catch (err: any) {
      return {
        success: false,
        replyText: `Erro ao gravar o registro: ${err?.message || 'Falha inesperada'}. Nada foi gravado incorretamente.`
      };
    }
  }

  // Fallback para intenções desconhecidas
  return {
    success: false,
    replyText: parsed.explanation
  };
}
