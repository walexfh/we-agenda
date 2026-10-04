import React, { useState, useEffect, useMemo } from 'react';
import { CalendarItem, ModalTabType, FinanceType, ItemType, RecurrenceType, Category, PartialPayment } from '../types';
import { 
  X, Calendar, DollarSign, Clock, Repeat, CheckCircle2, Circle, Bell, 
  Layers, FileEdit, Info, Tag, Plus, Trash2, CreditCard, ChevronDown 
} from 'lucide-react';
import { formatDateToISO, parseISODateToLocal, isEndTimeAfterStartTime } from '../utils/dateUtils';
import { parseCurrencyInput, centsToInputString, formatCurrency } from '../utils/moneyUtils';
import { getAllCategories } from '../utils/categoryUtils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    item: Omit<CalendarItem, 'id'>,
    recurrence: RecurrenceType,
    editScope?: 'single' | 'sequence',
    installmentConfig?: { count: number; isTotalAmount: boolean }
  ) => boolean | Promise<boolean>;
  selectedDate: Date;
  editingItem?: CalendarItem | null;
  existingItems: CalendarItem[];
  accountTimezone?: string;
  customCategories?: Category[];
  onOpenCategoryManager?: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  editingItem,
  accountTimezone = 'America/Sao_Paulo',
  customCategories,
  onOpenCategoryManager,
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
  const [category, setCategory] = useState<string>('');

  // Etapa 6: Parcelamento (Installments)
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [isTotalAmount, setIsTotalAmount] = useState(true);

  // Etapa 6: Amortizações / Pagamentos Parciais
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
  const [newPartialAmount, setNewPartialAmount] = useState('');
  const [newPartialDate, setNewPartialDate] = useState('');
  const [newPartialNote, setNewPartialNote] = useState('');
  const [showAddPartial, setShowAddPartial] = useState(false);
  const [partialError, setPartialError] = useState('');

  // Feedback State
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categorias disponíveis filtradas pelo tipo
  const allCategories = useMemo(() => getAllCategories(customCategories), [customCategories]);
  const availableCategories = useMemo(() => {
    return allCategories.filter(c => c.type === 'both' || c.type === financeType);
  }, [allCategories, financeType]);

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
      setPartialError('');
      setIsSubmitting(false);
      setShowAddPartial(false);
      setNewPartialAmount('');
      setNewPartialNote('');

      const todayISO = formatDateToISO(selectedDate);
      setNewPartialDate(todayISO);

      if (editingItem) {
        // Modo Edição
        setFormDate(editingItem.dateStr || formatDateToISO(editingItem.date));
        setTitle(editingItem.title);
        setDescription(editingItem.description || '');
        setRecurrence('once');
        setEditScope('single');
        setCategory(editingItem.category || '');
        setIsInstallment(false);
        setPartialPayments(editingItem.partialPayments ? [...editingItem.partialPayments] : []);
        
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
        // Modo Criação
        setFormDate(formatDateToISO(selectedDate));
        setTitle('');
        setDescription('');
        setAmount('');
        setRecurrence('once');
        setIsPaid(false);
        setFinanceType('expense');
        setCategory('');
        setIsInstallment(false);
        setInstallmentCount(2);
        setIsTotalAmount(true);
        setPartialPayments([]);
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
    if (newTab === 'appointment') {
      setAmount('');
      setIsPaid(false);
      setIsInstallment(false);
    } else {
      setStartTime('09:00');
      setEndTime('10:00');
    }
  };

  // Cálculos de amortização
  const parsedItemCents = useMemo(() => {
    const res = parseCurrencyInput(amount);
    return res.success ? (res.cents || 0) : 0;
  }, [amount]);

  const totalAmortizedCents = useMemo(() => {
    return partialPayments.reduce((acc, p) => acc + (p.amountCents || 0), 0);
  }, [partialPayments]);

  const remainingBalanceCents = useMemo(() => {
    return Math.max(0, parsedItemCents - totalAmortizedCents);
  }, [parsedItemCents, totalAmortizedCents]);

  const handleAddPartialPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPartialError('');

    const parsed = parseCurrencyInput(newPartialAmount);
    if (!parsed.success || !parsed.cents || parsed.cents <= 0) {
      setPartialError(parsed.error || 'Informe um valor válido para amortização.');
      return;
    }

    if (!newPartialDate) {
      setPartialError('Informe a data do pagamento.');
      return;
    }

    const newPayment: PartialPayment = {
      id: `part-${Date.now()}`,
      amountCents: parsed.cents,
      dateStr: newPartialDate,
      notes: newPartialNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedPayments = [...partialPayments, newPayment];
    setPartialPayments(updatedPayments);

    // Se o total amortizado quitar o valor integral do item, marca como pago automaticamente
    const newAmortized = updatedPayments.reduce((acc, p) => acc + p.amountCents, 0);
    if (parsedItemCents > 0 && newAmortized >= parsedItemCents) {
      setIsPaid(true);
    }

    setNewPartialAmount('');
    setNewPartialNote('');
    setShowAddPartial(false);
  };

  const handleRemovePartialPayment = (paymentId: string) => {
    const updated = partialPayments.filter(p => p.id !== paymentId);
    setPartialPayments(updated);
    const newAmortized = updated.reduce((acc, p) => acc + p.amountCents, 0);
    if (parsedItemCents > 0 && newAmortized < parsedItemCents) {
      setIsPaid(false);
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
        category: activeType === 'finance' ? (category || undefined) : undefined,
        partialPayments: activeType === 'finance' && partialPayments.length > 0 ? partialPayments : undefined,
      };

      const installmentConfig = (!editingItem && isInstallment && activeType === 'finance')
        ? { count: installmentCount, isTotalAmount }
        : undefined;

      const success = await onSave(newItem, recurrence, editScope, installmentConfig);
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
      
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
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
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {activeType === 'appointment' ? (
            /* ========================================================================= */
            /* APPOINTMENT FIELDS                                                        */
            /* ========================================================================= */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título do Compromisso <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Reunião de Alinhamento, Dentista..."
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Pauta da reunião, endereço ou notas adicionais..."
                  rows={2}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Início</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      required
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Término</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      required
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
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
                    <option value={0}>No horário do evento</option>
                    <option value={5}>5 minutos antes</option>
                    <option value={10}>10 minutos antes</option>
                    <option value={15}>15 minutos antes</option>
                    <option value={30}>30 minutos antes</option>
                    <option value={60}>1 hora antes</option>
                    <option value={120}>2 horas antes</option>
                    <option value={1440}>1 dia antes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cor do Evento</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'].map((c) => (
                    <button
                      key={c}
                      type="button"
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
            /* ========================================================================= */
            /* FINANCE FIELDS                                                            */
            /* ========================================================================= */
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

              {/* Seletor de Categoria (Etapa 6) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Tag size={14} className="text-purple-600 dark:text-purple-400" /> Categoria
                  </label>
                  {onOpenCategoryManager && (
                    <button
                      type="button"
                      onClick={onOpenCategoryManager}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      + Gerenciar
                    </button>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
                  >
                    <option value="">Sem categoria definida</option>
                    {availableCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Status de Quitação Total */}
              <button
                type="button"
                onClick={() => setIsPaid(!isPaid)}
                className="flex items-center gap-3 p-3 w-full border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                {isPaid ? <CheckCircle2 className="text-emerald-500" /> : <Circle className="text-gray-300 dark:text-gray-600" />}
                <span className={`font-medium ${isPaid ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isPaid
                    ? financeType === 'income' ? 'Totalmente Recebido' : 'Totalmente Pago'
                    : financeType === 'income' ? 'Pendente de recebimento (A receber)' : 'Pendente de pagamento (A pagar)'}
                </span>
              </button>

              {/* Lembrete de Vencimento */}
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

              {/* Seção de Amortizações e Pagamentos Parciais para Edição (Etapa 6) */}
              {editingItem && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Amortizações & Pagamentos Parciais
                      </h4>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Pago: <span className="font-semibold text-emerald-600">{formatCurrency(totalAmortizedCents)}</span> • 
                        Restante: <span className="font-semibold text-red-500">{formatCurrency(remainingBalanceCents)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddPartial(!showAddPartial)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 transition-colors"
                    >
                      {showAddPartial ? 'Cancelar' : '+ Amortizar'}
                    </button>
                  </div>

                  {/* Barra de Progresso de Quitação */}
                  {parsedItemCents > 0 && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((totalAmortizedCents / parsedItemCents) * 100))}%` }}
                      />
                    </div>
                  )}

                  {/* Formulário de Adicionar Pagamento Parcial */}
                  {showAddPartial && (
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2.5">
                      <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                        Novo Pagamento Parcial
                      </div>
                      {partialError && (
                        <div className="text-xs text-red-600 bg-red-50 p-1.5 rounded">{partialError}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={newPartialAmount}
                          onChange={(e) => setNewPartialAmount(e.target.value)}
                          placeholder="Valor (R$)"
                          className="p-2 text-xs border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        />
                        <input
                          type="date"
                          value={newPartialDate}
                          onChange={(e) => setNewPartialDate(e.target.value)}
                          className="p-2 text-xs border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                        />
                      </div>
                      <input
                        type="text"
                        value={newPartialNote}
                        onChange={(e) => setNewPartialNote(e.target.value)}
                        placeholder="Observação (Ex: Pix 1ª parcela, dinheiro...)"
                        className="w-full p-2 text-xs border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddPartialPayment}
                        className="w-full py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700"
                      >
                        Confirmar Amortização
                      </button>
                    </div>
                  )}

                  {/* Histórico de Amortizações */}
                  {partialPayments.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {partialPayments.map(p => (
                        <div 
                          key={p.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700"
                        >
                          <div>
                            <span className="font-semibold text-emerald-600">{formatCurrency(p.amountCents)}</span>
                            <span className="text-gray-400 ml-2">({p.dateStr})</span>
                            {p.notes && <span className="text-gray-500 dark:text-gray-400 ml-1.5">- {p.notes}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePartialPayment(p.id)}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Excluir amortização"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Parcelamento de Compras (Novo Lançamento) (Etapa 6) */}
              {!editingItem && (
                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} className="text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Parcelar Lançamento
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsInstallment(!isInstallment)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        isInstallment ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isInstallment ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {isInstallment && (
                    <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Número de Parcelas
                          </label>
                          <select
                            value={installmentCount}
                            onChange={(e) => setInstallmentCount(Number(e.target.value))}
                            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 dark:text-white"
                          >
                            {Array.from({ length: 71 }, (_, i) => i + 2).map(n => (
                              <option key={n} value={n}>{n}x</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            O Valor Digitado é:
                          </label>
                          <select
                            value={isTotalAmount ? 'total' : 'per_installment'}
                            onChange={(e) => setIsTotalAmount(e.target.value === 'total')}
                            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 dark:text-white"
                          >
                            <option value="total">Valor Total a Dividir</option>
                            <option value="per_installment">Valor por Parcela</option>
                          </select>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        * Serão gerados {installmentCount} lançamentos mensais com controle automático de vencimentos e centavos exatos.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Opções de Recorrência para Novos Itens (Se não for parcelamento) */}
          {!editingItem && !isInstallment && (
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

          {/* Escopo de Edição para Séries Recorrentes */}
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
                    : isInstallment
                    ? `Parcelamento em ${installmentCount}x`
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