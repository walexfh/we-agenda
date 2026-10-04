import React, { useState } from 'react';
import { UserProfile, CalendarItem, FinancialSummary, RecurrenceType } from '../types';
import { 
  normalizeWhatsAppNumber, 
  isValidWhatsAppNumber, 
  formatDisplayPhoneNumber,
  handleWhatsAppIncomingWebhook 
} from '../services/whatsappService';
import { 
  MessageSquare, 
  Check, 
  X, 
  Send, 
  Smartphone, 
  ShieldCheck, 
  Info, 
  Sparkles, 
  BellRing,
  ExternalLink 
} from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  items: CalendarItem[];
  monthlySummary?: FinancialSummary;
  onSaveItem: (item: Omit<CalendarItem, 'id'>, recurrence: RecurrenceType) => Promise<boolean | void>;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  items,
  monthlySummary,
  onSaveItem
}) => {
  const [phoneNumber, setPhoneNumber] = useState(userProfile.whatsapp || '');
  const [enableAlerts, setEnableAlerts] = useState(userProfile.whatsappNotifications ?? true);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');

  // Simulador de Webhook
  const [simulatedText, setSimulatedText] = useState('Jarves, gastei 33 reais no mercado.');
  const [simulationLog, setSimulationLog] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalized = normalizeWhatsAppNumber(phoneNumber);
    if (phoneNumber.trim() && !isValidWhatsAppNumber(normalized)) {
      setError('Por favor, informe um número de telefone válido com DDD (ex: 11999998888).');
      return;
    }

    onUpdateProfile({
      ...userProfile,
      whatsapp: normalized,
      whatsappNotifications: enableAlerts
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleRunSimulation = async () => {
    if (!simulatedText.trim() || isSimulating) return;

    const normalized = normalizeWhatsAppNumber(phoneNumber || '11999998888');
    setIsSimulating(true);
    setSimulationLog('Recebendo webhook do WhatsApp...');

    try {
      const result = await handleWhatsAppIncomingWebhook(
        {
          from: normalized,
          messageType: 'text',
          text: simulatedText,
          timestamp: new Date().toISOString()
        },
        {
          getUserContextByPhone: async () => ({
            userId: 'current-user',
            assistantName: userProfile.assistantName || 'Jarves',
            timezone: userProfile.timezone || 'America/Sao_Paulo',
            items,
            monthlySummary
          }),
          onSaveItem: async (_userId, item, recurrence) => {
            return await onSaveItem(item, recurrence);
          }
        }
      );

      setSimulationLog(`Resposta enviada ao WhatsApp:\n"${result.replyText}"\n\nStatus: Gravado no calendário com sucesso!`);
    } catch (err: any) {
      setSimulationLog(`Falha na simulação: ${err?.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-modal-title"
      className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-800">
        
        {/* Header Verde WhatsApp */}
        <div className="p-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 id="whatsapp-modal-title" className="font-bold text-base tracking-tight">
                Integração WhatsApp
              </h3>
              <p className="text-[11px] text-white/80">
                Assistente {userProfile.assistantName || 'Jarves'} por texto e áudio
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Formulário de Vínculo de Telefone */}
          <form onSubmit={handleSavePhone} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Seu Número de WhatsApp
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: (11) 99999-8888 ou 11999998888"
                  className="w-full pl-10 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              {phoneNumber && (
                <div className="text-xs text-gray-500 mt-1">
                  Formatado: <strong>{formatDisplayPhoneNumber(phoneNumber)}</strong>
                </div>
              )}
            </div>

            {/* Checkbox de Lembretes no WhatsApp */}
            <label className="flex items-start gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={enableAlerts}
                onChange={(e) => setEnableAlerts(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-semibold block text-emerald-800 dark:text-emerald-300 mb-0.5">
                  Receber lembretes no WhatsApp
                </span>
                Notificar vencimentos de contas e compromissos diretamente no meu número.
              </div>
            </label>

            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-900">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaved ? <Check size={18} /> : <ShieldCheck size={18} />}
              {isSaved ? 'Configurações Salvas!' : 'Salvar Número do WhatsApp'}
            </button>
          </form>

          {/* Seção de Simulação e Teste de Webhook */}
          <div className="pt-4 border-t dark:border-gray-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" /> Teste de Mensagem / Webhook
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Simule o envio de uma mensagem de texto ou áudio que chegaria pelo WhatsApp para o assistente:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={simulatedText}
                onChange={(e) => setSimulatedText(e.target.value)}
                placeholder="Ex: Jarves, gastei 33 reais no mercado."
                className="flex-1 p-2.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-800 dark:text-gray-200"
              />
              <button
                type="button"
                disabled={isSimulating}
                onClick={handleRunSimulation}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Send size={14} />
                Testar
              </button>
            </div>

            {simulationLog && (
              <div className="mt-3 p-3 bg-gray-900 text-emerald-400 font-mono text-xs rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner">
                {simulationLog}
              </div>
            )}
          </div>

          {/* Dica de Integração Externa */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            <Info size={13} className="inline mr-1 text-emerald-600" />
            Para conectar com provedores reais em produção (ex: Evolution API, Baileys, Z-API ou Meta Cloud API), a Edge Function está disponível em <code>supabase/functions/whatsapp-webhook/</code>.
          </div>

        </div>

      </div>
    </div>
  );
};
