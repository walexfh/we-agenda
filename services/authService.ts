import { supabase, isSupabaseConfigured } from './supabaseClient';
import { User, Session } from '@supabase/supabase-js';

export interface AuthResponse {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  requiresEmailVerification?: boolean;
  error?: string;
}

/**
 * Cria nova conta com e-mail e senha no Supabase.
 * Valida formato antes de qualquer requisição.
 * Nunca salva a senha no banco local ou no frontend.
 */
export async function signUpWithEmail(
  email: string, 
  password: string, 
  name: string
): Promise<AuthResponse> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();

  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Por favor, informe um endereço de e-mail válido.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'A senha deve conter pelo menos 6 caracteres.' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'O serviço Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName || cleanEmail.split('@')[0],
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Se o usuário foi criado mas não há sessão ativa, a confirmação de e-mail é obrigatória
    const requiresEmailVerification = Boolean(data.user && !data.session);

    return {
      success: true,
      user: data.user,
      session: data.session,
      requiresEmailVerification,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha na comunicação com o servidor de autenticação.' };
  }
}

/**
 * Realiza login seguro com e-mail e senha.
 */
export async function signInWithEmail(
  email: string, 
  password: string
): Promise<AuthResponse> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Informe seu e-mail e senha.' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'O serviço Supabase não está configurado no arquivo .env.local.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return {
          success: false,
          error: 'E-mail ainda não confirmado. Por favor, verifique o link de ativação enviado para sua caixa de entrada.'
        };
      }
      return { success: false, error: 'E-mail ou senha incorretos.' };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao autenticar.' };
  }
}

/**
 * Realiza autenticação via Google / Gmail (OAuth).
 */
export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'O serviço Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.'
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao conectar com o Google.' };
  }
}

/**
 * Solicita envio de código de confirmação / verificação por e-mail para contas Gmail / Google.
 */
export async function signInWithGmailOtp(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Por favor, informe uma conta de e-mail válida (ex: seu.nome@gmail.com).' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'O serviço Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.'
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('for security purposes') || (error as any).code === 'over_email_send_rate_limit') {
        return {
          success: false,
          error: 'Limite de envio de e-mails do servidor atingido temporariamente (o provedor gratuito limita a 2 e-mails por hora). Verifique se a mensagem anterior caiu no SPAM/Lixo Eletrônico do seu Gmail ou acesse via E-mail e Senha.'
        };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Código de confirmação enviado para ${cleanEmail}. Por favor, consulte sua caixa de entrada no Gmail.`
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao solicitar código de confirmação.' };
  }
}

/**
 * Valida o código numérico (OTP) de confirmação enviado para o e-mail do usuário.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<AuthResponse> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanToken = String(token || '').trim();

  if (!cleanEmail || !cleanToken) {
    return { success: false, error: 'Informe o e-mail e o código de confirmação de 6 dígitos.' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'O serviço Supabase não está configurado.'
    };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });

    if (error) {
      return { success: false, error: 'Código de confirmação inválido ou expirado. Tente novamente.' };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao validar código de confirmação.' };
  }
}


/**
 * Envia e-mail oficial de recuperação e redefinição de senha.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Informe um e-mail válido para redefinição.' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Instruções para redefinição de senha foram enviadas para seu e-mail.'
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao solicitar redefinição.' };
  }
}

/**
 * Altera a senha do usuário atualmente autenticado.
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao atualizar senha.' };
  }
}

/**
 * Encerra a sessão com segurança, revogando o token no cliente.
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora falha de rede ao deslogar
    }
  }
}

/**
 * Retorna a sessão ativa atual.
 */
export async function getActiveSession(): Promise<Session | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}
