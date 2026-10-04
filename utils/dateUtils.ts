import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  addWeeks, 
  addMonths 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarItem, RecurrenceType } from '../types';

export const generateCalendarDays = (currentDate: Date) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });

  return eachDayOfInterval({
    start: startDate,
    end: endDate,
  });
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const generateRecurringItems = (baseItem: CalendarItem, frequency: RecurrenceType): CalendarItem[] => {
  const items: CalendarItem[] = [];
  const count = 12; // Limit generated items for MVP simplicity
  
  // If editing an existing item, we treat it as "once" for the generator unless specifically handling complex recurrence editing
  // For this MVP, we generate distinct items when "saving" a new item.
  
  for (let i = 0; i < (frequency === 'once' ? 1 : count); i++) {
    let nextDate = new Date(baseItem.date);

    switch (frequency) {
      case 'daily':
        nextDate = addDays(baseItem.date, i);
        break;
      case 'weekly':
        nextDate = addWeeks(baseItem.date, i);
        break;
      case 'biweekly':
        nextDate = addWeeks(baseItem.date, i * 2);
        break;
      case 'monthly':
        nextDate = addMonths(baseItem.date, i);
        break;
      case 'once':
      default:
        nextDate = baseItem.date;
        break;
    }

    items.push({
      ...baseItem,
      id: i === 0 ? baseItem.id : `${baseItem.id}-${i}`, // unique IDs
      date: nextDate,
      recurrenceId: frequency !== 'once' ? baseItem.id : undefined
    });
  }

  return items;
};

export const formatDateDisplay = (date: Date) => {
  return format(date, "d 'de' MMMM", { locale: ptBR });
};

export const formatMonthYear = (date: Date) => {
  return format(date, "MMMM yyyy", { locale: ptBR });
};