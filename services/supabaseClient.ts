import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Valida se as variáveis de ambiente do Supabase estão configuradas e não são placeholders.
 */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  // Verifica se é uma URL válida que não seja o placeholder do exemplo
  const isUrlValid =
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project.supabase.co') &&
    supabaseUrl.includes('.supabase.co');

  const isKeyValid =
    supabaseAnonKey.length > 20 &&
    !supabaseAnonKey.includes('your-anon-public-key');

  return Boolean(isUrlValid && isKeyValid);
}

export function getSupabaseStatus(): { isConfigured: boolean; missingVars: string[] } {
  const missingVars: string[] = [];

  if (!supabaseUrl || supabaseUrl.includes('your-project.supabase.co')) {
    missingVars.push('VITE_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes('your-anon-public-key')) {
    missingVars.push('VITE_SUPABASE_ANON_KEY');
  }

  return {
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

// Cria a instância do Supabase apenas se estiver configurada, evitando exceções no carregamento
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
