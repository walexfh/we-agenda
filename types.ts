
export type ItemType = 'appointment' | 'income' | 'expense';

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CalendarItem {
  id: string;
  date: Date; // Normalized to start of day
  type: ItemType;
  title: string;
  description?: string;
  
  // Appointment Specifics
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  color?: string;     // Hex code or tailwind class reference
  alertMinutes?: number; // Minutes before event to alert
  
  // Finance Specifics
  amount?: number;
  isPaid?: boolean;
  
  // Recurrence Tracking (for edit logic mostly)
  recurrenceId?: string; 
}

export interface FilterState {
  showAppointments: boolean;
  showFinances: boolean;
  showIncome: boolean;
  showExpenses: boolean;
  showPaidOnly: boolean;
  showUnpaidOnly: boolean;
}

export interface DaySummary {
  date: Date;
  items: CalendarItem[];
  totalIncome: number;
  totalExpense: number;
  hasAppointment: boolean;
}

export interface UserProfile {
  name: string;
  avatar?: string;
}
