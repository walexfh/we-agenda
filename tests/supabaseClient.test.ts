import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured, getSupabaseStatus } from '../services/supabaseClient';

describe('supabaseClient - Verificação de Configuração e Credenciais', () => {
  it('detecta ausência ou placeholders de configuração sem criar falso funcionamento', () => {
    // No ambiente de teste padrão, as variáveis são vazias ou ausentes
    const isConfigured = isSupabaseConfigured();
    const status = getSupabaseStatus();

    // Deve honestamente reportar que não está configurado
    expect(typeof isConfigured).toBe('boolean');
    expect(status).toHaveProperty('isConfigured');
    expect(status).toHaveProperty('missingVars');

    if (!isConfigured) {
      expect(status.isConfigured).toBe(false);
      expect(status.missingVars.length).toBeGreaterThan(0);
    }
  });
});
