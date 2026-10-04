import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { 
  CalendarItem, 
  FilterState, 
  RecurrenceType, 
  UserProfile, 
  RecurrenceSeries, 
  FinancialSummary 
} from './types';
import { 
  formatMonthYear, 
  formatDateToISO, 
  generateCalendarDays, 
  isEndTimeAfterStartTime 
} from './utils/dateUtils';
import { formatCurrency } from './utils/moneyUtils';
import { 
  generateOccurrencesForInterval, 
  deleteSingleOccurrence, 
  deleteFutureOccurrences, 
  updateSingleOccurrence, 
  splitAndAdvanceSeries, 
  toggleSeriesOccurrencePaid 
} from './utils/recurrenceUtils';
import { 
  loadUserData, 
  saveUserData, 
  saveUserProfile, 
  generateUUID 
} from './utils/storageManager';
import { 
  isSupabaseConfigured, 
  supabase 
} from './services/supabaseClient';
import { 
  signOut as authSignOut, 
  getActiveSession 
} from './services/authService';
import { 
  fetchCloudData, 
  syncUpsertItem, 
  syncDeleteItem, 
  syncUpsertSeries, 
  syncDeleteSeries, 
  importLocalRecordsToCloud, 
  SyncStatus 
} from './services/syncService';
import { CalendarGrid } from './components/CalendarGrid';
import { FilterMenu } from './components/FilterMenu';
import { SideMenu } from './components/SideMenu';
import { EventModal } from './components/EventModal';
import { DeleteModal } from './components/DeleteModal';
import { BalanceSummary } from './components/BalanceSummary';
import { LoginScreen } from './components/LoginScreen';
import { ImportModal } from './components/ImportModal';
import { DEFAULT_TIMEZONE } from './utils/reminderUtils';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  registerServiceWorker, 
  reconcileReminders, 
  ReminderWatcher 
} from './services/reminderService';
import { 
  Calendar, 
  Filter, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  Trash2, 
  CheckSquare, 
  Square, 
  X, 
  Edit2, 
  AlertTriangle, 
  Copy, 
  Check, 
  CloudCheck, 
  CloudOff, 
  RefreshCw,
  Bell,
  BellOff,
  Globe
} from 'lucide-react';
import clsx from 'clsx';

export default function App() {
  // --- Authentication / User State ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem('fincal_current_user');
  });

  const [authType, setAuthType] = useState<'cloud' | 'local'>(() => {
    return (localStorage.getItem('fincal_auth_type') as 'cloud' | 'local') || 'local';
  });

  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('fincal_user_email') || '';
  });

  // --- Sincronização & Nuvem ---
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    const isCloud = localStorage.getItem('fincal_auth_type') === 'cloud';
    return isCloud && isSupabaseConfigured() ? 'synced' : 'local_demo';
  });

  // --- Importação Explícita de Dados Locais ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [unimportedLocalData, setUnimportedLocalData] = useState<{
    items: CalendarItem[];
    series: RecurrenceSeries[];
  } | null>(null);

  // --- Data State ---
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [series, setSeries] = useState<RecurrenceSeries[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  
  // --- Lembretes e Fuso Horário (Etapa 3) ---
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    return getNotificationPermission();
  });
  const [activeAlertToast, setActiveAlertToast] = useState<{ title: string; body: string; id: string } | null>(null);

  const accountTimezone = userProfile.timezone || DEFAULT_TIMEZONE;

  // Storage & Recovery State
  const [storageError, setStorageError] = useState<string | null>(null);
  const [corruptedState, setCorruptedState] = useState<{ rawContent: string; backupKey: string } | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
     return localStorage.getItem('fincal_theme') === 'dark';
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // UI State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [showValues, setShowValues] = useState(true);
  
  // Edit & Delete State
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CalendarItem | null>(null);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    showAppointments: true,
    showFinances: true,
    showIncome: true,
    showExpenses: true,
    showPaidOnly: false,
    showUnpaidOnly: false,
  });

  // Verifica se há registros locais prévios elegíveis para importação
  const checkLocalDataForImport = useCallback((cloudUserId: string) => {
    const importDismissed = localStorage.getItem(`fincal_import_dismissed_${cloudUserId}`);
    if (importDismissed === 'true') return;

    // Procura por dados salvos em contas locais antigas (ex: 'demo' ou usuários locais)
    const localUsers = JSON.parse(localStorage.getItem('fincal_users') || '[]');
    const candidateKeys = ['demo', ...localUsers.map((u: any) => u.username)];
    
    let candidateItems: CalendarItem[] = [];
    let candidateSeries: RecurrenceSeries[] = [];

    for (const key of candidateKeys) {
      if (key && key !== cloudUserId) {
        const loaded = loadUserData(key);
        if (loaded.status === 'success' && (loaded.items.length > 0 || loaded.series.length > 0)) {
          candidateItems.push(...loaded.items);
          candidateSeries.push(...loaded.series);
        }
      }
    }

    if (candidateItems.length > 0 || candidateSeries.length > 0) {
      setUnimportedLocalData({ items: candidateItems, series: candidateSeries });
      setIsImportModalOpen(true);
    }
  }, []);

  // Monitora sessão Supabase e recarrega dados da nuvem quando autenticado
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Carrega sessão inicial
    getActiveSession().then(session => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        setAuthType('cloud');
        setUserEmail(session.user.email || '');
        localStorage.setItem('fincal_current_user', session.user.id);
        localStorage.setItem('fincal_auth_type', 'cloud');
        localStorage.setItem('fincal_user_email', session.user.email || '');
      }
    });

    // Ouve alterações no estado da autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setCurrentUserId(session.user.id);
        setAuthType('cloud');
        setUserEmail(session.user.email || '');
        localStorage.setItem('fincal_current_user', session.user.id);
        localStorage.setItem('fincal_auth_type', 'cloud');
        localStorage.setItem('fincal_user_email', session.user.email || '');

        setSyncStatus('syncing');
        const cloudData = await fetchCloudData(session.user.id);
        if (cloudData.success) {
          setItems(cloudData.items || []);
          setSeries(cloudData.series || []);
          setUserProfile(cloudData.profile || { name: session.user.email?.split('@')[0] || '' });
          setSyncStatus('synced');
          checkLocalDataForImport(session.user.id);
        } else {
          setSyncStatus('error');
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setAuthType('local');
        setUserEmail('');
        localStorage.removeItem('fincal_current_user');
        localStorage.removeItem('fincal_auth_type');
        localStorage.removeItem('fincal_user_email');
        setItems([]);
        setSeries([]);
        setUserProfile({ name: '' });
        setSyncStatus('local_demo');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [checkLocalDataForImport]);

  // Carrega os dados (Nuvem ou Local) ao alterar currentUserId
  useEffect(() => {
    if (!currentUserId) {
      setItems([]);
      setSeries([]);
      setUserProfile({ name: '' });
      setCorruptedState(null);
      return;
    }

    if (authType === 'cloud' && isSupabaseConfigured()) {
      setSyncStatus('syncing');
      fetchCloudData(currentUserId).then(result => {
        if (result.success) {
          setItems(result.items || []);
          setSeries(result.series || []);
          if (result.profile) setUserProfile(result.profile);
          setSyncStatus('synced');
          checkLocalDataForImport(currentUserId);
        } else {
          setSyncStatus('error');
          // Fallback para storage local em caso de instabilidade
          const localFallback = loadUserData(currentUserId);
          if (localFallback.status === 'success') {
            setItems(localFallback.items);
            setSeries(localFallback.series);
          }
        }
      });
    } else {
      // Modo Local de Demonstração
      const result = loadUserData(currentUserId);
      if (result.status === 'success') {
        setItems(result.items);
        setSeries(result.series);
        setUserProfile(result.profile);
        setCorruptedState(null);
        setSyncStatus('local_demo');
      } else if (result.status === 'corrupted') {
        setCorruptedState({
          rawContent: result.rawContent,
          backupKey: result.backupKey,
        });
        setStorageError(result.error);
      } else if (result.status === 'unavailable') {
        setStorageError(result.error);
      }
    }
  }, [currentUserId, authType, checkLocalDataForImport]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('fincal_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fincal_theme', 'light');
    }
  }, [isDarkMode]);

  // Tecla Escape para fechar DayDetails Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDayDetailsOpen) {
        setIsDayDetailsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDayDetailsOpen]);

  // Registro de Service Worker para Web Push e notificações em segundo plano (Etapa 3)
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Daemon de checagem de lembretes ativos com alerta in-app e disparo de notificação
  useEffect(() => {
    const watcher = new ReminderWatcher((reminder) => {
      setActiveAlertToast({
        id: reminder.id,
        title: reminder.title,
        body: reminder.body,
      });
    });
    watcher.start();
    return () => watcher.stop();
  }, []);

  // Reconciliação automática da fila de lembretes sempre que a agenda ou fuso mudam
  useEffect(() => {
    if (currentUserId && items.length > 0) {
      reconcileReminders(items, currentUserId, accountTimezone);
    }
  }, [items, currentUserId, accountTimezone]);

  const handleRequestNotificationPermission = async () => {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
  };

  // --- Ocorrências Dinâmicas de Séries Recorrentes ---
  const allVisibleItems = useMemo(() => {
    const days = generateCalendarDays(currentDate);
    if (days.length === 0) return items;

    const intervalStart = days[0];
    const intervalEnd = days[days.length - 1];

    const generatedOccurrences: CalendarItem[] = [];
    for (const s of series) {
      const occurrences = generateOccurrencesForInterval(s, intervalStart, intervalEnd);
      generatedOccurrences.push(...occurrences);
    }

    const nonVirtualItems = items.filter(i => !i.isVirtualOccurrence);
    const seenIds = new Set<string>();
    const combined: CalendarItem[] = [];

    for (const it of [...nonVirtualItems, ...generatedOccurrences]) {
      if (!seenIds.has(it.id)) {
        seenIds.add(it.id);
        combined.push(it);
      }
    }

    return combined;
  }, [items, series, currentDate]);

  // --- Resumo Financeiro ---
  const monthlySummary = useMemo<FinancialSummary>(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startISO = formatDateToISO(monthStart);
    const endISO = formatDateToISO(monthEnd);

    const monthlyItems = allVisibleItems.filter(item => {
      const iso = item.dateStr || formatDateToISO(item.date);
      return iso >= startISO && iso <= endISO;
    });

    let incomeReceivedCents = 0;
    let expensePaidCents = 0;
    let incomePendingCents = 0;
    let expensePendingCents = 0;

    for (const item of monthlyItems) {
      const amount = item.amountCents || 0;
      if (item.type === 'income') {
        if (item.isPaid) {
          incomeReceivedCents += amount;
        } else {
          incomePendingCents += amount;
        }
      } else if (item.type === 'expense') {
        if (item.isPaid) {
          expensePaidCents += amount;
        } else {
          expensePendingCents += amount;
        }
      }
    }

    const realizedResultCents = incomeReceivedCents - expensePaidCents;
    const forecastResultCents = (incomeReceivedCents + incomePendingCents) - (expensePaidCents + expensePendingCents);

    return {
      incomeReceivedCents,
      expensePaidCents,
      incomePendingCents,
      expensePendingCents,
      realizedResultCents,
      forecastResultCents,
    };
  }, [currentDate, allVisibleItems]);

  // --- Itens do Dia Selecionado ---
  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    const selectedDateISO = formatDateToISO(selectedDate);
    
    return allVisibleItems.filter(item => {
      const itemISO = item.dateStr || formatDateToISO(item.date);
      return itemISO === selectedDateISO;
    }).filter(item => {
      if (item.type === 'appointment' && !filters.showAppointments) return false;
      if ((item.type === 'income' || item.type === 'expense') && !filters.showFinances) return false;
      if (item.type === 'income' && !filters.showIncome) return false;
      if (item.type === 'expense' && !filters.showExpenses) return false;
      
      if (filters.showPaidOnly && (item.type === 'income' || item.type === 'expense') && !item.isPaid) return false;
      if (filters.showUnpaidOnly && (item.type === 'income' || item.type === 'expense') && item.isPaid) return false;

      return true;
    });
  }, [selectedDate, allVisibleItems, filters]);

  // --- Handlers de Autenticação ---
  const handleLoginLocal = (username: string, name: string) => {
    setCurrentUserId(username);
    setAuthType('local');
    localStorage.setItem('fincal_current_user', username);
    localStorage.setItem('fincal_auth_type', 'local');
    setSyncStatus('local_demo');

    const loaded = loadUserData(username);
    if (loaded.status === 'success') {
      setItems(loaded.items);
      setSeries(loaded.series);
      const profile = loaded.profile.name ? loaded.profile : { name };
      setUserProfile(profile);
      saveUserProfile(username, profile);
      setCorruptedState(null);
    }
  };

  const handleLoginCloudSuccess = (userId: string, email: string, name: string) => {
    setCurrentUserId(userId);
    setAuthType('cloud');
    setUserEmail(email);
    setUserProfile({ name: name || email.split('@')[0] });
    localStorage.setItem('fincal_current_user', userId);
    localStorage.setItem('fincal_auth_type', 'cloud');
    localStorage.setItem('fincal_user_email', email);
    setSyncStatus('syncing');

    fetchCloudData(userId).then(result => {
      if (result.success) {
        setItems(result.items || []);
        setSeries(result.series || []);
        if (result.profile?.name) setUserProfile(result.profile);
        setSyncStatus('synced');
        checkLocalDataForImport(userId);
      } else {
        setSyncStatus('error');
      }
    });
  };

  const handleLogout = async () => {
    if (authType === 'cloud') {
      await authSignOut();
    }
    setCurrentUserId(null);
    setAuthType('local');
    setUserEmail('');
    localStorage.removeItem('fincal_current_user');
    localStorage.removeItem('fincal_auth_type');
    localStorage.removeItem('fincal_user_email');
    setItems([]);
    setSeries([]);
    setUserProfile({ name: '' });
    setIsSideMenuOpen(false);
  };

  const handleUpdateProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    if (currentUserId) {
      if (authType === 'local') {
        saveUserProfile(currentUserId, newProfile);
      } else if (isSupabaseConfigured() && supabase) {
        supabase.from('profiles').upsert({
          id: currentUserId,
          name: newProfile.name,
          avatar_url: newProfile.avatar || '',
          updated_at: new Date().toISOString(),
        });
      }
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDayDetailsOpen(true);
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // --- Add / Edit Handlers ---
  const handleAddNewFromDrawer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(null);
    setIsDayDetailsOpen(false);
    setIsAddModalOpen(true);
  };

  const handleEditClick = (item: CalendarItem) => {
    setEditingItem(item);
    setSelectedDate(item.date); 
    setIsDayDetailsOpen(false); 
    setIsAddModalOpen(true);
  };

  // Salva itens com sincronização em nuvem e persistência local resiliente
  const handleSaveItem = useCallback(async (
    baseItem: Omit<CalendarItem, 'id'>, 
    recurrence: RecurrenceType, 
    editScope: 'single' | 'sequence' = 'single'
  ): Promise<boolean> => {
    if (!currentUserId) return false;

    const trimmedTitle = String(baseItem.title || '').trim();
    if (!trimmedTitle) {
      setStorageError('Título obrigatório.');
      return false;
    }

    if (!baseItem.dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(baseItem.dateStr)) {
      setStorageError('Data inválida.');
      return false;
    }

    if (baseItem.type === 'income' || baseItem.type === 'expense') {
      if (baseItem.amountCents === undefined || baseItem.amountCents <= 0) {
        setStorageError('Valor financeiro inválido ou menor/igual a zero.');
        return false;
      }
    }

    if (baseItem.type === 'appointment') {
      if (!baseItem.startTime || !baseItem.endTime) {
        setStorageError('Horários de início e término são obrigatórios.');
        return false;
      }
      if (!isEndTimeAfterStartTime(baseItem.startTime, baseItem.endTime)) {
        setStorageError('O horário de término deve ser posterior ao horário de início no mesmo dia.');
        return false;
      }
    }

    let nextItems = [...items];
    let nextSeries = [...series];
    let touchedItem: CalendarItem | null = null;
    let touchedSeries: RecurrenceSeries | null = null;

    if (editingItem) {
      if (editingItem.seriesId) {
        const targetSeriesIndex = nextSeries.findIndex(s => s.id === editingItem.seriesId);
        if (targetSeriesIndex >= 0) {
          const targetSeries = nextSeries[targetSeriesIndex];
          const occurrenceDateStr = editingItem.originalDateStr || editingItem.dateStr;

          if (editScope === 'single') {
            const updated = updateSingleOccurrence(targetSeries, occurrenceDateStr, {
              title: trimmedTitle,
              description: baseItem.description,
              type: baseItem.type,
              amountCents: baseItem.amountCents,
              isPaid: baseItem.isPaid,
              startTime: baseItem.startTime,
              endTime: baseItem.endTime,
              color: baseItem.color,
              alertMinutes: baseItem.alertMinutes,
            });
            nextSeries[targetSeriesIndex] = updated;
            touchedSeries = updated;
          } else {
            const newSeriesId = generateUUID();
            const { updatedOldSeries, newSeries } = splitAndAdvanceSeries(
              targetSeries,
              occurrenceDateStr,
              {
                title: trimmedTitle,
                description: baseItem.description,
                type: baseItem.type,
                amountCents: baseItem.amountCents,
                isPaid: baseItem.isPaid,
                startTime: baseItem.startTime,
                endTime: baseItem.endTime,
                color: baseItem.color,
                alertMinutes: baseItem.alertMinutes,
              },
              baseItem.dateStr,
              newSeriesId
            );

            if (updatedOldSeries) {
              nextSeries[targetSeriesIndex] = updatedOldSeries;
              nextSeries.push(newSeries);
              if (authType === 'cloud') {
                syncUpsertSeries(currentUserId, updatedOldSeries);
                syncUpsertSeries(currentUserId, newSeries);
              }
            } else {
              nextSeries[targetSeriesIndex] = newSeries;
              touchedSeries = newSeries;
            }
          }
        }
      } else if (editingItem.recurrenceId && editScope === 'sequence') {
        const timeDiff = baseItem.date.getTime() - editingItem.date.getTime();
        nextItems = nextItems.map(item => {
          if (item.recurrenceId === editingItem.recurrenceId && item.date.getTime() >= editingItem.date.getTime()) {
            const newDate = timeDiff !== 0 ? new Date(item.date.getTime() + timeDiff) : item.date;
            const updatedItem: CalendarItem = {
              ...item,
              ...baseItem,
              title: trimmedTitle,
              date: newDate,
              dateStr: formatDateToISO(newDate),
              id: item.id,
              recurrenceId: item.recurrenceId,
              isPaid: item.id === editingItem.id ? baseItem.isPaid : item.isPaid,
            };
            if (authType === 'cloud') syncUpsertItem(currentUserId, updatedItem);
            return updatedItem;
          }
          return item;
        });
      } else {
        nextItems = nextItems.map(item => {
          if (item.id === editingItem.id) {
            const updatedItem: CalendarItem = {
              ...item,
              ...baseItem,
              title: trimmedTitle,
              id: editingItem.id,
            };
            touchedItem = updatedItem;
            return updatedItem;
          }
          return item;
        });
      }
    } else {
      // Criação de NOVO
      if (recurrence === 'once') {
        const newItem: CalendarItem = {
          ...baseItem,
          title: trimmedTitle,
          id: generateUUID(),
        };
        nextItems.push(newItem);
        touchedItem = newItem;
      } else {
        const seriesId = generateUUID();
        const [, , startDay] = baseItem.dateStr.split('-').map(Number);
        const newRecurrenceSeries: RecurrenceSeries = {
          id: seriesId,
          rule: {
            seriesId,
            frequency: recurrence,
            startDate: baseItem.dateStr,
            originalDayOfMonth: recurrence === 'monthly' ? startDay : undefined,
          },
          templateItem: {
            title: trimmedTitle,
            description: baseItem.description,
            type: baseItem.type,
            amountCents: baseItem.amountCents,
            isPaid: baseItem.isPaid,
            startTime: baseItem.startTime,
            endTime: baseItem.endTime,
            color: baseItem.color,
            alertMinutes: baseItem.alertMinutes,
          },
          exceptions: {},
        };
        nextSeries.push(newRecurrenceSeries);
        touchedSeries = newRecurrenceSeries;
      }
    }

    // Persistência local segura
    saveUserData(currentUserId, nextItems, nextSeries);

    // Sincronização em nuvem se estiver autenticado no Supabase
    if (authType === 'cloud' && isSupabaseConfigured()) {
      setSyncStatus('syncing');
      try {
        if (touchedItem) await syncUpsertItem(currentUserId, touchedItem);
        if (touchedSeries) await syncUpsertSeries(currentUserId, touchedSeries);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }

    setItems(nextItems);
    setSeries(nextSeries);
    setEditingItem(null);
    return true;
  }, [currentUserId, authType, items, series, editingItem]);

  // --- Delete Handlers ---
  const handleDeleteRequest = (item: CalendarItem) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (scope: 'single' | 'sequence') => {
    if (!itemToDelete || !currentUserId) return;

    let nextItems = [...items];
    let nextSeries = [...series];

    if (itemToDelete.seriesId) {
      const seriesIndex = nextSeries.findIndex(s => s.id === itemToDelete.seriesId);
      if (seriesIndex >= 0) {
        const targetSeries = nextSeries[seriesIndex];
        const dateStr = itemToDelete.originalDateStr || itemToDelete.dateStr;

        if (scope === 'single') {
          const updated = deleteSingleOccurrence(targetSeries, dateStr);
          nextSeries[seriesIndex] = updated;
          if (authType === 'cloud') syncUpsertSeries(currentUserId, updated);
        } else {
          const updated = deleteFutureOccurrences(targetSeries, dateStr);
          if (updated) {
            nextSeries[seriesIndex] = updated;
            if (authType === 'cloud') syncUpsertSeries(currentUserId, updated);
          } else {
            nextSeries = nextSeries.filter(s => s.id !== itemToDelete.seriesId);
            if (authType === 'cloud') syncDeleteSeries(currentUserId, itemToDelete.seriesId);
          }
        }
      }
    } else if (scope === 'sequence' && itemToDelete.recurrenceId) {
      nextItems = nextItems.filter(item => {
        if (item.recurrenceId === itemToDelete.recurrenceId && item.date.getTime() >= itemToDelete.date.getTime()) {
          if (authType === 'cloud') syncDeleteItem(currentUserId, item.id);
          return false;
        }
        return true;
      });
    } else {
      nextItems = nextItems.filter(i => i.id !== itemToDelete.id);
      if (authType === 'cloud') syncDeleteItem(currentUserId, itemToDelete.id);
    }

    saveUserData(currentUserId, nextItems, nextSeries);
    setItems(nextItems);
    setSeries(nextSeries);
    setDeleteModalOpen(false);
    setItemToDelete(null);

    if (editingItem?.id === itemToDelete.id) {
      setEditingItem(null);
      setIsAddModalOpen(false);
    }
  };

  // Alterna status de pagamento
  const handleTogglePaid = (item: CalendarItem) => {
    if (!currentUserId) return;

    let nextItems = [...items];
    let nextSeries = [...series];

    if (item.seriesId) {
      const seriesIndex = nextSeries.findIndex(s => s.id === item.seriesId);
      if (seriesIndex >= 0) {
        const targetSeries = nextSeries[seriesIndex];
        const dateStr = item.originalDateStr || item.dateStr;
        const updated = toggleSeriesOccurrencePaid(targetSeries, dateStr, Boolean(item.isPaid));
        nextSeries[seriesIndex] = updated;
        if (authType === 'cloud') syncUpsertSeries(currentUserId, updated);
      }
    } else {
      nextItems = nextItems.map(i => {
        if (i.id === item.id) {
          const updated = { ...i, isPaid: !i.isPaid };
          if (authType === 'cloud') syncUpsertItem(currentUserId, updated);
          return updated;
        }
        return i;
      });
    }

    saveUserData(currentUserId, nextItems, nextSeries);
    setItems(nextItems);
    setSeries(nextSeries);
  };

  // Confirmação da importação de dados locais
  const handleConfirmImport = async (): Promise<boolean> => {
    if (!currentUserId || !unimportedLocalData) return false;

    setSyncStatus('syncing');
    const res = await importLocalRecordsToCloud(
      currentUserId,
      unimportedLocalData.items,
      unimportedLocalData.series
    );

    if (res.success) {
      localStorage.setItem(`fincal_import_dismissed_${currentUserId}`, 'true');
      const cloudData = await fetchCloudData(currentUserId);
      if (cloudData.success) {
        setItems(cloudData.items || []);
        setSeries(cloudData.series || []);
        setSyncStatus('synced');
      }
      setIsImportModalOpen(false);
      setUnimportedLocalData(null);
      return true;
    } else {
      setSyncStatus('error');
      return false;
    }
  };

  const handleCopyRawCorrupted = () => {
    if (corruptedState?.rawContent) {
      navigator.clipboard.writeText(corruptedState.rawContent);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const handleResetCorruptedAndContinue = () => {
    if (currentUserId && corruptedState) {
      saveUserData(currentUserId, [], []);
      setItems([]);
      setSeries([]);
      setCorruptedState(null);
      setStorageError(null);
    }
  };

  if (!currentUserId) {
    return (
      <LoginScreen 
        onLoginLocal={handleLoginLocal} 
        onLoginCloudSuccess={handleLoginCloudSuccess} 
      />
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col relative overflow-hidden transition-colors duration-300">
      
      {/* Alerta de Armazenamento Corrompido */}
      {corruptedState && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-red-200 dark:border-red-900/60">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle size={28} />
              <h2 className="text-xl font-bold">Arquivo de Dados Corrompido</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              Detectamos que o conteúdo armazenado no seu navegador está truncado ou em formato inválido.
              <strong> Seus dados originais NÃO foram apagados</strong>: uma cópia foi preservada com segurança na chave de emergência <code>{corruptedState.backupKey}</code>.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Conteúdo bruto preservado:
              </label>
              <textarea
                readOnly
                value={corruptedState.rawContent}
                rows={4}
                className="w-full p-2.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCopyRawCorrupted}
                className="flex-1 py-2.5 px-4 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl font-medium text-xs flex items-center justify-center gap-2 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                {copiedRaw ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                {copiedRaw ? 'Copiado!' : 'Copiar dados brutos'}
              </button>
              <button
                type="button"
                onClick={handleResetCorruptedAndContinue}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-md"
              >
                Iniciar novo armazenamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Flutuante de Alerta em Tempo Real (Etapa 3) */}
      {activeAlertToast && (
        <div 
          role="alert" 
          className="fixed top-4 right-4 z-[90] max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-purple-500 p-4 animate-in slide-in-from-top-4 duration-300 flex items-start gap-3"
        >
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl text-purple-600 dark:text-purple-300 shrink-0">
            <Bell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
              {activeAlertToast.title}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
              {activeAlertToast.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveAlertToast(null)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header className="px-4 py-3 bg-white dark:bg-gray-800 shadow-sm z-10 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSideMenuOpen(true)}
            aria-label="Abrir menu lateral"
            className="p-2 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <Menu size={24} />
          </button>

          {/* Indicador de Status de Sincronização / Modo */}
          <div 
            title={
              syncStatus === 'synced' ? 'Sincronizado com a nuvem' :
              syncStatus === 'syncing' ? 'Sincronizando alterações...' :
              syncStatus === 'error' ? 'Erro de sincronização. Clique para tentar novamente.' :
              'Modo Local de Demonstração (registros salvos apenas neste navegador)'
            }
            onClick={() => {
              if (syncStatus === 'error' && authType === 'cloud' && currentUserId) {
                setSyncStatus('syncing');
                fetchCloudData(currentUserId).then(r => setSyncStatus(r.success ? 'synced' : 'error'));
              }
            }}
            className={clsx(
              "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer",
              syncStatus === 'synced' && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
              syncStatus === 'syncing' && "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
              syncStatus === 'error' && "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800/40",
              syncStatus === 'local_demo' && "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
            )}
          >
            {syncStatus === 'synced' && <CloudCheck size={14} className="text-emerald-500" />}
            {syncStatus === 'syncing' && <RefreshCw size={13} className="text-blue-500 animate-spin" />}
            {syncStatus === 'error' && <AlertTriangle size={13} className="text-red-500" />}
            {syncStatus === 'local_demo' && <CloudOff size={13} className="text-amber-500" />}
            
            <span>
              {syncStatus === 'synced' && 'Nuvem Conectada'}
              {syncStatus === 'syncing' && 'Sincronizando...'}
              {syncStatus === 'error' && 'Falha ao Sincronizar'}
              {syncStatus === 'local_demo' && 'Modo Local'}
            </span>
          </div>

          {/* Indicador de Fuso Horário e Notificações (Etapa 3) */}
          <button
            type="button"
            onClick={handleRequestNotificationPermission}
            title={`Fuso Horário da conta: ${accountTimezone}. Clique para gerenciar permissão de lembretes.`}
            className={clsx(
              "hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer",
              notificationPermission === 'granted'
                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/40"
                : notificationPermission === 'denied'
                ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
            )}
          >
            {notificationPermission === 'granted' ? (
              <Bell size={13} className="text-purple-600 dark:text-purple-400" />
            ) : notificationPermission === 'denied' ? (
              <BellOff size={13} className="text-gray-400" />
            ) : (
              <Bell size={13} className="text-amber-500 animate-bounce" />
            )}
            <span>
              {accountTimezone.split('/')[1]?.replace('_', ' ') || accountTimezone}
              {notificationPermission === 'default' ? ' (Ativar)' : ''}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrevMonth} 
            aria-label="Mês anterior"
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white capitalize w-36 sm:w-40 text-center truncate">
            {formatMonthYear(currentDate)}
          </h1>
          <button 
            onClick={handleNextMonth} 
            aria-label="Próximo mês"
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <button 
          onClick={() => setIsFilterOpen(true)}
          aria-label="Filtros"
          className="p-2 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors relative"
        >
          <Filter size={22} />
          {(!filters.showAppointments || !filters.showFinances || filters.showPaidOnly || filters.showUnpaidOnly) && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-800" />
          )}
        </button>
      </header>

      {/* Main Calendar Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <CalendarGrid 
          currentDate={currentDate} 
          items={allVisibleItems} 
          filters={filters}
          onDayClick={handleDayClick}
        />
        
        {/* Floating Action Button */}
        <div className="absolute bottom-24 right-6 z-30">
          <button 
            onClick={() => {
              setSelectedDate(selectedDate || new Date());
              setEditingItem(null); 
              setIsAddModalOpen(true);
            }}
            aria-label="Adicionar novo compromisso ou lançamento"
            className="w-14 h-14 bg-blue-600 rounded-full shadow-xl flex items-center justify-center text-white hover:bg-blue-700 hover:scale-105 transition-all active:scale-95"
          >
            <Plus size={32} />
          </button>
        </div>
      </main>

      {/* Menus e Modais */}
      <SideMenu 
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        items={allVisibleItems}
        currentDate={currentDate}
        onTogglePaid={(id) => {
          const item = allVisibleItems.find(i => i.id === id);
          if (item) handleTogglePaid(item);
        }}
        onEditItem={handleEditClick}
        showValues={showValues}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        userProfile={userProfile}
        setUserProfile={handleUpdateProfile}
        onLogout={handleLogout}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={handleRequestNotificationPermission}
      />

      <FilterMenu 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        filters={filters}
        setFilters={setFilters}
      />

      {/* Day Details Drawer */}
      {isDayDetailsOpen && selectedDate && (
        <div 
          role="dialog"
          aria-modal="true"
          className="absolute inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none"
        >
          <div 
            className="absolute inset-0 bg-black/20 pointer-events-auto" 
            onClick={() => setIsDayDetailsOpen(false)} 
          />
          
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 h-[60vh] sm:h-[70vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-bottom duration-300">
            <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-t-3xl transition-colors">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white capitalize">
                  {selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm capitalize">
                  {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                </p>
              </div>
              <button 
                onClick={() => setIsDayDetailsOpen(false)} 
                aria-label="Fechar detalhes do dia"
                className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm text-gray-400 dark:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedDayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-4">
                  <Calendar size={48} className="opacity-20" />
                  <p>Nenhum item para este dia</p>
                  <button 
                    onClick={handleAddNewFromDrawer}
                    className="text-blue-600 dark:text-blue-400 font-medium p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    + Adicionar Novo
                  </button>
                </div>
              ) : (
                selectedDayItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => handleEditClick(item)}
                    className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-xl shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'appointment' ? (
                        <div className="w-1 h-10 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                      ) : (
                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center bg-opacity-10", 
                          item.type === 'income' ? "bg-emerald-500 text-emerald-600 dark:text-emerald-400" : "bg-red-500 text-red-600 dark:text-red-400")}
                        >
                          {item.type === 'income' ? <Plus size={18} /> : <div className="w-3 h-0.5 bg-current" />}
                        </div>
                      )}
                      
                      <div>
                        <h4 className={clsx("font-semibold text-gray-800 dark:text-gray-100", item.isPaid && "line-through text-gray-400 dark:text-gray-500")}>
                          {item.title}
                        </h4>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                          {item.type === 'appointment' ? (
                            <span className="flex items-center gap-1">
                              {item.startTime} - {item.endTime}
                            </span>
                          ) : (
                            <span className={clsx("font-medium", item.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                              {formatCurrency(item.amountCents || 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                      {(item.type === 'income' || item.type === 'expense') && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleTogglePaid(item); }}
                          aria-label={item.isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                          className="text-gray-400 hover:text-emerald-600 p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        >
                          {item.isPaid ? <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} />}
                        </button>
                      )}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                        aria-label="Editar item"
                        className="p-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                      >
                        <Edit2 size={20} />
                      </button>

                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item); }}
                        aria-label="Excluir item"
                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <button 
                onClick={handleAddNewFromDrawer}
                className="w-full py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-600"
              >
                Adicionar Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      <EventModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        selectedDate={selectedDate || new Date()}
        editingItem={editingItem}
        existingItems={items}
        accountTimezone={accountTimezone}
      />

      <DeleteModal 
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isRecurring={Boolean(itemToDelete?.seriesId || itemToDelete?.recurrenceId)}
      />

      {/* Modal de Importação Explícita de Dados Locais */}
      {unimportedLocalData && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            if (currentUserId) {
              localStorage.setItem(`fincal_import_dismissed_${currentUserId}`, 'true');
            }
          }}
          localItems={unimportedLocalData.items}
          localSeries={unimportedLocalData.series}
          onConfirmImport={handleConfirmImport}
        />
      )}

      {/* Resumo do Mês */}
      <BalanceSummary 
        summary={monthlySummary}
        monthLabel={formatMonthYear(currentDate)}
        showValues={showValues}
        onTogglePrivacy={() => setShowValues(!showValues)}
      />
    </div>
  );
}