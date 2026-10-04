import React, { useMemo, useState, useEffect } from 'react';
import { CalendarItem, UserProfile } from '../types';
import { X, CheckSquare, Square, DollarSign, Wallet, Moon, Sun, User, Edit2, Check, LogOut, Globe, Bell, Bot, MessageSquare, Tag } from 'lucide-react';
import { formatCurrency } from '../utils/moneyUtils';
import { formatMonthYear } from '../utils/dateUtils';
import { POPULAR_TIMEZONES } from '../utils/reminderUtils';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: CalendarItem[];
  currentDate: Date;
  onTogglePaid: (id: string) => void;
  onEditItem: (item: CalendarItem) => void;
  showValues: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userProfile: UserProfile;
  setUserProfile: (p: UserProfile) => void;
  onLogout: () => void;
  notificationPermission?: NotificationPermission | 'unsupported';
  onRequestNotificationPermission?: () => void;
  onOpenWhatsAppModal?: () => void;
  onOpenCategoryManager?: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({ 
  isOpen, 
  onClose, 
  items,
  currentDate, 
  onTogglePaid,
  onEditItem,
  showValues,
  isDarkMode,
  toggleDarkMode,
  userProfile,
  setUserProfile,
  onLogout,
  notificationPermission,
  onRequestNotificationPermission,
  onOpenWhatsAppModal,
  onOpenCategoryManager,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userProfile.name);

  // Fecha no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Update tempName when userProfile changes
  React.useEffect(() => {
    setTempName(userProfile.name);
  }, [userProfile.name]);

  // Filter expenses strictly for the current month view
  const expenses = useMemo(() => {
    return items
      .filter(item => 
        item.type === 'expense' && 
        isSameMonth(item.date, currentDate)
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [items, currentDate]);

  const totalUnpaidCents = expenses.filter(e => !e.isPaid).reduce((acc, curr) => acc + (curr.amountCents || 0), 0);
  const totalPaidCents = expenses.filter(e => e.isPaid).reduce((acc, curr) => acc + (curr.amountCents || 0), 0);

  const saveProfile = () => {
    setUserProfile({ ...userProfile, name: tempName });
    setIsEditingName(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-4/5 max-w-sm bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200 border-r dark:border-gray-800">
        
        {/* Header Profile Section */}
        <div className="p-6 pb-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300">
                    <User size={24} />
                </div>
                <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Bem-vindo(a),</div>
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                             <input 
                                autoFocus
                                type="text" 
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="w-24 p-1 text-sm bg-white dark:bg-gray-700 border border-blue-300 rounded outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                             />
                             <button onClick={saveProfile} className="text-emerald-500"><Check size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setIsEditingName(true); setTempName(userProfile.name); }}>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white truncate max-w-[120px]">{userProfile.name}</h2>
                            <Edit2 size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">
                <X size={20} />
              </button>
          </div>

          {/* Fuso Horário e Notificações (Etapa 3) */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/60 flex flex-col gap-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <Globe size={13} /> Fuso Horário da Conta:
              </label>
              <select
                value={userProfile.timezone || 'America/Sao_Paulo'}
                onChange={(e) => setUserProfile({ ...userProfile, timezone: e.target.value })}
                className="w-full text-xs p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none text-gray-700 dark:text-gray-200 font-medium"
              >
                {POPULAR_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Bell size={13} /> Notificações:
              </span>
              {notificationPermission === 'granted' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check size={12} /> Ativas
                </span>
              ) : notificationPermission === 'denied' ? (
                <span className="text-red-500 dark:text-red-400 font-medium text-[11px]">
                  Bloqueadas no navegador
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRequestNotificationPermission}
                  className="text-blue-600 dark:text-blue-400 font-semibold underline text-xs hover:text-blue-700 cursor-pointer"
                >
                  Ativar Lembretes
                </button>
              )}
            </div>

            {/* Nome do Assistente IA (Etapa 4) */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200 dark:border-gray-700/40">
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Bot size={13} className="text-purple-500" /> Nome do Assistente:
              </span>
              <input
                type="text"
                value={userProfile.assistantName || 'Jarves'}
                onChange={(e) => setUserProfile({ ...userProfile, assistantName: e.target.value })}
                className="w-24 text-xs p-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded outline-none text-right font-semibold text-purple-600 dark:text-purple-400"
                title="Nome configurável do assistente"
              />
            </div>

            {/* Integração WhatsApp (Etapa 5) */}
            <button
              type="button"
              onClick={onOpenWhatsAppModal}
              className="w-full flex items-center justify-between p-2 mt-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={14} className="text-emerald-600 dark:text-emerald-400" />
                WhatsApp Integrado
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {userProfile.whatsapp ? 'Conectado ✓' : 'Configurar ›'}
              </span>
            </button>

            {/* Gerenciar Categorias (Etapa 6) */}
            {onOpenCategoryManager && (
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="w-full flex items-center justify-between p-2 mt-1 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-800 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Tag size={14} className="text-purple-600 dark:text-purple-400" />
                  Categorias
                </span>
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                  Personalizar ›
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="p-6 pb-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Resumo de {format(currentDate, 'MMMM', { locale: ptBR })}
            </h3>
            {/* Changed background from gray-900 to white in light mode, and black/dark in dark mode */}
            <div className="bg-white dark:bg-black rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Pendente</span>
                        <div className="text-2xl font-bold text-red-500">
                            {showValues ? formatCurrency(totalUnpaidCents) : 'R$ ••••'}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Pago</span>
                        <div className="text-lg font-semibold text-emerald-500">
                            {showValues ? formatCurrency(totalPaidCents) : 'R$ ••••'}
                        </div>
                    </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                        style={{ width: `${expenses.length > 0 ? (expenses.filter(e => e.isPaid).length / expenses.length) * 100 : 0}%` }}
                    />
                </div>
                <div className="text-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {expenses.filter(e => e.isPaid).length} de {expenses.length} despesas pagas
                </div>
            </div>
        </div>

        {/* Expenses List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
             Despesas de {format(currentDate, 'MMMM', { locale: ptBR })}
           </h3>
           
           {expenses.length === 0 ? (
               <div className="text-center text-gray-400 dark:text-gray-600 mt-10">
                   <DollarSign size={40} className="mx-auto mb-2 opacity-20" />
                   <p>Nenhuma despesa neste mês.</p>
               </div>
           ) : (
               expenses.map(item => (
                   <div 
                     key={item.id} 
                     onClick={() => {
                        onClose(); // Close menu to focus on editing
                        onEditItem(item);
                     }}
                     className={clsx(
                         "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                         item.isPaid 
                            ? "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800 opacity-60" 
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm"
                     )}
                   >
                       <div className="flex items-center gap-3">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); // Stop click from triggering edit
                                    onTogglePaid(item.id); 
                                }}
                                className={clsx("transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700", item.isPaid ? "text-emerald-500" : "text-gray-300 hover:text-gray-400")}
                            >
                                {item.isPaid ? <CheckSquare size={24} /> : <Square size={24} />}
                            </button>
                            <div>
                                <h4 className={clsx("font-medium text-gray-800 dark:text-gray-200 leading-tight", item.isPaid && "line-through text-gray-500")}>
                                    {item.title}
                                </h4>
                                <span className="text-xs text-gray-400">
                                    {format(item.date, "dd", { locale: ptBR })} - {format(item.date, "EEE", { locale: ptBR })}
                                </span>
                            </div>
                       </div>
                       
                       <div className="flex items-center gap-2">
                           <div className={clsx("font-semibold", item.isPaid ? "text-gray-400" : "text-red-500 dark:text-red-400")}>
                               {showValues ? formatCurrency(item.amountCents || 0) : 'R$ •••'}
                           </div>
                           <Edit2 size={14} className="text-gray-300 dark:text-gray-600 opacity-50" />
                       </div>
                   </div>
               ))
           )}
        </div>

        {/* Footer Toggle */}
        <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-2">
            <button 
                onClick={toggleDarkMode}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
            </button>
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
                <LogOut size={20} />
                Sair
            </button>
        </div>

      </div>
    </div>
  );
};