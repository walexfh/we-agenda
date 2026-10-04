import React, { useState } from 'react';
import { 
  Wallet, 
  Calendar, 
  User, 
  Mail, 
  Lock, 
  Info, 
  ShieldAlert, 
  CheckCircle2, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  ServerCrash 
} from 'lucide-react';
import { 
  signInWithEmail, 
  signUpWithEmail, 
  sendPasswordResetEmail,
  signInWithGoogle 
} from '../services/authService';
import { isSupabaseConfigured, getSupabaseStatus } from '../services/supabaseClient';

interface LoginScreenProps {
  onLoginLocal: (username: string, name: string) => void;
  onLoginCloudSuccess: (userId: string, email: string, name: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLoginLocal, 
  onLoginCloudSuccess 
}) => {
  const isCloudConfigured = isSupabaseConfigured();
  const supabaseStatus = getSupabaseStatus();

  // State
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'local'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localUsername, setLocalUsername] = useState('demo');
  const [localName, setLocalName] = useState('Usuário Local');

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Perfis locais salvos para demonstração rápida
  const existingLocalUsers = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('fincal_users') || '[]');
    } catch {
      return [];
    }
  }, []);

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (authMode === 'forgot') {
      if (!email.trim() || !email.includes('@')) {
        setError('Por favor, informe um e-mail válido.');
        return;
      }
      setIsLoading(true);
      const res = await sendPasswordResetEmail(email);
      setIsLoading(false);
      if (res.success) {
        setInfoMessage(res.message || 'Instruções enviadas para seu e-mail.');
      } else {
        setError(res.error || 'Erro ao solicitar redefinição.');
      }
      return;
    }

    if (authMode === 'register') {
      if (!email.trim() || !password) {
        setError('Preencha todos os campos obrigatórios.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      setIsLoading(true);
      const res = await signUpWithEmail(email, password, name);
      setIsLoading(false);

      if (res.success) {
        if (res.requiresEmailVerification) {
          setInfoMessage('Conta criada com sucesso! Enviamos um link de confirmação para o seu e-mail. Por favor, confirme seu endereço antes de fazer login.');
          setAuthMode('login');
        } else if (res.user) {
          onLoginCloudSuccess(
            res.user.id, 
            res.user.email || email, 
            name || res.user.email?.split('@')[0] || ''
          );
        }
      } else {
        setError(res.error || 'Falha ao registrar conta.');
      }
      return;
    }

    // Login normal
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setIsLoading(true);
    const res = await signInWithEmail(email, password);
    setIsLoading(false);

    if (res.success && res.user) {
      const userName = (res.user.user_metadata?.name as string) || res.user.email?.split('@')[0] || 'Usuário';
      onLoginCloudSuccess(res.user.id, res.user.email || email, userName);
    } else {
      setError(res.error || 'Falha no login.');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setInfoMessage('');
    setIsLoading(true);
    const res = await signInWithGoogle();
    setIsLoading(false);
    if (!res.success) {
      setError(res.error || 'Falha ao iniciar autenticação com o Google.');
    }
  };

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = localUsername.trim().toLowerCase().replace(/\s/g, '');
    const cleanName = localName.trim() || cleanUser;
    if (!cleanUser) {
      setError('Informe um identificador para o acesso local.');
      return;
    }
    onLoginLocal(cleanUser, cleanName);
  };

  return (
    <div className="h-screen w-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700" />

      <div className="max-w-md w-full z-10 flex flex-col items-center">
        
        {/* Logo / Icons */}
        <div className="flex items-center justify-center mb-3 relative">
           <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-2xl -rotate-6 shadow-lg z-10">
              <Calendar size={40} className="text-blue-600 dark:text-blue-400" />
           </div>
           <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-2xl rotate-12 shadow-lg -ml-4 z-20 border-2 border-white dark:border-gray-900">
              <Wallet size={40} className="text-purple-600 dark:text-purple-400" />
           </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          W&E.Agenda
        </h1>
        
        <p className="text-gray-500 dark:text-gray-400 mb-5 text-center text-sm">
          Sua agenda pessoal e finanças integradas.
        </p>

        {/* Card Principal de Autenticação */}
        <div className="w-full bg-gray-50 dark:bg-gray-800/60 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Se Supabase não estiver configurado, exibe aviso e modo local */}
          {!isCloudConfigured && (
            <div className="mb-5 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <ServerCrash size={16} />
                <span>Configuração de Nuvem Pendente (.env.local)</span>
              </div>
              <p className="leading-relaxed">
                Para ativar a autenticação real com e-mail verificado e sincronização entre aparelhos, configure as variáveis no arquivo <code>.env.local</code>:
              </p>
              <div className="bg-amber-100/60 dark:bg-amber-900/30 p-2 rounded font-mono text-[10px]">
                VITE_SUPABASE_URL=https://seu-projeto.supabase.co<br />
                VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-400">
                O script SQL das tabelas com Row Level Security está disponível em <code>supabase/schema.sql</code>.
              </p>
            </div>
          )}

          {/* Abas Superiores (Login, Cadastrar, Modo Local) */}
          <div className="flex mb-5 bg-white dark:bg-gray-900 rounded-lg p-1 border dark:border-gray-800 text-xs">
            {isCloudConfigured ? (
              <>
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(''); setInfoMessage(''); }}
                  className={`flex-1 py-2 font-medium rounded-md transition-all ${
                    authMode === 'login' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setError(''); setInfoMessage(''); }}
                  className={`flex-1 py-2 font-medium rounded-md transition-all ${
                    authMode === 'register' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Cadastrar
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('local'); setError(''); setInfoMessage(''); }}
                  className={`flex-1 py-2 font-medium rounded-md transition-all ${
                    authMode === 'local' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Modo Local
                </button>
              </>
            ) : (
              <div className="w-full text-center py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1.5">
                <Info size={14} />
                Acesso Local de Demonstração
              </div>
            )}
          </div>

          {/* Mensagens de Feedback */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Formulário Supabase (Nuvem) */}
          {isCloudConfigured && authMode !== 'local' ? (
            <form onSubmit={handleCloudAuth} className="space-y-3.5">
              
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Seu Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-gray-400" size={17} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Maria Santos"
                      className="w-full pl-9 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-gray-400" size={17} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-9 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {authMode !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-1 ml-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Senha</label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setAuthMode('forgot'); setError(''); setInfoMessage(''); }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-gray-400" size={17} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3.5 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-1 text-sm ${
                  authMode === 'register' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                } ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
              >
                {isLoading ? (
                  'Aguarde...'
                ) : authMode === 'forgot' ? (
                  <>
                    <KeyRound size={17} /> Enviar link de redefinição
                  </>
                ) : authMode === 'register' ? (
                  <>
                    <UserPlus size={17} /> Criar Conta com E-mail
                  </>
                ) : (
                  <>
                    <LogIn size={17} /> Entrar na Conta
                  </>
                )}
              </button>

              {/* Botão de Login com Google / Gmail */}
              {authMode !== 'forgot' && (
                <div className="pt-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink mx-3 text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider font-medium">
                      ou continue com
                    </span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm active:scale-[0.98] cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Entrar com Google (Gmail)
                  </button>
                </div>
              )}

              {authMode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(''); }}
                  className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:underline pt-1"
                >
                  Voltar ao Login
                </button>
              )}
            </form>
          ) : (
            /* Formulário Modo Local / Demonstração */
            <form onSubmit={handleLocalSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Seu Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-gray-400" size={17} />
                  <input
                    type="text"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    placeholder="Ex: Usuário de Teste"
                    className="w-full pl-9 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Usuário Local</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-gray-400" size={17} />
                  <input
                    type="text"
                    value={localUsername}
                    onChange={(e) => setLocalUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="usuario"
                    className="w-full pl-9 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {existingLocalUsers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
                    Perfis locais encontrados neste navegador:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {existingLocalUsers.map((u: any) => (
                      <button
                        key={u.username}
                        type="button"
                        onClick={() => onLoginLocal(u.username, u.name || u.username)}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-900/40 dark:hover:text-amber-300 transition-colors"
                      >
                        {u.name || u.username} ({u.username})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-1 text-sm active:scale-[0.98]"
              >
                <LogIn size={17} /> Entrar no Modo Local
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-xs text-gray-400 dark:text-gray-600 max-w-xs text-center">
          Os dados na nuvem são protegidos por Row Level Security (RLS) no PostgreSQL. Ao logar com e-mail, você poderá sincronizar seus compromissos e finanças em múltiplos aparelhos.
        </p>
      </div>
    </div>
  );
};