import React, { useState, useMemo, useEffect } from 'react';
import { CalendarItem, Category } from '../types';
import { formatCurrency, getPaidAmountCents, getRemainingAmountCents, getPaymentStatus } from '../utils/moneyUtils';
import { getAllCategories, getCategoryById } from '../utils/categoryUtils';
import { formatDateToISO } from '../utils/dateUtils';
import { 
  Search, X, Calendar, ArrowUpCircle, ArrowDownCircle, CheckSquare, 
  Square, Edit2, Tag, Filter, CheckCircle2, Clock, Layers
} from 'lucide-react';
import clsx from 'clsx';
import { startOfMonth, endOfMonth, addDays, startOfYear, endOfYear } from 'date-fns';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CalendarItem[];
  customCategories?: Category[];
  onEditItem: (item: CalendarItem) => void;
  onTogglePaid: (item: CalendarItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  items,
  customCategories,
  onEditItem,
  onTogglePaid,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'appointment' | 'income' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'next7' | 'next30' | 'year'>('all');

  const categories = useMemo(() => getAllCategories(customCategories), [customCategories]);

  // Fecha com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtra itens
  const filteredItems = useMemo(() => {
    const today = new Date();
    const todayISO = formatDateToISO(today);

    let periodStart = '';
    let periodEnd = '';

    if (periodFilter === 'month') {
      periodStart = formatDateToISO(startOfMonth(today));
      periodEnd = formatDateToISO(endOfMonth(today));
    } else if (periodFilter === 'next7') {
      periodStart = todayISO;
      periodEnd = formatDateToISO(addDays(today, 7));
    } else if (periodFilter === 'next30') {
      periodStart = todayISO;
      periodEnd = formatDateToISO(addDays(today, 30));
    } else if (periodFilter === 'year') {
      periodStart = formatDateToISO(startOfYear(today));
      periodEnd = formatDateToISO(endOfYear(today));
    }

    const query = searchTerm.trim().toLowerCase();

    return items.filter(item => {
      // 1. Filtro de Texto
      if (query) {
        const titleMatch = item.title.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query) ?? false;
        const catObj = getCategoryById(item.category, customCategories);
        const catMatch = catObj?.name.toLowerCase().includes(query) ?? false;

        if (!titleMatch && !descMatch && !catMatch) return false;
      }

      // 2. Filtro de Tipo
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      // 3. Filtro de Status
      if (statusFilter !== 'all') {
        if (item.type === 'appointment') {
          return false;
        }
        const pStatus = getPaymentStatus(item);
        if (pStatus !== statusFilter) return false;
      }

      // 4. Filtro de Categoria
      if (categoryFilter !== 'all') {
        if (item.category !== categoryFilter) return false;
      }

      // 5. Filtro de Período
      if (periodFilter !== 'all') {
        const itemISO = item.dateStr || formatDateToISO(item.date);
        if (itemISO < periodStart || itemISO > periodEnd) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.dateStr || formatDateToISO(a.date);
      const dateB = b.dateStr || formatDateToISO(b.date);
      return dateB.localeCompare(dateA); // Mais recentes primeiro
    });
  }, [items, searchTerm, typeFilter, statusFilter, categoryFilter, periodFilter, customCategories]);

  // Totais do conjunto filtrado
  const filterTotals = useMemo(() => {
    let incomeCents = 0;
    let expenseCents = 0;
    let appointmentCount = 0;

    for (const item of filteredItems) {
      if (item.type === 'income') {
        incomeCents += item.amountCents || 0;
      } else if (item.type === 'expense') {
        expenseCents += item.amountCents || 0;
      } else {
        appointmentCount++;
      }
    }

    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      appointmentCount,
      totalCount: filteredItems.length,
    };
  }, [filteredItems]);

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[65] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
        
        {/* Header e Busca */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <Search size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Busca Global & Filtros</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por título, descrição ou categoria..."
              className="w-full pl-10 pr-10 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white shadow-inner"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filtros em Linha */}
          <div className="flex flex-wrap gap-2 text-xs pt-1">
            {/* Tipo */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Todos os Tipos</option>
              <option value="appointment">Compromissos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="paid">Pagos / Recebidos</option>
              <option value="partial">Parcialmente Pagos</option>
              <option value="unpaid">Pendentes</option>
            </select>

            {/* Categoria */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Período */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Todo o Período</option>
              <option value="month">Mês Atual</option>
              <option value="next7">Próximos 7 Dias</option>
              <option value="next30">Próximos 30 Dias</option>
              <option value="year">Este Ano</option>
            </select>
          </div>
        </div>

        {/* Barra de Totais Filtrados */}
        <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400 font-medium">
            {filterTotals.totalCount} {filterTotals.totalCount === 1 ? 'registro encontrado' : 'registros encontrados'}
          </span>
          <div className="flex gap-3 sm:gap-4 font-semibold">
            {filterTotals.incomeCents > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">
                + {formatCurrency(filterTotals.incomeCents)}
              </span>
            )}
            {filterTotals.expenseCents > 0 && (
              <span className="text-red-500 dark:text-red-400">
                - {formatCurrency(filterTotals.expenseCents)}
              </span>
            )}
            {(filterTotals.incomeCents > 0 || filterTotals.expenseCents > 0) && (
              <span className={filterTotals.balanceCents >= 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-500"}>
                Líq: {formatCurrency(filterTotals.balanceCents)}
              </span>
            )}
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {filteredItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
              <Search size={40} className="opacity-20 mb-2" />
              <p className="font-medium text-sm">Nenhum registro encontrado para os filtros selecionados.</p>
              <p className="text-xs text-gray-400 mt-1">Tente ajustar o termo de busca ou limpar os filtros.</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const catObj = getCategoryById(item.category, customCategories);
              const pStatus = getPaymentStatus(item);
              const paidCents = getPaidAmountCents(item);
              const remainingCents = getRemainingAmountCents(item);

              return (
                <div 
                  key={item.id}
                  onClick={() => {
                    onEditItem(item);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/60 hover:border-blue-200 dark:hover:border-blue-700/60 hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Badge do Tipo */}
                    <div 
                      className={clsx(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                        item.type === 'appointment' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" :
                        item.type === 'income' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" :
                        "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      )}
                    >
                      {item.type === 'appointment' ? <Calendar size={18} /> :
                       item.type === 'income' ? <ArrowUpCircle size={18} /> :
                       <ArrowDownCircle size={18} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={clsx("font-semibold text-sm text-gray-800 dark:text-gray-100", item.isPaid && "line-through text-gray-400 dark:text-gray-500")}>
                          {item.title}
                        </h4>

                        {/* Categoria */}
                        {catObj && (
                          <span 
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: catObj.color }}
                          >
                            <Tag size={10} /> {catObj.name}
                          </span>
                        )}

                        {/* Parcela */}
                        {item.installment && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            <Layers size={10} /> {item.installment.current}/{item.installment.total}
                          </span>
                        )}

                        {/* Status Parcial */}
                        {pStatus === 'partial' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            Parcial ({formatCurrency(paidCents)} pago)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span>{item.dateStr}</span>
                        {item.type === 'appointment' ? (
                          <span>• {item.startTime} - {item.endTime}</span>
                        ) : (
                          <span>
                            • Restante: {formatCurrency(remainingCents)}
                          </span>
                        )}
                        {item.description && (
                          <span className="truncate max-w-[200px] text-gray-400">• {item.description}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Valores e Ações */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                    {item.type !== 'appointment' && (
                      <span className={clsx("font-bold text-sm", item.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                        {formatCurrency(item.amountCents || 0)}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {item.type !== 'appointment' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePaid(item);
                          }}
                          title={item.isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                          className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {item.isPaid ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditItem(item);
                          onClose();
                        }}
                        title="Editar lançamento"
                        className="p-2 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
