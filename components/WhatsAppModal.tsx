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
  ExternalLink,
  Bot,
  Download,
  User
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
  // Configurações do Assistente (Jarves ou nome escolhido)
  const [assistantName, setAssistantName] = useState(userProfile.assistantName || 'Jarves');
  const [assistantPhone, setAssistantPhone] = useState(userProfile.assistantPhone || '');

  // Configurações do Usuário
  const [phoneNumber, setPhoneNumber] = useState(userProfile.whatsapp || '');
  const [enableAlerts, setEnableAlerts] = useState(userProfile.whatsappNotifications ?? true);
  
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');

  // Simulador de Webhook
  const [simulatedText, setSimulatedText] = useState(`${userProfile.assistantName || 'Jarves'}, gastei 33 reais no mercado.`);
  const [simulationLog, setSimulationLog] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanAssistantName = assistantName.trim() || 'Jarves';
    const normalizedUserPhone = normalizeWhatsAppNumber(phoneNumber);
    const normalizedBotPhone = normalizeWhatsAppNumber(assistantPhone);

    if (phoneNumber.trim() && !isValidWhatsAppNumber(normalizedUserPhone)) {
      setError('Por favor, informe seu número de WhatsApp válido com DDD (ex: 11999998888).');
      return;
    }

    if (assistantPhone.trim() && !isValidWhatsAppNumber(normalizedBotPhone)) {
      setError('Por favor, informe um número válido para o contato do assistente com DDD.');
      return;
    }

    onUpdateProfile({
      ...userProfile,
      assistantName: cleanAssistantName,
      assistantPhone: normalizedBotPhone || undefined,
      whatsapp: normalizedUserPhone,
      whatsappNotifications: enableAlerts
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleOpenWhatsAppChat = () => {
    const targetPhone = normalizeWhatsAppNumber(assistantPhone || phoneNumber || '');
    if (!targetPhone) {
      setError('Cadastre o número do WhatsApp do assistente para abrir a conversa direta.');
      return;
    }
    const cleanNumber = targetPhone.replace(/\D/g, '');
    const greeting = encodeURIComponent(`Olá, ${assistantName}!`);
    const url = `https://wa.me/${cleanNumber}?text=${greeting}`;
    window.open(url, '_blank');
  };

  const handleDownloadVCard = () => {
    const targetPhone = normalizeWhatsAppNumber(assistantPhone || phoneNumber || '');
    const displayName = `${assistantName || 'Jarves'} (Agenda W&E)`;
    const vcardContent = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${displayName}`,
      'ORG:W&E.Agenda',
      `TEL;TYPE=CELL,VOICE:${targetPhone || '+5511999998888'}`,
      `NOTE:Assistente Inteligente da Agenda W&E. Envie mensagens de texto ou áudio para gerenciar compromissos e finanças.`,
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${assistantName || 'Jarves'}_Agenda.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            assistantName: assistantName || 'Jarves',
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
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden z-10 border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
        
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
                Assistente {assistantName || 'Jarves'} por texto e áudio
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Cartão de Acesso Rápido ao Contato do Assistente */}
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {assistantName || 'Jarves'} (Contato da Agenda)
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {assistantPhone ? formatDisplayPhoneNumber(assistantPhone) : 'Defina o número do contato abaixo'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                Online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenWhatsAppChat}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ExternalLink size={14} /> Iniciar Conversa
              </button>
              <button
                type="button"
                onClick={handleDownloadVCard}
                className="py-2.5 px-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download size={14} /> Salvar Contato (.vcf)
              </button>
            </div>
          </div>
          
          {/* Formulário de Configuração */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            
            {/* 1. Nome do Assistente */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 ml-1">
                Nome do Assistente
              </label>
              <div className="relative">
                <Bot className="absolute left-3 top-3.5 text-gray-400" size={17} />
                <input
                  type="text"
                  value={assistantName}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setAssistantName(newName);
                    setSimulatedText(`${newName || 'Jarves'}, gastei 33 reais no mercado.`);
                  }}
                  placeholder="Ex: Jarves, Alfred, Siri, Financeiro"
                  className="w-full pl-9 p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1 ml-1">
                O assistente atenderá e responderá pelo nome configurado aqui.
              </p>
            </div>

            {/* 2. Número de WhatsApp do Assistente (o robô / bot) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 ml-1">
                Número do WhatsApp do Assistente ({assistantName || 'Jarves'})
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-3.5 text-gray-400" size={17} />
                <input
                  type="tel"
                  value={assistantPhone}
                  onChange={(e) => setAssistantPhone(e.target.value)}
                  placeholder="Ex: (11) 98888-7777"
                  className="w-full pl-9 p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              {assistantPhone && (
                <div className="text-[11px] text-gray-500 mt-1 ml-1">
                  Formatado: <strong>{formatDisplayPhoneNumber(assistantPhone)}</strong>
                </div>
              )}
            </div>

            {/* 3. Número do Usuário */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 ml-1">
                Seu Número de WhatsApp (Usuário)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-gray-400" size={17} />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: (11) 99999-8888"
                  className="w-full pl-9 p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              {phoneNumber && (
                <div className="text-[11px] text-gray-500 mt-1 ml-1">
                  Formatado: <strong>{formatDisplayPhoneNumber(phoneNumber)}</strong>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1 ml-1">
                Usado pelo servidor para identificar quem está enviando comandos e para enviar lembretes.
              </p>
            </div>

            {/* Checkbox de Lembretes no WhatsApp */}
            <label className="flex items-start gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={enableAlerts}
                onChange={(e) => setEnableAlerts(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm active:scale-[0.98]"
            >
              {isSaved ? <Check size={18} /> : <ShieldCheck size={18} />}
              {isSaved ? 'Configurações Salvas!' : 'Salvar Alterações'}
            </button>
          </form>

          {/* Seção de Simulação e Teste de Webhook */}
          <div className="pt-4 border-t dark:border-gray-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" /> Teste de Mensagem com {assistantName || 'Jarves'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Simule o envio de uma mensagem que você enviaria no WhatsApp:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={simulatedText}
                onChange={(e) => setSimulatedText(e.target.value)}
                placeholder={`Ex: ${assistantName || 'Jarves'}, gastei 33 reais no mercado.`}
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
            Para conectar seu número de WhatsApp real via provedor (ex: Evolution API, Baileys, Z-API ou Meta Cloud API), a Edge Function está disponível em <code>supabase/functions/whatsapp-webhook/</code>.
          </div>

        </div>

      </div>
    </div>
  );
};
