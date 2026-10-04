import React, { useState } from 'react';
import { formatCurrency } from '../utils/dateUtils';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Wallet, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

interface BalanceSummaryProps {
  income: number;
  expense: number;
  showValues: boolean;
  onTogglePrivacy: () => void;
}

export const BalanceSummary: React.FC<BalanceSummaryProps> = ({ income, expense, showValues, onTogglePrivacy }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const balance = income - expense;

  const displayValue = (val: number) => {
    return showValues ? formatCurrency(val) : 'R$ ••••';
  };

  return (
    <div 
      className={clsx(
        "fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] rounded-t-3xl transition-all duration-300 z-40 border-t border-gray-100 dark:border-gray-800",
        isExpanded ? "h-64" : "h-20 sm:h-24"
      )}
    >
      <div className="w-full h-full relative">
        {/* Toggle Privacy Button - Absolute Positioned */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onTogglePrivacy();
          }}
          className="absolute top-4 right-4 z-50 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
        >
          {showValues ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>

        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full h-full flex flex-col items-center pt-2 outline-none"
        >
          {/* Handle bar */}
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-3" />

          {!isExpanded ? (
            /* Collapsed View */
            <div className="w-full px-6 flex justify-between items-center h-full pb-4">
              <div className="flex flex-col items-start">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider flex items-center gap-2">
                  Saldo Mensal
                </span>
                <span className={clsx("text-xl font-bold", balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                  {displayValue(balance)}
                </span>
              </div>
              <div className="flex gap-6 text-sm pr-8">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Entradas</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{displayValue(income)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Saídas</span>
                    <span className="text-red-500 dark:text-red-400 font-semibold">{displayValue(expense)}</span>
                  </div>
              </div>
            </div>
          ) : (
            /* Expanded View */
            <div className="w-full px-6 flex flex-col gap-6 mt-2 animate-in fade-in duration-300">
              <div className="text-center">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Saldo Final</h3>
                <div className={clsx("text-4xl font-bold tracking-tight", balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                  {displayValue(balance)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400">
                      <TrendingUp size={16} />
                      <span className="font-semibold text-sm">Receitas</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{displayValue(income)}</span>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-1 text-red-700 dark:text-red-400">
                      <TrendingDown size={16} />
                      <span className="font-semibold text-sm">Despesas</span>
                    </div>
                    <span className="text-lg font-bold text-red-700 dark:text-red-300">{displayValue(expense)}</span>
                  </div>
              </div>

              <div className="text-center">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Deslize para baixo para recolher</span>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};