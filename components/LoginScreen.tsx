import React, { useState } from 'react';
import { Wallet, Calendar, ArrowRight, UserPlus, LogIn, Lock, User } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, name: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Only for registration
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (isRegistering && !name.trim()) {
      setError('Por favor, informe seu nome.');
      return;
    }

    setIsLoading(true);

    // Simulated "Backend" delay
    setTimeout(() => {
      const usersDb = JSON.parse(localStorage.getItem('fincal_users') || '[]');

      if (isRegistering) {
        // Registration Logic
        if (usersDb.find((u: any) => u.username === username)) {
          setError('Este usuário já existe.');
          setIsLoading(false);
          return;
        }

        const newUser = { username, password, name };
        usersDb.push(newUser);
        localStorage.setItem('fincal_users', JSON.stringify(usersDb));
        
        // Auto login after register
        onLogin(username, name);
      } else {
        // Login Logic
        const user = usersDb.find((u: any) => u.username === username && u.password === password);
        
        if (user) {
          onLogin(user.username, user.name);
        } else {
          setError('Usuário ou senha incorretos.');
          setIsLoading(false);
        }
      }
    }, 1000);
  };

  return (
    <div className="h-screen w-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700" />

      <div className="max-w-md w-full z-10 flex flex-col items-center">
        
        {/* Logo / Icons */}
        <div className="flex items-center justify-center mb-6 relative">
           <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-2xl -rotate-6 shadow-lg z-10">
              <Calendar size={40} className="text-blue-600 dark:text-blue-400" />
           </div>
           <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-2xl rotate-12 shadow-lg -ml-4 z-20 border-2 border-white dark:border-gray-900">
              <Wallet size={40} className="text-purple-600 dark:text-purple-400" />
           </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          W&E.Agenda
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-center">
          Sua agenda e finanças integradas.
        </p>

        {/* Auth Card */}
        <div className="w-full bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Toggle Tabs */}
            <div className="flex mb-6 bg-white dark:bg-gray-900 rounded-lg p-1 border dark:border-gray-800">
                <button
                    type="button"
                    onClick={() => { setIsRegistering(false); setError(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegistering ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    Entrar
                </button>
                <button
                    type="button"
                    onClick={() => { setIsRegistering(true); setError(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegistering ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    Cadastrar
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {isRegistering && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Nome</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full pl-10 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Usuário</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">Senha</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-10 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                </div>
              </div>

              {error && (
                  <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3.5 text-white rounded-xl font-bold shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2
                    ${isRegistering ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}
                    ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                {isLoading ? (
                    'Carregando...'
                ) : (
                    <>
                        {isRegistering ? 'Criar Conta' : 'Acessar'}
                        {!isLoading && (isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />)}
                    </>
                )}
              </button>
            </form>
        </div>
        
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-600 max-w-xs text-center">
           Seus dados são armazenados localmente neste navegador. Não limpe o cache para evitar perda de dados.
        </p>
      </div>
    </div>
  );
};