import React, { useEffect, useMemo } from 'react';
import { FilterState, Category } from '../types';
import { getAllCategories } from '../utils/categoryUtils';
import { X, Check, Calendar, DollarSign, ArrowUpCircle, ArrowDownCircle, Tag, Filter } from 'lucide-react';

interface FilterMenuProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  customCategories?: Category[];
}

export const FilterMenu: React.FC<FilterMenuProps> = ({ 
  isOpen, 
  onClose, 
  filters, 
  setFilters,
  customCategories,
}) => {
  const categories = useMemo(() => getAllCategories(customCategories), [customCategories]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleFilter = (key: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStatusFilter = (status: 'all' | 'paid' | 'unpaid' | 'partial') => {
    setFilters(prev => ({
      ...prev,
      paymentStatusFilter: status,
      showPaidOnly: status === 'paid',
      showUnpaidOnly: status === 'unpaid',
    }));
  };

  return (
    <div className="absolute inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-3/4 max-w-xs bg-white dark:bg-gray-900 h-full shadow-2xl p-6 flex flex-col gap-6 animate-in slide-in-from-left duration-200 border-r dark:border-gray-800 overflow-y-auto">
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Filtros</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Main Toggles */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visualização</h3>
            
            <button 
              onClick={() => toggleFilter('showAppointments')}
              className="flex items-center w-full justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                  <Calendar size={20} />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200">Compromissos</span>
              </div>
              <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${filters.showAppointments ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {filters.showAppointments && <Check size={16} className="text-white" />}
              </div>
            </button>

            <button 
              onClick={() => toggleFilter('showFinances')}
              className="flex items-center w-full justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                  <DollarSign size={20} />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200">Finanças</span>
              </div>
              <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${filters.showFinances ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {filters.showFinances && <Check size={16} className="text-white" />}
              </div>
            </button>
          </div>

          {/* Finance Specifics */}
          {filters.showFinances && (
            <div className="space-y-4 border-t dark:border-gray-800 pt-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lançamentos</h3>
              
              <button onClick={() => toggleFilter('showIncome')} className="flex items-center w-full justify-between">
                <div className="flex items-center gap-3">
                  <ArrowUpCircle size={20} className="text-emerald-500" />
                  <span className="text-gray-700 dark:text-gray-300">Receitas</span>
                </div>
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${filters.showIncome ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {filters.showIncome && <Check size={14} className="text-white" />}
                </div>
              </button>

              <button onClick={() => toggleFilter('showExpenses')} className="flex items-center w-full justify-between">
                <div className="flex items-center gap-3">
                  <ArrowDownCircle size={20} className="text-red-500" />
                  <span className="text-gray-700 dark:text-gray-300">Despesas</span>
                </div>
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${filters.showExpenses ? 'bg-red-500 border-red-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {filters.showExpenses && <Check size={14} className="text-white" />}
                </div>
              </button>

              {/* Status de Pagamento */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Status de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'paid', label: 'Pagos' },
                    { id: 'partial', label: 'Parciais' },
                    { id: 'unpaid', label: 'Pendentes' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleStatusFilter(s.id as any)}
                      className={`p-2 rounded-lg border font-medium transition-colors ${
                        (filters.paymentStatusFilter || 'all') === s.id
                          ? 'bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro por Categoria */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag size={12} /> Categoria
                </label>
                <select
                  value={filters.selectedCategory || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, selectedCategory: e.target.value }))}
                  className="w-full p-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="">Todas as Categorias</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 border-t dark:border-gray-800">
          <button
            type="button"
            onClick={() => setFilters({
              showAppointments: true,
              showFinances: true,
              showIncome: true,
              showExpenses: true,
              showPaidOnly: false,
              showUnpaidOnly: false,
              selectedCategory: '',
              paymentStatusFilter: 'all',
            })}
            className="w-full py-2 text-xs text-center text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Redefinir Filtros
          </button>
          <p className="text-[11px] text-center text-gray-400 dark:text-gray-600 mt-2">
            O balanço mensal sempre considera todos os registros do mês.
          </p>
        </div>

      </div>
    </div>
  );
};