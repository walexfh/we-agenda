import React, { useState } from 'react';
import { Wallet, Calendar, User, Info, ShieldAlert } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, name: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('demo');
  const [name, setName] = useState('Usuário Local');
  const [error, setError] = useState('');
  const [showRegisterNotice, setShowRegisterNotice] = useState(false);

  // Recupera usuários existentes para preservar o acesso aos dados já cadastrados
  const existingUsers = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('fincal_users') || '[]');
    } catch {
      return [];
    }
  }, []);

  const handleSelectExistingUser = (u: any) => {
    onLogin(u.username, u.name || u.username);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase().replace(/\s/g, '');
    const cleanName = name.trim() || cleanUsername;

    if (!cleanUsername) {
      setError('Por favor, informe um nome ou identificador de usuário.');
      return;
    }

    onLogin(cleanUsername, cleanName);
  };

  return (
    <div className="h-screen w-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700" />

      <div className="max-w-md w-full z-10 flex flex-col items-center">
        
        {/* Logo / Icons */}
        <div className="flex items-center justify-center mb-4 relative">
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
        
        {/* Badge Modo Demonstração */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 mb-4 border border-amber-200 dark:border-amber-800/60">
          <Info size={14} />
          Modo Local de Demonstração
        </div>

        <p className="text-gray-500 dark:text-gray-400 mb-6 text-center text-sm">
          Sua agenda pessoal e finanças integradas.
        </p>

        {/* Auth Card */}
        <div className="w-full bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Toggle Tabs */}
            <div className="flex mb-4 bg-white dark:bg-gray-900 rounded-lg p-1 border dark:border-gray-800">
                <button
                    type="button"
                    onClick={() => setShowRegisterNotice(false)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!showRegisterNotice ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    Acesso Local
                </button>
                <button
                    type="button"
                    onClick={() => setShowRegisterNotice(true)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${showRegisterNotice ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    Cadastrar
                </button>
            </div>

            {showRegisterNotice ? (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3 text-sm">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                  <ShieldAlert size={18} />
                  Cadastro com E-mail Verificado
                </div>
                <p className="text-purple-900 dark:text-purple-200 text-xs leading-relaxed">
                  O cadastro de contas seguras com e-mail verificado e sincronização em múltiplos aparelhos será ativado na <strong>Etapa 2</strong>.
                </p>
                <p className="text-purple-800 dark:text-purple-300 text-xs">
                  Para proteger sua privacidade, não armazenamos novas senhas em texto puro no navegador. Você pode usar a aplicação imediatamente pelo <strong>Acesso Local</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRegisterNotice(false)}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium text-xs hover:bg-purple-700 transition-colors"
                >
                  Continuar no Modo Local
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Seu Nome</label>
                  <div className="relative">
                      <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Carlos Silva"
                        className="w-full pl-10 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Identificador Local (Usuário)</label>
                  <div className="relative">
                      <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder="usuario"
                        className="w-full pl-10 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      />
                  </div>
                </div>

                {existingUsers.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
                      Perfis locais existentes salvos neste navegador:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {existingUsers.map((u: any) => (
                        <button
                          key={u.username}
                          type="button"
                          onClick={() => handleSelectExistingUser(u)}
                          className="px-2.5 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors"
                        >
                          {u.name || u.username} ({u.username})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                    <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 text-white rounded-xl font-bold shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2 bg-blue-600 hover:bg-blue-700"
                >
                  Entrar no Modo Local
                </button>
              </form>
            )}
        </div>
        
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-600 max-w-xs text-center">
           Nesta etapa, os registros são mantidos com segurança e versionamento local no navegador. A conta em nuvem com e-mail verificado será configurada na Etapa 2.
        </p>
      </div>
    </div>
  );
};