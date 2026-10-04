import React, { useState, useEffect } from 'react';
import { CalendarItem, ItemType, RecurrenceType } from '../types';
import { X, Calendar, DollarSign, Clock, Repeat, CheckCircle2, Circle, Bell, Layers, FileEdit } from 'lucide-react';
import { format } from 'date-fns';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<CalendarItem, 'id'>, recurrence: RecurrenceType, editScope?: 'single' | 'sequence') => void;
  selectedDate: Date;
  editingItem?: CalendarItem | null;
  existingItems: CalendarItem[];
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, selectedDate, editingItem, existingItems }) => {
  const [activeType, setActiveType] = useState<ItemType>('appointment');
  
  // Common State
  const [formDate, setFormDate] = useState(''); // YYYY-MM-DD string for input
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
  const [financeType, setFinanceType] = useState<'income' | 'expense'>('expense'); // sub-type for finance
  const [isPaid, setIsPaid] = useState(false);

  // Helper to format Date to YYYY-MM-DD for input
  const formatDateForInput = (date: Date) => {
    try {
        return format(date, 'yyyy-MM-dd');
    } catch (e) {
        return format(new Date(), 'yyyy-MM-dd');
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        // Edit Mode: Populate fields
        setFormDate(formatDateForInput(editingItem.date));
        setTitle(editingItem.title);
        setDescription(editingItem.description || '');
        setRecurrence('once'); // Default to once when editing specific item
        setEditScope('single'); // Reset scope
        
        if (editingItem.type === 'appointment') {
          setActiveType('appointment');
          setStartTime(editingItem.startTime || '09:00');
          setEndTime(editingItem.endTime || '10:00');
          setColor(editingItem.color || '#3b82f6');
          setAlertMinutes(editingItem.alertMinutes || 0);
        } else {
          setActiveType('finance'); // Switch UI to finance
          setFinanceType(editingItem.type === 'income' ? 'income' : 'expense');
          setAmount(editingItem.amount?.toString().replace('.', ',') || '');
          setIsPaid(!!editingItem.isPaid);
        }
      } else {
        // Create Mode: Reset form
        setFormDate(formatDateForInput(selectedDate));
        setTitle('');
        setDescription('');
        setAmount('');
        setRecurrence('once');
        setIsPaid(false);
        setFinanceType('expense');
        setAlertMinutes(0);
        setStartTime('09:00');
        setEndTime('10:00');
        setActiveType('appointment'); // Default tab
      }
    }
  }, [isOpen, editingItem, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const typeToSave = activeType === 'appointment' ? 'appointment' : financeType;

    // Handle Amount parsing (comma to dot)
    let parsedAmount = 0;
    if (activeType === 'finance' && amount) {
        parsedAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    }

    // Parse date from input string to Date object (Local time 00:00)
    // Avoid new Date(string) because it might interpret as UTC and shift day
    const [year, month, day] = formDate.split('-').map(Number);
    const dateToSave = new Date(year, month - 1, day);

    const newItem: Omit<CalendarItem, 'id'> = {
      date: dateToSave,
      type: typeToSave,
      title,
      description,
      // Only include relevant fields
      startTime: activeType === 'appointment' ? startTime : undefined,
      endTime: activeType === 'appointment' ? endTime : undefined,
      color: activeType === 'appointment' ? color : undefined,
      alertMinutes: activeType === 'appointment' ? alertMinutes : undefined,
      amount: activeType === 'finance' ? parsedAmount : undefined,
      isPaid: activeType === 'finance' ? isPaid : undefined,
    };

    onSave(newItem, recurrence, editScope);
    onClose();
  };

  if (!isOpen) return null;

  const isRecurringEdit = editingItem && editingItem.recurrenceId;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Removed animations that might cause visibility issues */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header / Type Switcher */}
        <div className="flex border-b dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveType('appointment')}
            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeType === 'appointment' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <Calendar size={18} /> Agenda
          </button>
          <button
            type="button"
            onClick={() => setActiveType('finance')} // Internal state helper, though type is income/expense
            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeType === 'finance' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <DollarSign size={18} /> Finanças
          </button>
          <button onClick={onClose} className="absolute right-2 top-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto no-scrollbar space-y-5 dark:text-gray-200">
          
          {/* Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Reunião, Dentista..."
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
                      onChange={e => setStartTime(e.target.value)}
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
                      onChange={e => setEndTime(e.target.value)}
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
                    onChange={e => setAlertMinutes(Number(e.target.value))}
                    className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
                  >
                    <option value={0}>Sem lembrete</option>
                    <option value={5}>5 minutos antes</option>
                    <option value={10}>10 minutos antes</option>
                    <option value={15}>15 minutos antes</option>
                    <option value={30}>30 minutos antes</option>
                    <option value={60}>1 hora antes</option>
                    <option value={1440}>1 dia antes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cor</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {['#3b82f6', '#06b6d4', '#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#6b7280'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
               <div className="flex gap-3 mb-4">
                 <button
                    type="button"
                    onClick={() => setFinanceType('expense')}
                    className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-all ${financeType === 'expense' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 ring-1 ring-red-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
                 >
                   Despesa
                 </button>
                 <button
                    type="button"
                    onClick={() => setFinanceType('income')}
                    className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-all ${financeType === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
                 >
                   Receita
                 </button>
               </div>

               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full p-3 text-2xl font-bold text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={financeType === 'expense' ? 'Ex: Aluguel, Mercado...' : 'Ex: Salário, Venda...'}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsPaid(!isPaid)}
                className="flex items-center gap-3 p-3 w-full border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {isPaid ? <CheckCircle2 className="text-emerald-500" /> : <Circle className="text-gray-300 dark:text-gray-600" />}
                <span className={`font-medium ${isPaid ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isPaid ? (financeType === 'income' ? 'Recebido' : 'Pago') : (financeType === 'income' ? 'Pendente de recebimento' : 'Pendente de pagamento')}
                </span>
              </button>
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
                   onChange={e => setRecurrence(e.target.value as RecurrenceType)}
                   className="w-full pl-9 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white appearance-none"
                 >
                   <option value="once">Único</option>
                   <option value="daily">Diário</option>
                   <option value="weekly">Semanal</option>
                   <option value="biweekly">Quinzenal</option>
                   <option value="monthly">Mensal</option>
                 </select>
               </div>
             </div>
          )}

          {/* Recurrence Scope for EDITING recurring items */}
          {isRecurringEdit && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
               <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Aplicar alteração para:</label>
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
                         <FileEdit size={16} className="text-blue-600 dark:text-blue-400"/>
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
                         <Layers size={16} className="text-blue-600 dark:text-blue-400"/>
                         <span className="text-sm text-gray-700 dark:text-gray-200">Este e todos os futuros</span>
                      </div>
                  </label>
               </div>
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-4 mt-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] ${activeType === 'appointment' ? 'bg-blue-600 hover:bg-blue-700' : (financeType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600')}`}
          >
            {editingItem ? 'Atualizar' : 'Salvar'} {activeType === 'appointment' ? 'Compromisso' : (financeType === 'income' ? 'Receita' : 'Despesa')}
          </button>
        </form>
      </div>
    </div>
  );
};