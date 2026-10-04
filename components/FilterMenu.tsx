import React from 'react';
import { FilterState } from '../types';
import { X, Check, Calendar, DollarSign, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface FilterMenuProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({ isOpen, onClose, filters, setFilters }) => {
  if (!isOpen) return null;

  const toggleFilter = (key: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="absolute inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-3/4 max-w-xs bg-white dark:bg-gray-900 h-full shadow-2xl p-6 flex flex-col gap-6 animate-in slide-in-from-left duration-200 border-r dark:border-gray-800">
        
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Filtros</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Main Toggles */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Visualização</h3>
            
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
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Detalhes Financeiros</h3>
              
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
            </div>
          )}
        </div>

        <div className="mt-auto">
          <p className="text-xs text-center text-gray-400 dark:text-gray-600">
            O balanço mensal sempre considera todos os registros, independentemente dos filtros.
          </p>
        </div>

      </div>
    </div>
  );
};