export type ItemType = 'appointment' | 'income' | 'expense';

// Separate type for the visual tab in modal as requested in Etapa 1.B
export type ModalTabType = 'appointment' | 'finance';

export type FinanceType = 'income' | 'expense';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type RecurrenceType = 'once' | RecurrenceFrequency;

export interface RecurrenceRule {
  seriesId: string;
  frequency: RecurrenceFrequency;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD (optional, if series has an end date)
  count?: number;     // Optional number of occurrences
  originalDayOfMonth?: number; // Clamps to last day in shorter months, restores on 31-day months
}

export interface SeriesException {
  originalDate: string; // YYYY-MM-DD
  isDeleted?: boolean;
  isPaid?: boolean;
  overrides?: Partial<Omit<CalendarItem, 'id' | 'seriesId'>>;
}

export interface RecurrenceSeries {
  id: string; // seriesId
  rule: RecurrenceRule;
  templateItem: Omit<CalendarItem, 'id' | 'date' | 'dateStr' | 'seriesId' | 'isVirtualOccurrence'>;
  exceptions: Record<string, SeriesException>; // key: YYYY-MM-DD
}

export interface CalendarItem {
  id: string;
  date: Date; // Normalized to start of day in local time
  dateStr: string; // YYYY-MM-DD format to prevent timezone offset shifts
  type: ItemType;
  title: string;
  description?: string;
  
  // Appointment Specifics
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  color?: string;     // Hex code or tailwind class reference
  alertMinutes?: number; // Minutes before event to alert (or advance offset)
  alertTime?: string;    // HH:mm for full-day/finance items (default '08:00')
  
  // Finance Specifics
  amountCents?: number; // Integer cents (e.g. 3350 for R$ 33,50)
  amount?: number;      // Deprecated float amount kept for backward migration
  isPaid?: boolean;
  
  // Recurrence Tracking
  seriesId?: string;       // Series ID for recurring engine
  recurrenceId?: string;   // Legacy recurrence ID preserved
  isVirtualOccurrence?: boolean; // Generated dynamically for visible calendar window
  originalDateStr?: string; // For series exceptions mapping
}

export type ReminderStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'dismissed';
export type ReminderChannel = 'browser_notification' | 'web_push' | 'whatsapp';

export interface ReminderItem {
  id: string;
  userId?: string;
  itemId: string;
  channel: ReminderChannel;
  scheduledAt: string; // ISO 8601 UTC
  status: ReminderStatus;
  title: string;
  body: string;
  advanceMinutes: number;
  timezone: string;
  sentAt?: string;
  errorMessage?: string;
  createdAt?: string;
}

export interface FilterState {
  showAppointments: boolean;
  showFinances: boolean;
  showIncome: boolean;
  showExpenses: boolean;
  showPaidOnly: boolean;
  showUnpaidOnly: boolean;
}

export interface FinancialSummary {
  incomeReceivedCents: number; // Receitas recebidas (pagas)
  expensePaidCents: number;    // Despesas pagas (pagas)
  incomePendingCents: number;  // Contas a receber (pendentes)
  expensePendingCents: number; // Contas a pagar (pendentes)
  realizedResultCents: number; // incomeReceivedCents - expensePaidCents
  forecastResultCents: number; // (incomeReceivedCents + incomePendingCents) - (expensePaidCents + expensePendingCents)
}

export interface DaySummary {
  date: Date;
  dateStr: string;
  items: CalendarItem[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  hasAppointment: boolean;
}

export interface UserProfile {
  name: string;
  avatar?: string;
  timezone?: string; // e.g. 'America/Sao_Paulo'
  assistantName?: string; // e.g. 'Jarves'
}

export type AssistantIntentType = 
  | 'create_expense' 
  | 'create_income' 
  | 'create_appointment' 
  | 'query_schedule' 
  | 'query_balance' 
  | 'unknown';

export interface AssistantParsedAction {
  intent: AssistantIntentType;
  confidence: number;
  itemToSave?: Omit<CalendarItem, 'id'>;
  recurrence?: RecurrenceType;
  queryDateStr?: string;
  explanation: string;
  confirmationMessage?: string;
}

export interface AssistantChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  status?: 'processing' | 'saved' | 'error';
  itemSaved?: CalendarItem;
}

export interface StorageRecoveryInfo {
  userId: string;
  corruptedKey: string;
  rawContent: string;
  timestamp: number;
}
