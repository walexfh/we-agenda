import { CalendarItem, FinancialSummary, RecurrenceType, AssistantParsedAction } from '../types';
import { parseCurrencyInput, formatCurrency } from './moneyUtils';
import { formatDateToISO, parseISODateToLocal } from './dateUtils';
import { DEFAULT_TIMEZONE, parseZonedTimeToUtc } from './reminderUtils';

export const DEFAULT_ASSISTANT_NAME = 'Jarves';

/**
 * Remove o nome do assistente no início da frase se presente
 * Ex: "Jarves, gastei 33 no mercado" -> "gastei 33 no mercado"
 */
export function stripAssistantTrigger(text: string, assistantName: string = DEFAULT_ASSISTANT_NAME): string {
  const trimmed = text.trim();
  const escapedName = assistantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedName}[,:\\s]+`, 'i');
  return trimmed.replace(regex, '').trim();
}

/**
 * Extrai quantia monetária em centavos inteiros a partir do texto
 * Suporta formatos: "33 reais e 50 centavos", "R$ 33,50", "33.50", "33 reais", "1200", "1.234,56"
 */
export function extractAmountInCents(text: string): { cents: number; matchedText: string } | null {
  // Padrão 1: "X reais e Y centavos"
  const reaisCentavosMatch = text.match(/(\d+)\s*reais?(?:\s*e\s*(\d+)\s*centavos?)?/i);
  if (reaisCentavosMatch) {
    const reais = parseInt(reaisCentavosMatch[1], 10);
    const centavos = reaisCentavosMatch[2] ? parseInt(reaisCentavosMatch[2], 10) : 0;
    return {
      cents: (reais * 100) + centavos,
      matchedText: reaisCentavosMatch[0]
    };
  }

  // Padrão 2: "R$ 1.234,56" ou "R$ 33,50" ou "33,50"
  const formattedMatch = text.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (formattedMatch) {
    const parseRes = parseCurrencyInput(formattedMatch[1]);
    if (parseRes.success && parseRes.cents) {
      return { cents: parseRes.cents, matchedText: formattedMatch[0] };
    }
  }

  // Padrão 3: "33.50"
  const dotDecimalMatch = text.match(/(?:R\$\s*)?(\d+\.\d{2})/i);
  if (dotDecimalMatch) {
    const parseRes = parseCurrencyInput(dotDecimalMatch[1]);
    if (parseRes.success && parseRes.cents) {
      return { cents: parseRes.cents, matchedText: dotDecimalMatch[0] };
    }
  }

  // Padrão 4: "X reais" ou "R$ X" ou número isolado precedido por preposição/verbo
  const simpleMatch = text.match(/(?:R\$\s*|de\s+|gastei\s+|paguei\s+|recebi\s+|custou\s+)?(\d+)(?:\s*reais|\s*conto)?/i);
  if (simpleMatch) {
    const value = parseInt(simpleMatch[1], 10);
    if (!isNaN(value) && value > 0) {
      return { cents: value * 100, matchedText: simpleMatch[0] };
    }
  }

  return null;
}

/**
 * Extrai data contextual no fuso horário do usuário
 */
export function extractContextDate(text: string, referenceDate: Date = new Date()): { dateStr: string; date: Date; matchedText?: string } {
  const lower = text.toLowerCase();
  const base = new Date(referenceDate);

  if (lower.includes('depois de amanhã')) {
    base.setDate(base.getDate() + 2);
    return { dateStr: formatDateToISO(base), date: base, matchedText: 'depois de amanhã' };
  }

  if (lower.includes('amanhã')) {
    base.setDate(base.getDate() + 1);
    return { dateStr: formatDateToISO(base), date: base, matchedText: 'amanhã' };
  }

  if (lower.includes('ontem')) {
    base.setDate(base.getDate() - 1);
    return { dateStr: formatDateToISO(base), date: base, matchedText: 'ontem' };
  }

  // Padrão: "dia X" (ex: "dia 10", "dia 25")
  const diaMatch = lower.match(/\bdia\s*(\d{1,2})\b/);
  if (diaMatch) {
    const targetDay = parseInt(diaMatch[1], 10);
    if (targetDay >= 1 && targetDay <= 31) {
      const year = base.getFullYear();
      let month = base.getMonth();
      // Se o dia solicitado já passou neste mês por mais de 3 dias, projeta para o próximo mês
      if (base.getDate() > targetDay + 3) {
        month += 1;
      }
      const targetDate = new Date(year, month, targetDay);
      return { dateStr: formatDateToISO(targetDate), date: targetDate, matchedText: diaMatch[0] };
    }
  }

  // Padrão: "DD/MM" ou "DD/MM/AAAA"
  const slashMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : base.getFullYear();
    const targetDate = new Date(year, month, day);
    return { dateStr: formatDateToISO(targetDate), date: targetDate, matchedText: slashMatch[0] };
  }

  // Padrão dias da semana: "segunda", "terça", "quarta", etc.
  const weekDays = [
    { name: 'domingo', dayIndex: 0 },
    { name: 'segunda', dayIndex: 1 },
    { name: 'terça', dayIndex: 2 },
    { name: 'quarta', dayIndex: 3 },
    { name: 'quinta', dayIndex: 4 },
    { name: 'sexta', dayIndex: 5 },
    { name: 'sábado', dayIndex: 6 }
  ];

  for (const wd of weekDays) {
    if (lower.includes(wd.name)) {
      const currentDay = base.getDay();
      let diff = wd.dayIndex - currentDay;
      if (diff <= 0) diff += 7; // Próximo dia da semana
      base.setDate(base.getDate() + diff);
      return { dateStr: formatDateToISO(base), date: base, matchedText: wd.name };
    }
  }

  // Padrão: "hoje" ou data de referência
  return { dateStr: formatDateToISO(base), date: base, matchedText: lower.includes('hoje') ? 'hoje' : undefined };
}

/**
 * Extrai horários de início e término de compromissos
 * Ex: "às 14h", "às 14:30", "das 10h às 11h"
 */
export function extractAppointmentHours(text: string): { startTime: string; endTime: string; matchedText?: string } {
  const lower = text.toLowerCase();

  // Padrão intervalo: "das 10:00 às 11:30" ou "das 14h às 15h"
  const rangeMatch = lower.match(/das\s*(\d{1,2})(?::(\d{2})|h(?:(\d{2}))?)?\s*às\s*(\d{1,2})(?::(\d{2})|h(?:(\d{2}))?)?/);
  if (rangeMatch) {
    const startH = rangeMatch[1].padStart(2, '0');
    const startM = (rangeMatch[2] || rangeMatch[3] || '00').padStart(2, '0');
    const endH = rangeMatch[4].padStart(2, '0');
    const endM = (rangeMatch[5] || rangeMatch[6] || '00').padStart(2, '0');
    return {
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`,
      matchedText: rangeMatch[0]
    };
  }

  // Padrão início único: "às 14h", "às 14:30", "às 9"
  const singleMatch = lower.match(/(?:às|as)\s*(\d{1,2})(?::(\d{2})|h(?:(\d{2}))?)?/);
  if (singleMatch) {
    const hourNum = parseInt(singleMatch[1], 10);
    const startH = hourNum.toString().padStart(2, '0');
    const startM = (singleMatch[2] || singleMatch[3] || '00').padStart(2, '0');
    
    // Término automático 1 hora depois
    const endHourNum = (hourNum + 1) % 24;
    const endH = endHourNum.toString().padStart(2, '0');
    const endM = startM;

    return {
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`,
      matchedText: singleMatch[0]
    };
  }

  // Padrão default
  return { startTime: '09:00', endTime: '10:00' };
}

/**
 * Limpa o texto da descrição removendo termos reconhecidos de valor, data e comandos
 */
function cleanTitleDescription(text: string, toRemove: (string | undefined)[]): string {
  let cleaned = text;
  for (const item of toRemove) {
    if (item && item.trim()) {
      const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'gi'), ' ');
    }
  }

  // Remove conectivos, preposições residuais e pontuação final (. ? ! ,)
  cleaned = cleaned
    .replace(/[.,;!?]+$/g, '')
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|com|no|na|de|do|da|em|para|às|as|dia)\b/gi, ' ')
    .replace(/[.,;!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Se ficou vazio, fallback seguro
  if (!cleaned) return 'Lançamento';
  // Capitaliza a primeira letra
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Motor Principal de NLU do Assistente
 * Interpreta intenções de texto em linguagem natural
 */
export function parseAssistantCommand(
  rawInput: string,
  userTimezone: string = DEFAULT_TIMEZONE,
  assistantName: string = DEFAULT_ASSISTANT_NAME
): AssistantParsedAction {
  const cleanInput = stripAssistantTrigger(rawInput, assistantName);
  const lower = cleanInput.toLowerCase();

  // 1. Consulta de Agenda
  if (
    lower.includes('qual minha agenda') || 
    lower.includes('o que tenho') || 
    lower.includes('quais meus compromissos') ||
    lower.includes('agenda de')
  ) {
    const contextDate = extractContextDate(cleanInput);
    return {
      intent: 'query_schedule',
      confidence: 0.95,
      queryDateStr: contextDate.dateStr,
      explanation: `Consultar agenda para ${contextDate.dateStr}`
    };
  }

  // 2. Consulta de Balanço Financeiro
  if (
    lower.includes('quanto gastei') || 
    lower.includes('qual meu saldo') || 
    lower.includes('quanto tenho a pagar') ||
    lower.includes('resumo financeiro')
  ) {
    return {
      intent: 'query_balance',
      confidence: 0.95,
      explanation: 'Consultar resumo financeiro do período'
    };
  }

  // 3. Despesas (Ex: "gastei 33 reais no mercado", "pagar conta de luz de 150 dia 10")
  const isPastExpense = /\b(gastei|paguei|comprei)\b/i.test(lower);
  const isFutureExpense = /\b(pagar|despesa|vencimento|boleto|conta|fatura|lembrar de pagar)\b/i.test(lower);

  if (isPastExpense || isFutureExpense) {
    const amountResult = extractAmountInCents(cleanInput);
    if (!amountResult || amountResult.cents <= 0) {
      return {
        intent: 'unknown',
        confidence: 0.2,
        explanation: 'Não consegui identificar o valor em reais da despesa. Por favor, informe o valor (ex: "gastei 33 reais no mercado").'
      };
    }

    const contextDate = extractContextDate(cleanInput);
    const title = cleanTitleDescription(cleanInput, [amountResult.matchedText, contextDate.matchedText]);
    const isPaid = isPastExpense; // Se disse "gastei" ou "paguei", está pago. Se disse "pagar conta dia 10", está pendente.

    const itemToSave: Omit<CalendarItem, 'id'> = {
      date: contextDate.date,
      dateStr: contextDate.dateStr,
      type: 'expense',
      title,
      description: `Registrado por ${assistantName} via comando de voz/texto`,
      amountCents: amountResult.cents,
      isPaid,
      alertMinutes: isPaid ? undefined : 0, // se pendente, agenda lembrete no dia às 08h
    };

    const statusText = isPaid ? 'paga' : 'pendente (a pagar)';
    const confirmationMessage = `Pronto! Registrei a despesa ${statusText} de ${formatCurrency(amountResult.cents)} em "${title}" para ${contextDate.dateStr}.`;

    return {
      intent: 'create_expense',
      confidence: 0.95,
      itemToSave,
      recurrence: 'once',
      explanation: `Criar despesa de ${formatCurrency(amountResult.cents)}`,
      confirmationMessage
    };
  }

  // 4. Receitas (Ex: "recebi 1200 de freelance hoje", "a receber 500 dia 20")
  const isPastIncome = /\b(recebi|ganhei|entrou)\b/i.test(lower);
  const isFutureIncome = /\b(receber|receita|salário|venda)\b/i.test(lower);

  if (isPastIncome || isFutureIncome) {
    const amountResult = extractAmountInCents(cleanInput);
    if (!amountResult || amountResult.cents <= 0) {
      return {
        intent: 'unknown',
        confidence: 0.2,
        explanation: 'Não consegui identificar o valor em reais da receita. Por favor, especifique o valor (ex: "recebi 500 reais de comissão").'
      };
    }

    const contextDate = extractContextDate(cleanInput);
    const title = cleanTitleDescription(cleanInput, [amountResult.matchedText, contextDate.matchedText]);
    const isPaid = isPastIncome;

    const itemToSave: Omit<CalendarItem, 'id'> = {
      date: contextDate.date,
      dateStr: contextDate.dateStr,
      type: 'income',
      title,
      description: `Registrado por ${assistantName} via comando de voz/texto`,
      amountCents: amountResult.cents,
      isPaid,
      alertMinutes: isPaid ? undefined : 0,
    };

    const statusText = isPaid ? 'recebida' : 'a receber';
    const confirmationMessage = `Perfeito! Registrei a receita ${statusText} de ${formatCurrency(amountResult.cents)} em "${title}" para ${contextDate.dateStr}.`;

    return {
      intent: 'create_income',
      confidence: 0.95,
      itemToSave,
      recurrence: 'once',
      explanation: `Criar receita de ${formatCurrency(amountResult.cents)}`,
      confirmationMessage
    };
  }

  // 5. Compromissos na Agenda (Ex: "dentista amanhã às 14h", "reunião com cliente dia 15 às 10h")
  const isAppointment = /\b(compromisso|reunião|dentista|médico|consulta|almoço|jantar|treino|aula|academia|agendar|marcar|lembrete)\b/i.test(lower);
  if (isAppointment) {
    const contextDate = extractContextDate(cleanInput);
    const hours = extractAppointmentHours(cleanInput);
    const title = cleanTitleDescription(cleanInput, [hours.matchedText, contextDate.matchedText]);

    const itemToSave: Omit<CalendarItem, 'id'> = {
      date: contextDate.date,
      dateStr: contextDate.dateStr,
      type: 'appointment',
      title,
      description: `Agendado por ${assistantName}`,
      startTime: hours.startTime,
      endTime: hours.endTime,
      color: '#3b82f6',
      alertMinutes: 15, // Lembrete padrão 15 min antes
    };

    const confirmationMessage = `Agendado! Marquei "${title}" em ${contextDate.dateStr} das ${hours.startTime} às ${hours.endTime} com lembrete de 15 min antes.`;

    return {
      intent: 'create_appointment',
      confidence: 0.9,
      itemToSave,
      recurrence: 'once',
      explanation: `Agendar compromisso "${title}"`,
      confirmationMessage
    };
  }

  // Não reconhecido
  return {
    intent: 'unknown',
    confidence: 0,
    explanation: `Olá! Eu sou ${assistantName}. Posso registrar despesas (ex: "gastei 33 no mercado"), receitas, compromissos (ex: "dentista amanhã às 14h") ou consultar sua agenda.`
  };
}
