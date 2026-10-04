import React from 'react';
import { format, isSameMonth, isSameDay, isToday } from 'date-fns';
import { CalendarItem, FilterState } from '../types';
import { generateCalendarDays, formatDateToISO } from '../utils/dateUtils';
import { getPaymentStatus } from '../utils/moneyUtils';
import clsx from 'clsx';

interface CalendarGridProps {
  currentDate: Date;
  items: CalendarItem[];
  filters: FilterState;
  onDayClick: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, items, filters, onDayClick }) => {
  const days = generateCalendarDays(currentDate);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 shrink-0">
        {weekDays.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-gray-100 dark:bg-gray-800 gap-[1px] border-b border-gray-200 dark:border-gray-800 min-h-0">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const dayISO = formatDateToISO(day);
          const dayItems = items.filter(item => (item.dateStr ? item.dateStr === dayISO : isSameDay(item.date, day)));
          
          // Apply filters
          const visibleItems = dayItems.filter(item => {
             if (item.type === 'appointment') return filters.showAppointments;
             
             // Finance logic
             const isFinance = item.type === 'income' || item.type === 'expense';
             if (!isFinance) return false;
             if (!filters.showFinances) return false;
             
             if (item.type === 'income' && !filters.showIncome) return false;
             if (item.type === 'expense' && !filters.showExpenses) return false;
             
             // Filtro de Categoria
             if (filters.selectedCategory && item.category !== filters.selectedCategory) {
               return false;
             }

             // Filtro de Status de Pagamento
             if (filters.paymentStatusFilter && filters.paymentStatusFilter !== 'all') {
               const pStatus = getPaymentStatus(item);
               if (pStatus !== filters.paymentStatusFilter) return false;
             } else {
               if (filters.showPaidOnly && !item.isPaid) return false;
               if (filters.showUnpaidOnly && item.isPaid) return false;
             }
             
             return true;
          });

          // Sort: Appointments (with time) first, then by creation/id
          visibleItems.sort((a, b) => {
             if (a.type === 'appointment' && b.type !== 'appointment') return -1;
             if (a.type !== 'appointment' && b.type === 'appointment') return 1;
             // If both appointments, sort by time
             if (a.type === 'appointment' && b.type === 'appointment') {
                 return (a.startTime || '').localeCompare(b.startTime || '');
             }
             return 0;
          });

          // Limit displayed items to prevent layout breaking
          const MAX_VISIBLE = 4; 
          const displayItems = visibleItems.slice(0, MAX_VISIBLE);
          const hiddenCount = Math.max(0, visibleItems.length - MAX_VISIBLE);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={clsx(
                "relative flex flex-col items-center justify-start py-1 px-0.5 transition-colors outline-none overflow-hidden",
                isCurrentMonth ? "bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-950 text-gray-400 dark:text-gray-600",
                isToday(day) && "bg-blue-50/30 dark:bg-blue-900/10"
              )}
            >
              {/* Day Number */}
              <span 
                className={clsx(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 shrink-0",
                  isToday(day) 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none" 
                    : isCurrentMonth ? "text-gray-700 dark:text-gray-300" : "text-gray-300 dark:text-gray-700"
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Items List */}
              <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                {displayItems.map((item) => {
                  const pStatus = getPaymentStatus(item);

                  return (
                    <div 
                      key={item.id}
                      className={clsx(
                        "w-full text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate text-white font-medium text-left shadow-sm flex items-center justify-between",
                        item.isPaid && "opacity-60 line-through decoration-white/70"
                      )}
                      style={{ 
                        backgroundColor: item.type === 'appointment' 
                          ? (item.color || '#3b82f6') 
                          : (item.type === 'income' ? '#10b981' : '#ef4444') 
                      }}
                    >
                      <span className="truncate">{item.title}</span>
                      {pStatus === 'partial' && (
                        <span className="ml-0.5 shrink-0 text-[8px] bg-amber-400 text-gray-900 font-bold px-0.5 rounded">
                          ½
                        </span>
                      )}
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="text-[9px] text-gray-400 dark:text-gray-500 font-medium leading-none mt-0.5">
                    +{hiddenCount} mais
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};