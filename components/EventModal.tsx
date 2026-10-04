import React, { useState, useEffect } from 'react';
import { CalendarItem, ModalTabType, FinanceType, ItemType, RecurrenceType } from '../types';
import { X, Calendar, DollarSign, Clock, Repeat, CheckCircle2, Circle, Bell, Layers, FileEdit, Info } from 'lucide-react';
import { formatDateToISO, parseISODateToLocal, isEndTimeAfterStartTime } from '../utils/dateUtils';
import { parseCurrencyInput, centsToInputString } from '../utils/moneyUtils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    item: Omit<CalendarItem, 'id'>,
    recurrence: RecurrenceType,
    editScope?: 'single' | 'sequence'
  ) => boolean | Promise<boolean>;
  selectedDate: Date;
  editingItem?: CalendarItem | null;
  existingItems: CalendarItem[];
  accountTimezone?: string;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  editingItem,
  accountTimezone = 'America/Sao_Paulo',
}) => {
  const [activeType, setActiveType] = useState<ModalTabType>('appointment');
  
  // Common State
  const [formDate, setFormDate] = useState(''); // YYYY-MM-DD
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
  
  // Edit Scope State
  const [editScope, setEditScope] = useState<'single' | 'sequence'>('single');
  
  // Appointment State
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [color, setColor] = useState('#3b82f6');
  const [alertMinutes, setAlertMinutes] = useState(0);

  // Finance State
  const [amount, setAmount] = useState('');
  const [financeType, setFinanceType] = useState<FinanceType>('expense');
  const [isPaid, setIsPaid] = useState(false);

  // Feedback State
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsSubmitting(false);

      if (editingItem) {
        // Edit Mode: Populate fields
        setFormDate(editingItem.dateStr || formatDateToISO(editingItem.date));
        setTitle(editingItem.title);
        setDescription(editingItem.description || '');
        setRecurrence('once');
        setEditScope('single');
        
        setAlertMinutes(editingItem.alertMinutes !== undefined ? editingItem.alertMinutes : -1);
        
        if (editingItem.type === 'appointment') {
          setActiveType('appointment');
          setStartTime(editingItem.startTime || '09:00');
          setEndTime(editingItem.endTime || '10:00');
          setColor(editingItem.color || '#3b82f6');
          setAmount('');
        } else {
          setActiveType('finance');
          setFinanceType(editingItem.type === 'income' ? 'income' : 'expense');
          setAmount(centsToInputString(editingItem.amountCents));
          setIsPaid(Boolean(editingItem.isPaid));
        }
      } else {
        // Create Mode: Reset form
        setFormDate(formatDateToISO(selectedDate));
        setTitle('');
        setDescription('');
        setAmount('');
        setRecurrence('once');
        setIsPaid(false);
        setFinanceType('expense');
        setAlertMinutes(-1);
        setStartTime('09:00');
        setEndTime('10:00');
        setActiveType('appointment');
      }
    }
  }, [isOpen, editingItem, selectedDate]);

  const handleTabSwitch = (newTab: ModalTabType) => {
    if (newTab === activeType) return;
    setActiveType(newTab);
    setError('');
    // Limpar campos específicos ao mudar de tipo para evitar inconsistências
    if (newTab === 'appointment') {
      setAmount('');
      setIsPaid(false);
    } else {
      setStartTime('09:00');
      setEndTime('10:00');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Validação de título
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Por favor, informe o título.');
      return;
    }

    // 2. Validação de data
    if (!formDate || !/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      setError('Por favor, selecione uma data válida (AAAA-MM-DD).');
      return;
    }

    // 3. Validação financeira
    let amountCents: number | undefined = undefined;
    if (activeType === 'finance') {
      const parseResult = parseCurrencyInput(amount);
      if (!parseResult.success) {
        setError(parseResult.error || 'Valor inválido.');
        return;
      }
      amountCents = parseResult.cents;
    }

    // 4. Validação de compromisso
    if (activeType === 'appointment') {
      if (!startTime || !endTime) {
        setError('Por favor, informe os horários de início e término.');
        return;
      }
      if (!isEndTimeAfterStartTime(startTime, endTime)) {
        setError('O horário de término deve ser posterior ao horário de início no mesmo dia.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const typeToSave: ItemType = activeType === 'appointment' ? 'appointment' : financeType;
      const dateToSave = parseISODateToLocal(formDate);

      const newItem: Omit<CalendarItem, 'id'> = {
        date: dateToSave,
        dateStr: formDate,
        type: typeToSave,
        title: trimmedTitle,
        description: description.trim(),
        startTime: activeType === 'appointment' ? startTime : undefined,
        endTime: activeType === 'appointment' ? endTime : undefined,
        color: activeType === 'appointment' ? color : undefined,
        alertMinutes: alertMinutes >= 0 ? alertMinutes : undefined,
        amountCents: activeType === 'finance' ? amountCents : undefined,
        isPaid: activeType === 'finance' ? isPaid : undefined,
      };

      const success = await onSave(newItem, recurrence, editScope);
      // O formulário só fecha após gravação bem-sucedida
      if (success !== false) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao gravar o lançamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isRecurringEdit = editingItem && (editingItem.seriesId || editingItem.recurrenceId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header / Type Switcher */}
        <div className="flex border-b dark:border-gray-800">
          <button
            type="button"
            onClick={() => handleTabSwitch('appointment')}
            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeType === 'appointment'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Calendar size={18} /> Agenda
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('finance')}
            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeType === 'finance'
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <DollarSign size={18} /> Finanças
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar janela"
            className="absolute right-2 top-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto no-scrollbar space-y-5 dark:text-gray-200">
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-gray-400" size={16} />
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
              />
            </div>
          </div>

          {/* Type Specific Fields */}
          {activeType === 'appointment' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Reunião, Dentista, Consulta..."
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Início</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fim</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                * Nesta versão, o término deve ser posterior ao início no mesmo dia.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lembrete</label>
                <div className="relative">
                  <Bell className="absolute left-3 top-3 text-gray-400" size={16} />
                  <select
                    value={alertMinutes}
                    onChange={(e) => setAlertMinutes(Number(e.target.value))}
                    className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
                  >
                    <option value={-1}>Sem lembrete</option>
                    <option value={0}>No horário do compromisso</option>
                    <option value={5}>5 minutos antes</option>
                    <option value={10}>10 minutos antes</option>
                    <option value={15}>15 minutos antes</option>
                    <option value={30}>30 minutos antes</option>
                    <option value={60}>1 hora antes</option>
                    <option value={120}>2 horas antes</option>
                    <option value={1440}>1 dia antes</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <Info size={13} className="shrink-0" />
                  <span>Fuso: {accountTimezone} • Notificação ativa</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cor</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {['#3b82f6', '#06b6d4', '#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#6b7280'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setFinanceType('expense')}
                  className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-all ${
                    financeType === 'expense'
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Despesa (Saída)
                </button>
                <button
                  type="button"
                  onClick={() => setFinanceType('income')}
                  className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-all ${
                    financeType === 'income'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Receita (Entrada)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 33,50 ou 1.234,56"
                  className="w-full p-3 text-2xl font-bold text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 dark:bg-gray-800"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Aceita valores como 33, 33,50, 33.50 ou 1.234,56
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={financeType === 'expense' ? 'Ex: Mercado, Aluguel, Luz...' : 'Ex: Salário, Venda, Freelance...'}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsPaid(!isPaid)}
                className="flex items-center gap-3 p-3 w-full border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                {isPaid ? <CheckCircle2 className="text-emerald-500" /> : <Circle className="text-gray-300 dark:text-gray-600" />}
                <span className={`font-medium ${isPaid ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isPaid
                    ? financeType === 'income' ? 'Recebido' : 'Pago'
                    : financeType === 'income' ? 'Pendente de recebimento (A receber)' : 'Pendente de pagamento (A pagar)'}
                </span>
              </button>

              {!isPaid && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lembrete de Vencimento
                  </label>
                  <div className="relative">
                    <Bell className="absolute left-3 top-3 text-gray-400" size={16} />
                    <select
                      value={alertMinutes}
                      onChange={(e) => setAlertMinutes(Number(e.target.value))}
                      className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
                    >
                      <option value={-1}>Sem lembrete</option>
                      <option value={0}>No dia do vencimento às 08:00</option>
                      <option value={1440}>1 dia antes às 08:00</option>
                      <option value={2880}>2 dias antes às 08:00</option>
                      <option value={4320}>3 dias antes às 08:00</option>
                      <option value={10080}>1 semana antes às 08:00</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-purple-600 dark:text-purple-400">
                    <Info size={13} className="shrink-0" />
                    <span>Fuso: {accountTimezone} • Notificação de contas a pagar/receber</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Recurrence Options for NEW items */}
          {!editingItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequência</label>
              <div className="relative">
                <Repeat className="absolute left-3 top-3 text-gray-400" size={16} />
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                  className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
                >
                  <option value="once">Único</option>
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>
              {recurrence === 'monthly' && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  * Em meses menores (ex: fev/abr), a recorrência se ajusta ao último dia e retorna ao dia original quando aplicável.
                </div>
              )}
            </div>
          )}

          {/* Recurrence Scope for EDITING recurring items */}
          {isRecurringEdit && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                Aplicar alteração para:
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40">
                  <input
                    type="radio"
                    name="editScope"
                    checked={editScope === 'single'}
                    onChange={() => setEditScope('single')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex items-center gap-2">
                    <FileEdit size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">Apenas este evento</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40">
                  <input
                    type="radio"
                    name="editScope"
                    checked={editScope === 'sequence'}
                    onChange={() => setEditScope('sequence')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">Este e todos os futuros</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 mt-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            } ${
              activeType === 'appointment'
                ? 'bg-blue-600 hover:bg-blue-700'
                : financeType === 'income'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isSubmitting
              ? 'Gravando...'
              : `${editingItem ? 'Atualizar' : 'Salvar'} ${
                  activeType === 'appointment'
                    ? 'Compromisso'
                    : financeType === 'income'
                    ? 'Receita'
                    : 'Despesa'
                }`}
          </button>
        </form>
      </div>
    </div>
  );
};