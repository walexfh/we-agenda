import React, { useState, useEffect } from 'react';
import { Trash2, Layers, FileMinus, X } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: 'single' | 'sequence') => void;
  isRecurring: boolean;
  isInstallment?: boolean;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isRecurring,
  isInstallment = false,
}) => {
  const [scope, setScope] = useState<'single' | 'sequence'>('single');

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

  const hasMultipleScope = isRecurring || isInstallment;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-4">
            <Trash2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Excluir Item</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {isInstallment
              ? "Este item é uma parcela de uma compra. Como você deseja excluí-lo?"
              : isRecurring 
              ? "Este é um item recorrente. Como você deseja excluí-lo?" 
              : "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."}
          </p>
        </div>

        {hasMultipleScope && (
          <div className="space-y-3 mb-6">
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${scope === 'single' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-900/50'}`}>
              <input 
                type="radio" 
                name="deleteScope" 
                checked={scope === 'single'} 
                onChange={() => setScope('single')}
                className="w-5 h-5 text-red-600 focus:ring-red-500"
              />
              <div className="text-left">
                <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <FileMinus size={18} />
                  <span>{isInstallment ? 'Apenas esta parcela' : 'Apenas este'}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isInstallment ? 'Exclui somente este lançamento parcelado' : 'Exclui somente o evento deste dia'}
                </div>
              </div>
            </label>

            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${scope === 'sequence' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-900/50'}`}>
              <input 
                type="radio" 
                name="deleteScope" 
                checked={scope === 'sequence'} 
                onChange={() => setScope('sequence')}
                className="w-5 h-5 text-red-600 focus:ring-red-500"
              />
              <div className="text-left">
                <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <Layers size={18} />
                  <span>{isInstallment ? 'Todas as parcelas' : 'Este e futuros'}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isInstallment ? 'Exclui todas as parcelas deste parcelamento' : 'Exclui este e todos os próximos da série'}
                </div>
              </div>
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onConfirm(hasMultipleScope ? scope : 'single')}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};