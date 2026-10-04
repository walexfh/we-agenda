import { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  // Despesas
  { id: 'cat-alimentacao', name: 'Alimentação', color: '#f97316', icon: 'utensils', type: 'expense' },
  { id: 'cat-moradia', name: 'Moradia', color: '#3b82f6', icon: 'home', type: 'expense' },
  { id: 'cat-transporte', name: 'Transporte', color: '#6366f1', icon: 'car', type: 'expense' },
  { id: 'cat-saude', name: 'Saúde', color: '#ef4444', icon: 'heart', type: 'expense' },
  { id: 'cat-educacao', name: 'Educação', color: '#8b5cf6', icon: 'book', type: 'expense' },
  { id: 'cat-lazer', name: 'Lazer', color: '#ec4899', icon: 'smile', type: 'expense' },
  { id: 'cat-servicos', name: 'Contas & Serviços', color: '#eab308', icon: 'receipt', type: 'expense' },
  { id: 'cat-outras-despesas', name: 'Outras Despesas', color: '#6b7280', icon: 'tag', type: 'expense' },
  
  // Receitas
  { id: 'cat-salario', name: 'Salário', color: '#10b981', icon: 'briefcase', type: 'income' },
  { id: 'cat-freelance', name: 'Freelance & Serviços', color: '#06b6d4', icon: 'laptop', type: 'income' },
  { id: 'cat-investimentos', name: 'Investimentos', color: '#14b8a6', icon: 'trending-up', type: 'income' },
  { id: 'cat-vendas', name: 'Vendas & Comércio', color: '#84cc16', icon: 'shopping-bag', type: 'income' },
  { id: 'cat-outras-receitas', name: 'Outras Receitas', color: '#64748b', icon: 'plus-circle', type: 'income' },
];

/**
  * Retorna todas as categorias disponíveis (padrão + customizadas pelo usuário).
  */
export function getAllCategories(customCategories?: Category[]): Category[] {
  if (!customCategories || customCategories.length === 0) {
    return DEFAULT_CATEGORIES;
  }

  const customIds = new Set(customCategories.map(c => c.id));
  const filteredDefaults = DEFAULT_CATEGORIES.filter(c => !customIds.has(c.id));
  return [...filteredDefaults, ...customCategories];
}

/**
 * Busca categoria por ID ou por Nome aproximado.
 */
export function getCategoryById(idOrName?: string, customCategories?: Category[]): Category | undefined {
  if (!idOrName) return undefined;
  const all = getAllCategories(customCategories);
  const normalized = idOrName.trim().toLowerCase();
  
  return all.find(c => c.id.toLowerCase() === normalized || c.name.toLowerCase() === normalized);
}

/**
 * Valida a criação de uma nova categoria.
 */
export function validateNewCategory(
  category: Partial<Category>,
  existingCategories: Category[]
): { valid: boolean; error?: string } {
  const name = category.name?.trim();
  if (!name) {
    return { valid: false, error: 'O nome da categoria é obrigatório.' };
  }
  if (name.length < 2) {
    return { valid: false, error: 'O nome da categoria deve ter pelo menos 2 caracteres.' };
  }

  const normalized = name.toLowerCase();
  const exists = existingCategories.some(c => c.name.toLowerCase() === normalized && c.id !== category.id);
  if (exists) {
    return { valid: false, error: 'Já existe uma categoria com este nome.' };
  }

  if (!category.color || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(category.color)) {
    return { valid: false, error: 'Cor inválida (deve ser um código hexadecimal, ex: #3b82f6).' };
  }

  return { valid: true };
}
