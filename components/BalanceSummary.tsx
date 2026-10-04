import React, { useState } from 'react';
import { FinancialSummary } from '../types';
import { formatCurrency } from '../utils/moneyUtils';
import { TrendingUp, TrendingDown, Clock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

interface BalanceSummaryProps {
  summary: FinancialSummary;
  monthLabel: string;
  showValues: boolean;
  onTogglePrivacy: () => void;
}

export const BalanceSummary: React.FC<BalanceSummaryProps> = ({
  summary,
  monthLabel,
  showValues,
  onTogglePrivacy,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayValue = (cents: number) => {
    return showValues ? formatCurrency(cents) : 'R$ ••••';
  };

  return (
    <div 
      className={clsx(
        "fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] rounded-t-3xl transition-all duration-300 z-40 border-t border-gray-200 dark:border-gray-800",
        isExpanded ? "h-[340px] sm:h-[320px]" : "h-20 sm:h-24"
      )}
    >
      <div className="w-full h-full relative">
        {/* Toggle Privacy Button */}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePrivacy();
          }}
          className="absolute top-4 right-4 z-50 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
          aria-label={showValues ? "Ocultar valores monetários" : "Exibir valores monetários"}
        >
          {showValues ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>

        <button 
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="w-full h-full flex flex-col items-center pt-2 outline-none text-left cursor-pointer"
        >
          {/* Handle bar */}
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2 shrink-0" />

          {!isExpanded ? (
            /* Collapsed View */
            <div className="w-full px-6 flex justify-between items-center h-full pb-4">
              <div className="flex flex-col items-start">
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  Resultado Realizado • {monthLabel}
                </span>
                <span className={clsx("text-xl font-bold", summary.realizedResultCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                  {displayValue(summary.realizedResultCents)}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  Previsto: {displayValue(summary.forecastResultCents)}
                </span>
              </div>
              <div className="flex gap-4 sm:gap-6 text-sm pr-10">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Recebido</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
                    {displayValue(summary.incomeReceivedCents)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Pago</span>
                  <span className="text-red-500 dark:text-red-400 font-semibold text-xs sm:text-sm">
                    {displayValue(summary.expensePaidCents)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Expanded View */
            <div className="w-full px-6 flex flex-col gap-3 mt-1 animate-in fade-in duration-300 overflow-y-auto no-scrollbar pb-4">
              <div className="text-center">
                <h3 className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  Resumo Financeiro de {monthLabel}
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Total de lançamentos cadastrados no mês (não representa saldo em conta corrente)
                </p>
              </div>

              {/* Top Results: Realizado vs Previsto */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-2xl border border-gray-100 dark:border-gray-700/60 flex flex-col items-center">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    Resultado Realizado
                  </span>
                  <div className={clsx("text-lg sm:text-xl font-bold mt-0.5", summary.realizedResultCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                    {displayValue(summary.realizedResultCents)}
                  </div>
                  <span className="text-[10px] text-gray-400">Recebido - Pago</span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-2xl border border-gray-100 dark:border-gray-700/60 flex flex-col items-center">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock size={13} className="text-blue-500" />
                    Resultado Previsto
                  </span>
                  <div className={clsx("text-lg sm:text-xl font-bold mt-0.5", summary.forecastResultCents >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400")}>
                    {displayValue(summary.forecastResultCents)}
                  </div>
                  <span className="text-[10px] text-gray-400">Total Receitas - Despesas</span>
                </div>
              </div>

              {/* 4 Cards Detail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <TrendingUp size={13} />
                    <span>Receitas Recebidas</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {displayValue(summary.incomeReceivedCents)}
                  </div>
                </div>

                <div className="bg-amber-50/70 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <Clock size={13} />
                    <span>Contas a Receber</span>
                  </div>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-1">
                    {displayValue(summary.incomePendingCents)}
                  </div>
                </div>

                <div className="bg-red-50/70 dark:bg-red-950/20 p-2.5 rounded-xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-1 text-red-700 dark:text-red-400 text-xs font-semibold">
                    <TrendingDown size={13} />
                    <span>Despesas Pagas</span>
                  </div>
                  <div className="text-sm font-bold text-red-700 dark:text-red-300 mt-1">
                    {displayValue(summary.expensePaidCents)}
                  </div>
                </div>

                <div className="bg-orange-50/70 dark:bg-orange-950/20 p-2.5 rounded-xl border border-orange-100 dark:border-orange-900/30">
                  <div className="flex items-center gap-1 text-orange-700 dark:text-orange-400 text-xs font-semibold">
                    <Clock size={13} />
                    <span>Contas a Pagar</span>
                  </div>
                  <div className="text-sm font-bold text-orange-700 dark:text-orange-300 mt-1">
                    {displayValue(summary.expensePendingCents)}
                  </div>
                </div>
              </div>

              <div className="text-center pt-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">Toque para recolher</span>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};