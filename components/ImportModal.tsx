import React, { useState, useEffect } from 'react';
import { CalendarItem, RecurrenceSeries } from '../types';
import { CloudUpload, X, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  localItems: CalendarItem[];
  localSeries: RecurrenceSeries[];
  onConfirmImport: () => Promise<boolean>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  localItems,
  localSeries,
  onConfirmImport,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const nonVirtualItems = localItems.filter(i => !i.isVirtualOccurrence);
  const appointmentsCount = nonVirtualItems.filter(i => i.type === 'appointment').length;
  const financesCount = nonVirtualItems.filter(i => i.type === 'income' || i.type === 'expense').length;
  const seriesCount = localSeries.length;
  const totalCount = nonVirtualItems.length + seriesCount;

  const handleImport = async () => {
    setError('');
    setIsImporting(true);
    try {
      const success = await onConfirmImport();
      if (success) {
        onClose();
      } else {
        setError('Ocorreu um erro ao importar os registros.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha na importação.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose} 
          aria-label="Fechar"
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
            <CloudUpload size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Importar Dados Locais</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            Detectamos <strong>{totalCount} registro(s)</strong> salvos neste navegador durante o modo de demonstração.
            Deseja migrá-los para a sua conta em nuvem?
          </p>
        </div>

        {/* Resumo dos registros a importar */}
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 mb-4 border border-gray-100 dark:border-gray-700/60 text-xs space-y-1.5">
          <div className="flex justify-between text-gray-700 dark:text-gray-300">
            <span>Compromissos:</span>
            <span className="font-semibold">{appointmentsCount}</span>
          </div>
          <div className="flex justify-between text-gray-700 dark:text-gray-300">
            <span>Lançamentos Financeiros:</span>
            <span className="font-semibold">{financesCount}</span>
          </div>
          {seriesCount > 0 && (
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>Séries Recorrentes:</span>
              <span className="font-semibold">{seriesCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 mb-5">
          <ShieldCheck size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Importação segura: apenas eventos e lançamentos são enviados. Senhas locais nunca são transmitidas.</span>
        </div>

        {error && (
          <div className="p-2.5 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Ignorar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting}
            className={`flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 ${
              isImporting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            {isImporting ? (
              'Importando...'
            ) : (
              <>
                <CheckCircle2 size={16} />
                Importar para a Conta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
