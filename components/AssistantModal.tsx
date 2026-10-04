import React, { useState, useEffect, useRef } from 'react';
import { 
  CalendarItem, 
  FinancialSummary, 
  RecurrenceType, 
  UserProfile, 
  AssistantChatMessage 
} from '../types';
import { processAssistantMessage } from '../services/assistantService';
import { DEFAULT_ASSISTANT_NAME } from '../utils/assistantEngine';
import { 
  Bot, 
  Mic, 
  MicOff, 
  Send, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import clsx from 'clsx';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  items: CalendarItem[];
  monthlySummary?: FinancialSummary;
  onSaveItem: (item: Omit<CalendarItem, 'id'>, recurrence: RecurrenceType) => Promise<boolean | void>;
}

export const AssistantModal: React.FC<AssistantModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  items,
  monthlySummary,
  onSaveItem
}) => {
  const assistantName = userProfile.assistantName || DEFAULT_ASSISTANT_NAME;
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Olá, ${userProfile.name || 'amigo(a)'}! Eu sou o ${assistantName}. Como posso ajudar? Experimente falar ou digitar algo como:\n• "${assistantName}, gastei 33 reais no mercado."\n• "Dentista amanhã às 14h"\n• "Recebi 1200 de freelance hoje"`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(assistantName);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Rolagem automática para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Tecla Escape para fechar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Inicializa suporte a Web Speech API para ditado por voz
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
          // Dispara o envio direto do áudio transcrito
          handleSendMessage(transcript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event?.error);
          setIsListening(false);
          if (event?.error === 'not-allowed') {
            alert('Acesso ao microfone negado. Por favor, autorize a permissão de gravação de áudio nas configurações do seu celular ou navegador.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
      }
    }
  }, []);

  const handleToggleListening = async () => {
    if (isListening) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    // 1. Solicita permissão explícita ao sistema operacional (Android / Navegador)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Para a faixa de áudio de teste para liberar o canal
        testStream.getTracks().forEach(track => track.stop());
      }
    } catch (permErr: any) {
      console.warn('Permissão de microfone negada:', permErr);
      alert('Acesso ao microfone negado. Por favor, autorize o microfone para conversar com o assistente.');
      return;
    }

    // 2. Inicia o reconhecimento de voz nativo
    if (!speechRecognitionRef.current) {
      // Tenta reinicializar se a classe estiver disponível
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
          handleSendMessage(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        speechRecognitionRef.current = recognition;
      } else {
        alert('O reconhecimento de voz nativo não está disponível neste navegador. Você pode digitar sua mensagem no campo de texto.');
        return;
      }
    }

    try {
      speechRecognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn('Falha ao iniciar SpeechRecognition:', err);
      setIsListening(false);
    }
  };

  const handleSaveAssistantName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      onUpdateProfile({ ...userProfile, assistantName: trimmed });
    }
    setIsEditingName(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    setInputText('');
    const userMsgId = 'msg_' + Date.now();
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 1. Adiciona a mensagem do usuário
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text,
        timestamp: timeStr
      }
    ]);

    setIsProcessing(true);

    try {
      // 2. Processa o comando com garantia transacional (gravação confirmada antes de responder)
      const result = await processAssistantMessage(text, {
        assistantName,
        userTimezone: userProfile.timezone,
        items,
        monthlySummary,
        onSaveItem
      });

      // 3. Adiciona a resposta do assistente SOMENTE após o retorno da gravação
      setMessages(prev => [
        ...prev,
        {
          id: 'asst_' + Date.now(),
          sender: 'assistant',
          text: result.replyText,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: result.success ? 'saved' : 'error'
        }
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: 'asst_err_' + Date.now(),
          sender: 'assistant',
          text: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'error'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[85vh] max-h-[700px] overflow-hidden border border-gray-100 dark:border-gray-800">
        
        {/* Header */}
        <div className="p-4 px-6 border-b dark:border-gray-800 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Bot size={24} />
            </div>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nameInput}
                    autoFocus
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAssistantName()}
                    className="p-1 px-2 text-sm bg-white text-gray-900 rounded-lg outline-none w-28 font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAssistantName}
                    className="p-1 text-white hover:text-emerald-300"
                  >
                    <Check size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 id="assistant-title" className="font-bold text-base tracking-tight">{assistantName}</h3>
                  <button
                    type="button"
                    onClick={() => { setIsEditingName(true); setNameInput(assistantName); }}
                    title="Personalizar nome do assistente"
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1 text-[11px] text-white/80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Assistente Pessoal & Financeiro Ativo</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar assistente"
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border-b dark:border-gray-800 flex gap-2 overflow-x-auto no-scrollbar text-xs">
          {[
            `${assistantName}, gastei 33 reais no mercado.`,
            'Dentista amanhã às 14h',
            'Recebi 1200 de freelance hoje',
            'Qual minha agenda de hoje?',
            'Quanto gastei este mês?'
          ].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="shrink-0 px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-full transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={12} className="text-purple-500" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/40 dark:bg-gray-900/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                "flex flex-col max-w-[85%] rounded-2xl p-3.5 shadow-sm text-sm leading-relaxed",
                msg.sender === 'user'
                  ? "ml-auto bg-blue-600 text-white rounded-br-xs"
                  : "mr-auto bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-xs"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              
              <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-[10px] opacity-75">
                <span>{msg.timestamp}</span>
                {msg.status === 'saved' && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 size={12} /> Gravado no calendário
                  </span>
                )}
                {msg.status === 'error' && (
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <AlertCircle size={12} /> Não gravado
                  </span>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="mr-auto bg-white dark:bg-gray-800 rounded-2xl p-3.5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>{assistantName} está gravando e atualizando seu calendário...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleListening}
            title={isListening ? "Parar de ouvir" : "Falar por áudio"}
            className={clsx(
              "p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer",
              isListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <input
            type="text"
            value={inputText}
            disabled={isProcessing}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isListening ? "Ouvindo você..." : `Mensagem para ${assistantName}...`}
            className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />

          <button
            type="button"
            disabled={!inputText.trim() || isProcessing}
            onClick={() => handleSendMessage()}
            aria-label="Enviar mensagem"
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl transition-colors shadow-sm shrink-0 cursor-pointer"
          >
            <Send size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};
