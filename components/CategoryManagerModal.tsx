import React, { useState } from 'react';
import { Category } from '../types';
import { DEFAULT_CATEGORIES, getAllCategories, validateNewCategory } from '../utils/categoryUtils';
import { X, Plus, Trash2, Tag, Check, Palette } from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customCategories: Category[];
  onUpdateCustomCategories: (categories: Category[]) => void;
}

const PRESET_COLORS = [
  '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6',
  '#10b981', '#84cc16', '#eab308', '#64748b'
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  customCategories,
  onUpdateCustomCategories,
}) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const allCategories = getAllCategories(customCategories);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const newCat: Partial<Category> = {
      id: `custom-cat-${Date.now()}`,
      name: name.trim(),
      color: selectedColor,
      type,
    };

    const validation = validateNewCategory(newCat, allCategories);
    if (!validation.valid) {
      setError(validation.error || 'Erro ao validar categoria.');
      return;
    }

    const updated = [...customCategories, newCat as Category];
    onUpdateCustomCategories(updated);
    setName('');
  };

  const handleDeleteCategory = (catId: string) => {
    const updated = customCategories.filter(c => c.id !== catId);
    onUpdateCustomCategories(updated);
  };

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Gerenciar Categorias</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Personalize categorias para receitas e despesas</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form para Nova Categoria */}
        <form onSubmit={handleAddCategory} className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Plus size={14} /> Nova Categoria
          </h3>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome da Categoria
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Farmácia, Pet Shop..."
                className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Lançamento
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
              >
                <option value="expense">Apenas Despesas</option>
                <option value="income">Apenas Receitas</option>
                <option value="both">Ambas (Receita e Despesa)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
              <Palette size={13} /> Escolha uma Cor
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {selectedColor === c && <Check size={14} className="text-white drop-shadow-sm" />}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} /> Salvar Nova Categoria
          </button>
        </form>

        {/* Lista de Categorias */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Customizadas */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Suas Categorias Personalizadas ({customCategories.length})
            </h4>
            {customCategories.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nenhuma categoria personalizada criada ainda.</p>
            ) : (
              <div className="space-y-2">
                {customCategories.map(cat => (
                  <div 
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {cat.type === 'expense' ? 'Despesa' : cat.type === 'income' ? 'Receita' : 'Ambas'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      title="Excluir categoria customizada"
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Padrão do Sistema */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Categorias Padrão do Sistema ({DEFAULT_CATEGORIES.length})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_CATEGORIES.map(cat => (
                <div 
                  key={cat.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-800/70 bg-gray-50/30 dark:bg-gray-800/20"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-semibold transition-colors"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
};
