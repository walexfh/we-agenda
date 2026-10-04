import { describe, it, expect } from 'vitest';
import { 
  parseCurrencyInput, 
  formatCurrency, 
  centsToInputString, 
  legacyFloatToCents 
} from '../utils/moneyUtils';

describe('moneyUtils - Conversão e Validação de Valores Monetários', () => {
  it('converte corretamente formatos monetários descritos na especificação', () => {
    // "33" -> 3300 centavos
    const r1 = parseCurrencyInput('33');
    expect(r1.success).toBe(true);
    expect(r1.cents).toBe(3300);

    // "33,50" -> 3350 centavos
    const r2 = parseCurrencyInput('33,50');
    expect(r2.success).toBe(true);
    expect(r2.cents).toBe(3350);

    // "33.50" -> 3350 centavos
    const r3 = parseCurrencyInput('33.50');
    expect(r3.success).toBe(true);
    expect(r3.cents).toBe(3350);

    // "1.234,56" -> 123456 centavos
    const r4 = parseCurrencyInput('1.234,56');
    expect(r4.success).toBe(true);
    expect(r4.cents).toBe(123456);

    // "1234,56" e "1234.56"
    expect(parseCurrencyInput('1234,56').cents).toBe(123456);
    expect(parseCurrencyInput('1234.56').cents).toBe(123456);

    // Com prefixo "R$"
    expect(parseCurrencyInput('R$ 33,50').cents).toBe(3350);
    expect(parseCurrencyInput('R$1.234,56').cents).toBe(123456);
  });

  it('rejeita valores negativos, zero, vazios e não finitos', () => {
    // Negativos
    expect(parseCurrencyInput('-33').success).toBe(false);
    expect(parseCurrencyInput('-33,50').success).toBe(false);

    // Zero
    expect(parseCurrencyInput('0').success).toBe(false);
    expect(parseCurrencyInput('0,00').success).toBe(false);
    expect(parseCurrencyInput('0.00').success).toBe(false);

    // Vazio ou espaços
    expect(parseCurrencyInput('').success).toBe(false);
    expect(parseCurrencyInput('   ').success).toBe(false);
    expect(parseCurrencyInput(null).success).toBe(false);

    // Texto inválido
    expect(parseCurrencyInput('abc').success).toBe(false);
    expect(parseCurrencyInput('33 reais').success).toBe(false);
  });

  it('identifica e rejeita formatos ambíguos com orientação clara', () => {
    // "1.234" tem 3 dígitos após ponto sem vírgula (ambíguo em pt-BR)
    const result = parseCurrencyInput('1.234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ambíguo');

    // Mais de 2 casas decimais
    const resultDec = parseCurrencyInput('33,555');
    expect(resultDec.success).toBe(false);
    expect(resultDec.error).toContain('2 casas decimais');
  });

  it('garante que editar e salvar um valor não o multiplique nem o arredonde indevidamente', () => {
    const originalCents = 3350;
    const inputString = centsToInputString(originalCents);
    expect(inputString).toBe('33,50');

    const parsedBack = parseCurrencyInput(inputString);
    expect(parsedBack.success).toBe(true);
    expect(parsedBack.cents).toBe(originalCents);

    // Teste com valor maior
    const largeCents = 123456;
    const largeString = centsToInputString(largeCents);
    expect(largeString).toBe('1234,56');
    const parsedLarge = parseCurrencyInput(largeString);
    expect(parsedLarge.cents).toBe(largeCents);
  });

  it('formata centavos para Real Brasileiro de forma padronizada', () => {
    // Remove caracteres não-quebráveis (nbsp: \u00a0 / \u202f) para comparação consistente
    const cleanBrl = (str: string) => str.replace(/\s/g, ' ').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
    expect(cleanBrl(formatCurrency(3350))).toContain('33,50');
    expect(cleanBrl(formatCurrency(123456))).toContain('1.234,56');
    expect(cleanBrl(formatCurrency(0))).toContain('0,00');
  });

  it('converte corretamente float legado para centavos inteiros', () => {
    expect(legacyFloatToCents(33.5)).toBe(3350);
    expect(legacyFloatToCents(33.50)).toBe(3350);
    expect(legacyFloatToCents(1234.56)).toBe(123456);
    expect(legacyFloatToCents(0.1 + 0.2)).toBe(30); // Protege contra imprecisão binária
  });
});
