import { describe, it, expect } from 'vitest';
import { 
  DEFAULT_CATEGORIES, 
  getAllCategories, 
  getCategoryById, 
  validateNewCategory 
} from '../utils/categoryUtils';
import { Category } from '../types';

describe('categoryUtils (Etapa 6)', () => {
  it('fornece categorias padrão para despesas e receitas', () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThan(5);
    const moradia = DEFAULT_CATEGORIES.find(c => c.id === 'cat-moradia');
    expect(moradia).toBeDefined();
    expect(moradia?.name).toBe('Moradia');
    expect(moradia?.type).toBe('expense');

    const salario = DEFAULT_CATEGORIES.find(c => c.id === 'cat-salario');
    expect(salario).toBeDefined();
    expect(salario?.name).toBe('Salário');
    expect(salario?.type).toBe('income');
  });

  it('combina categorias personalizadas do usuário com as padrão sem duplicar IDs', () => {
    const customCats: Category[] = [
      { id: 'cat-custom-1', name: 'Pet Shop', color: '#f59e0b', type: 'expense' },
      { id: 'cat-moradia', name: 'Moradia VIP', color: '#000000', type: 'expense' }, // Sobrescreve default
    ];

    const all = getAllCategories(customCats);
    expect(all.some(c => c.name === 'Pet Shop')).toBe(true);
    const moradia = all.find(c => c.id === 'cat-moradia');
    expect(moradia?.name).toBe('Moradia VIP');
  });

  it('busca categoria por ID ou por Nome de forma insensível a maiúsculas', () => {
    const cat = getCategoryById('Alimentação');
    expect(cat).toBeDefined();
    expect(cat?.id).toBe('cat-alimentacao');

    const byId = getCategoryById('cat-transporte');
    expect(byId?.name).toBe('Transporte');

    const notFound = getCategoryById('categoria-inexistente');
    expect(notFound).toBeUndefined();
  });

  it('valida regras de criação de nova categoria', () => {
    // 1. Nome vazio
    expect(validateNewCategory({ name: '', color: '#3b82f6' }, DEFAULT_CATEGORIES).valid).toBe(false);

    // 2. Nome muito curto
    expect(validateNewCategory({ name: 'A', color: '#3b82f6' }, DEFAULT_CATEGORIES).valid).toBe(false);

    // 3. Nome duplicado
    expect(validateNewCategory({ name: 'Moradia', color: '#3b82f6' }, DEFAULT_CATEGORIES).valid).toBe(false);

    // 4. Cor inválida
    expect(validateNewCategory({ name: 'Assinaturas', color: 'blue' }, DEFAULT_CATEGORIES).valid).toBe(false);

    // 5. Categoria válida
    expect(validateNewCategory({ name: 'Assinaturas', color: '#8b5cf6' }, DEFAULT_CATEGORIES).valid).toBe(true);
  });
});
