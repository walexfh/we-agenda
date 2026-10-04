/**
 * Utilitários centralizados para tratamento de valores monetários.
 * Todos os cálculos e armazenamento utilizam centavos inteiros (ex: R$ 33,50 = 3350).
 */

export interface MoneyParseResult {
  success: boolean;
  cents?: number;
  error?: string;
}

/**
 * Formata um valor em centavos inteiros para exibição em Real Brasileiro (BRL).
 * Exemplo: 3350 -> "R$ 33,50"
 */
export function formatCurrency(cents: number | undefined | null): string {
  if (cents === undefined || cents === null || isNaN(cents)) {
    return 'R$ 0,00';
  }
  const reais = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
}

/**
 * Converte centavos inteiros para o texto padrão de edição em formulários (ex: 3350 -> "33,50").
 */
export function centsToInputString(cents: number | undefined | null): string {
  if (cents === undefined || cents === null || isNaN(cents) || cents === 0) {
    return '';
  }
  const reais = (cents / 100).toFixed(2);
  return reais.replace('.', ',');
}

/**
 * Analisa e valida a string digitada pelo usuário no formulário financeiro.
 * Aceita: "33", "33,50", "33.50", "1.234,56", "1234,56", "1234.56", "1,234.56".
 * Rejeita valores negativos, zero, vazios, não finitos e formatos ambíguos.
 */
export function parseCurrencyInput(input: string | undefined | null): MoneyParseResult {
  if (!input) {
    return { success: false, error: 'Informe um valor.' };
  }

  // Remove espaços externos e prefixos como "R$"
  let clean = input.trim().replace(/^R\$\s*/i, '').trim();

  if (clean === '') {
    return { success: false, error: 'Informe um valor.' };
  }

  // Verifica sinais negativos
  if (clean.startsWith('-') || clean.includes('-')) {
    return { success: false, error: 'Valores negativos não são permitidos.' };
  }

  // Não aceita múltiplos pontos e vírgulas anômalos
  const dotCount = (clean.match(/\./g) || []).length;
  const commaCount = (clean.match(/,/g) || []).length;

  if (commaCount > 1 && dotCount > 0) {
    return { success: false, error: 'Formato inválido. Use vírgula apenas para separar centavos.' };
  }

  // Caso 1: Padrão brasileiro completo com milhares e decimais: "1.234,56" ou "1.234.567,89"
  if (dotCount >= 1 && commaCount === 1) {
    const parts = clean.split(',');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Verifica blocos de milhar separados por ponto
    const thousands = integerPart.split('.');
    const firstGroupValid = /^\d{1,3}$/.test(thousands[0]);
    const otherGroupsValid = thousands.slice(1).every(group => /^\d{3}$/.test(group));

    if (!firstGroupValid || !otherGroupsValid) {
      return { success: false, error: 'Formato de milhar inválido (ex: 1.234,56).' };
    }

    if (decimalPart.length > 2) {
      return { success: false, error: 'O valor não pode ter mais de 2 casas decimais de centavos.' };
    }

    const rawDigits = thousands.join('');
    const paddedDecimals = decimalPart.padEnd(2, '0');
    return validateAndReturnCents(rawDigits, paddedDecimals);
  }

  // Caso 2: Padrão internacional com milhares por vírgula e decimal por ponto: "1,234.56"
  if (commaCount >= 1 && dotCount === 1) {
    const parts = clean.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    const thousands = integerPart.split(',');
    const firstGroupValid = /^\d{1,3}$/.test(thousands[0]);
    const otherGroupsValid = thousands.slice(1).every(group => /^\d{3}$/.test(group));

    if (!firstGroupValid || !otherGroupsValid) {
      return { success: false, error: 'Formato de milhar inválido (ex: 1,234.56).' };
    }

    if (decimalPart.length > 2) {
      return { success: false, error: 'O valor não pode ter mais de 2 casas decimais de centavos.' };
    }

    const rawDigits = thousands.join('');
    const paddedDecimals = decimalPart.padEnd(2, '0');
    return validateAndReturnCents(rawDigits, paddedDecimals);
  }

  // Caso 3: Apenas vírgula usada como separador decimal: "33,50", "33,5", "1234,56"
  if (commaCount === 1 && dotCount === 0) {
    const [intPart, decPart] = clean.split(',');
    if (!/^\d+$/.test(intPart) || !/^\d+$/.test(decPart)) {
      return { success: false, error: 'Formato de número inválido.' };
    }
    if (decPart.length > 2) {
      return { success: false, error: 'O valor não pode ter mais de 2 casas decimais de centavos.' };
    }
    return validateAndReturnCents(intPart, decPart.padEnd(2, '0'));
  }

  // Caso 4: Apenas ponto(s) presente(s)
  if (dotCount === 1 && commaCount === 0) {
    const [intPart, decPart] = clean.split('.');
    if (!/^\d+$/.test(intPart) || !/^\d+$/.test(decPart)) {
      return { success: false, error: 'Formato de número inválido.' };
    }
    // Verificação de ambiguidade: se tem exatamente 3 dígitos após o ponto (ex: "1.234"),
    // em pt-BR pode ser 1 milhar (1234) ou 1 real e 234 milésimos. Requer orientação clara!
    if (decPart.length === 3) {
      return {
        success: false,
        error: 'Formato ambíguo ("1.234"). Para milhar digite "1234" ou "1.234,00". Para centavos use vírgula com 2 casas.'
      };
    }
    if (decPart.length > 2) {
      return { success: false, error: 'O valor não pode ter mais de 2 casas decimais de centavos.' };
    }
    // "33.5" -> 33,50 | "33.50" -> 33,50 | "1234.56" -> 1234,56
    return validateAndReturnCents(intPart, decPart.padEnd(2, '0'));
  }

  // Caso 5: Múltiplos pontos sem vírgula: "1.000.000" (milhares estritos sem centavos)
  if (dotCount > 1 && commaCount === 0) {
    const groups = clean.split('.');
    const firstGroupValid = /^\d{1,3}$/.test(groups[0]);
    const otherGroupsValid = groups.slice(1).every(group => /^\d{3}$/.test(group));
    if (firstGroupValid && otherGroupsValid) {
      return validateAndReturnCents(groups.join(''), '00');
    }
    return { success: false, error: 'Formato de milhares com ponto inválido.' };
  }

  // Caso 6: Apenas dígitos inteiros: "33", "1234"
  if (/^\d+$/.test(clean)) {
    return validateAndReturnCents(clean, '00');
  }

  return { success: false, error: 'Formato de valor inválido. Digite números como 33,50 ou 1.234,56.' };
}

function validateAndReturnCents(integerDigits: string, twoDecimalDigits: string): MoneyParseResult {
  const intVal = parseInt(integerDigits, 10);
  const decVal = parseInt(twoDecimalDigits, 10);

  if (isNaN(intVal) || isNaN(decVal) || !isFinite(intVal) || !isFinite(decVal)) {
    return { success: false, error: 'Valor numérico não finito ou inválido.' };
  }

  const cents = intVal * 100 + decVal;

  if (cents <= 0) {
    return { success: false, error: 'O valor deve ser maior que zero.' };
  }

  // Limite razoável para evitar estouro numérico (R$ 100 bilhões)
  if (cents > 10_000_000_000_00) {
    return { success: false, error: 'Valor excede o limite máximo permitido.' };
  }

  return { success: true, cents };
}

/**
 * Converte valor numérico legado (float em reais) para centavos inteiros com arredondamento seguro.
 * Exemplo: 33.5 -> 3350, 33.50 -> 3350, 1234.56 -> 123456
 */
export function legacyFloatToCents(floatVal: number | undefined | null): number {
  if (typeof floatVal !== 'number' || isNaN(floatVal) || !isFinite(floatVal) || floatVal <= 0) {
    return 0;
  }
  return Math.round(floatVal * 100);
}
