import React, { useState, useMemo, useEffect } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { CalendarItem, FilterState, RecurrenceType, UserProfile } from './types';
import { generateRecurringItems, formatMonthYear, formatCurrency } from './utils/dateUtils';
import { CalendarGrid } from './components/CalendarGrid';
import { FilterMenu } from './components/FilterMenu';
import { SideMenu } from './components/SideMenu';
import { EventModal } from './components/EventModal';
import { DeleteModal } from './components/DeleteModal';
import { BalanceSummary } from './components/BalanceSummary';
import { LoginScreen } from './components/LoginScreen';
import { Calendar, Filter, Plus, ChevronLeft, ChevronRight, Menu, Trash2, CheckSquare, Square, X, Edit2 } from 'lucide-react';
import clsx from 'clsx';

// Initial Data - Empty
const INITIAL_ITEMS: CalendarItem[] = [];

// Helper to revive dates from JSON
const dateReviver = (key: string, value: any) => {
  if (key === 'date' && typeof value === 'string') {
    return new Date(value);
  }
  return value;
};

export default function App() {
  // --- Authentication / User State ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem('fincal_current_user');
  });

  // --- Data State ---
  const [items, setItems] = useState<CalendarItem[]>(() => {
    if (!currentUserId) return INITIAL_ITEMS;
    try {
      const saved = localStorage.getItem(`fincal_items_${currentUserId}`);
      return saved ? JSON.parse(saved, dateReviver) : INITIAL_ITEMS;
    } catch (e) {
      return INITIAL_ITEMS;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (!currentUserId) return { name: '' };
    try {
      const saved = localStorage.getItem(`fincal_profile_${currentUserId}`);
      return saved ? JSON.parse(saved) : { name: '' };
    } catch (e) {
      return { name: '' };
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
     return localStorage.getItem('fincal_theme') === 'dark';
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // UI State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false); // Mobile drawer
  const [showValues, setShowValues] = useState(true); // Privacy toggle
  
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

  // --- Effects for Persistence ---
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`fincal_items_${currentUserId}`, JSON.stringify(items));
    }
  }, [items, currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`fincal_profile_${currentUserId}`, JSON.stringify(userProfile));
    }
  }, [userProfile, currentUserId]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('fincal_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fincal_theme', 'light');
    }
  }, [isDarkMode]);

  // Derived State: Monthly Balance
  const monthlyBalance = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const monthlyItems = items.filter(item => 
      item.date >= monthStart && item.date <= monthEnd
    );

    const income = monthlyItems
      .filter(i => i.type === 'income')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
      
    const expense = monthlyItems
      .filter(i => i.type === 'expense')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return { income, expense };
  }, [currentDate, items]);

  // Derived State: Selected Day Items
  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    
    return items.filter(item => isSameDay(item.date, selectedDate)).filter(item => {
      if (item.type === 'appointment' && !filters.showAppointments) return false;
      if ((item.type === 'income' || item.type === 'expense') && !filters.showFinances) return false;
      if (item.type === 'income' && !filters.showIncome) return false;
      if (item.type === 'expense' && !filters.showExpenses) return false;
      
      if (filters.showPaidOnly && (item.type === 'income' || item.type === 'expense') && !item.isPaid) return false;
      if (filters.showUnpaidOnly && (item.type === 'income' || item.type === 'expense') && item.isPaid) return false;

      return true;
    });
  }, [selectedDate, items, filters]);

  // Handlers
  const handleLogin = (username: string, name: string) => {
    const userId = username;
    setCurrentUserId(userId);
    localStorage.setItem('fincal_current_user', userId);

    const savedItems = localStorage.getItem(`fincal_items_${userId}`);
    const savedProfile = localStorage.getItem(`fincal_profile_${userId}`);

    setItems(savedItems ? JSON.parse(savedItems, dateReviver) : INITIAL_ITEMS);
    
    if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
    } else {
        const newProfile = { name, avatar: '' };
        setUserProfile(newProfile);
        localStorage.setItem(`fincal_profile_${userId}`, JSON.stringify(newProfile));
    }
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    localStorage.removeItem('fincal_current_user');
    setItems([]);
    setUserProfile({ name: '' });
    setIsSideMenuOpen(false);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDayDetailsOpen(true);
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // --- Add/Edit Handlers ---
  
  const handleAddNewFromDrawer = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent bubbling issues
      setEditingItem(null);
      // Explicitly close drawer and open modal. No timeout needed if z-index is correct.
      setIsDayDetailsOpen(false);
      setIsAddModalOpen(true);
  };

  const handleEditClick = (item: CalendarItem) => {
    setEditingItem(item);
    setSelectedDate(item.date); 
    setIsDayDetailsOpen(false); 
    setIsAddModalOpen(true);
  };

  const handleSaveItem = (baseItem: Omit<CalendarItem, 'id'>, recurrence: RecurrenceType, editScope: 'single' | 'sequence' = 'single') => {
    if (editingItem) {
      if (editingItem.recurrenceId && editScope === 'sequence') {
        // UPDATE SERIES
        const timeDiff = baseItem.date.getTime() - editingItem.date.getTime();

        setItems(prev => prev.map(item => {
           const isSameSeries = item.recurrenceId === editingItem.recurrenceId;
           // Apply to this item and all FUTURE items in the series (based on original date)
           const isFutureOrCurrent = item.date.getTime() >= editingItem.date.getTime();

           if (isSameSeries && isFutureOrCurrent) {
               const newDate = timeDiff !== 0 ? new Date(item.date.getTime() + timeDiff) : item.date;
               return {
                   ...item,
                   ...baseItem,
                   date: newDate,
                   id: item.id,
                   recurrenceId: item.recurrenceId,
                   isPaid: item.id === editingItem.id ? baseItem.isPaid : item.isPaid
               };
           }
           return item;
        }));

      } else {
        // UPDATE SINGLE
        setItems(prev => prev.map(item => 
          item.id === editingItem.id 
            ? { ...baseItem, id: editingItem.id, recurrenceId: item.recurrenceId } 
            : item
        ));
      }
      setEditingItem(null);
    } else {
      // CREATE NEW
      const idBase = Date.now().toString();
      const newItems = generateRecurringItems({ ...baseItem, id: idBase }, recurrence);
      setItems(prev => [...prev, ...newItems]);
    }
  };

  // --- Delete Handlers ---

  const handleDeleteRequest = (item: CalendarItem) => {
     setItemToDelete(item);
     setDeleteModalOpen(true);
  };

  const handleConfirmDelete = (scope: 'single' | 'sequence') => {
      if (!itemToDelete) return;

      if (scope === 'sequence' && itemToDelete.recurrenceId) {
          // Delete this and future items in series
          setItems(prev => prev.filter(item => {
              if (item.recurrenceId === itemToDelete.recurrenceId) {
                  // Keep items strictly BEFORE the deleted one
                  return item.date.getTime() < itemToDelete.date.getTime();
              }
              return true;
          }));
      } else {
          // Delete Single
          setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      }
      
      setDeleteModalOpen(false);
      setItemToDelete(null);
      
      // If we deleted from edit mode, close edit modal too
      if (editingItem?.id === itemToDelete.id) {
          setEditingItem(null);
          setIsAddModalOpen(false);
      }
  };

  const handleTogglePaid = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isPaid: !item.isPaid } : item
    ));
  };

  if (!currentUserId) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col relative overflow-hidden transition-colors duration-300">
      
      {/* Top Bar */}
      <header className="px-4 py-4 bg-white dark:bg-gray-800 shadow-sm z-10 flex justify-between items-center transition-colors">
        <button 
          onClick={() => setIsSideMenuOpen(true)}
          className="p-2 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <Menu size={24} />
        </button>

        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white capitalize w-36 text-center">
            {formatMonthYear(currentDate)}
          </h1>
          <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
            <ChevronRight size={24} />
          </button>
        </div>

        <button 
          onClick={() => setIsFilterOpen(true)}
          className="p-2 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors relative"
        >
           <Filter size={24} />
           {(!filters.showAppointments || !filters.showFinances) && (
             <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-800" />
          )}
        </button>
      </header>

      {/* Main Calendar Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <CalendarGrid 
          currentDate={currentDate} 
          items={items} 
          filters={filters}
          onDayClick={handleDayClick}
        />
        
        {/* FAB */}
        <div className="absolute bottom-24 right-6 z-30">
          <button 
            onClick={() => {
                setSelectedDate(selectedDate || new Date());
                setEditingItem(null); 
                setIsAddModalOpen(true);
            }}
            className="w-14 h-14 bg-blue-600 rounded-full shadow-xl flex items-center justify-center text-white hover:bg-blue-700 hover:scale-105 transition-all active:scale-95"
          >
            <Plus size={32} />
          </button>
        </div>
      </main>

      {/* Menus and Modals */}
      <SideMenu 
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        items={items}
        currentDate={currentDate}
        onTogglePaid={handleTogglePaid}
        onEditItem={handleEditClick}
        showValues={showValues}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        onLogout={handleLogout}
      />

      <FilterMenu 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        filters={filters}
        setFilters={setFilters}
      />

      {/* Day Details Drawer */}
      {isDayDetailsOpen && selectedDate && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
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
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
               </div>
               <button onClick={() => setIsDayDetailsOpen(false)} className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm text-gray-400 dark:text-gray-300">
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
                          <h4 className={clsx("font-semibold text-gray-800 dark:text-gray-100", item.isPaid && "line-through text-gray-400 dark:text-gray-500")}>{item.title}</h4>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                            {item.type === 'appointment' ? (
                              <span className="flex items-center gap-1">
                                {item.startTime} - {item.endTime}
                              </span>
                            ) : (
                              <span className={clsx("font-medium", item.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                                {formatCurrency(item.amount || 0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 relative z-10">
                        {(item.type === 'income' || item.type === 'expense') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleTogglePaid(item.id); }}
                            className="text-gray-400 hover:text-emerald-600 p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          >
                             {item.isPaid ? <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} />}
                          </button>
                        )}
                        
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                           className="p-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                        >
                           <Edit2 size={20} />
                        </button>

                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item); }}
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

      {/* Modals */}
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
      />

      <DeleteModal 
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isRecurring={!!itemToDelete?.recurrenceId}
      />

      <BalanceSummary 
        income={monthlyBalance.income} 
        expense={monthlyBalance.expense} 
        showValues={showValues}
        onTogglePrivacy={() => setShowValues(!showValues)}
      />
    </div>
  );
}