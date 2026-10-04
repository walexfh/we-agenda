import { describe, it, expect, beforeEach } from 'vitest';
import { 
  loadUserData, 
  saveUserData, 
  CURRENT_SCHEMA_VERSION 
} from '../utils/storageManager';

class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

// Configura o mock global do localStorage para ambiente Node
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.clear) {
  globalThis.localStorage = new LocalStorageMock();
}

describe('storageManager - Persistência, Migração e Resiliência', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserva o conteúdo original e gera backup de emergência ao encontrar armazenamento corrompido', () => {
    const userId = 'user_corrupt_test';
    const corruptedJSON = '{"id": 123, "title": "Incompleto...'; // JSON inválido
    localStorage.setItem(`fincal_items_${userId}`, corruptedJSON);

    const result = loadUserData(userId);

    // Deve retornar status 'corrupted', sem substituir por lista vazia
    expect(result.status).toBe('corrupted');
    if (result.status === 'corrupted') {
      expect(result.rawContent).toBe(corruptedJSON);
      expect(result.backupKey).toContain(`fincal_corrupted_${userId}`);
      // Verifica que o backup foi realmente gravado no localStorage
      expect(localStorage.getItem(result.backupKey)).toBe(corruptedJSON);
    }

    // Garante que a chave original NÃO foi limpa ou sobrescrita silenciosamente por []
    expect(localStorage.getItem(`fincal_items_${userId}`)).toBe(corruptedJSON);
  });

  it('executa a migração monetária de V1 para V2 exatamente uma única vez e gera backup prévio', () => {
    const userId = 'user_migration_test';
    
    // Dados no formato V1: amount float, data ISO, sem versionamento explícito
    const v1Data = [
      {
        id: '1690000000000',
        date: '2026-10-04T03:00:00.000Z',
        type: 'expense',
        title: 'Mercado Mensal',
        amount: 33.5, // 33 reais e 50 centavos em float
        isPaid: false,
      },
      {
        id: '1690000000001',
        date: '2026-10-05T00:00:00.000Z',
        type: 'income',
        title: 'Freelance',
        amount: 1234.56,
        isPaid: true,
      }
    ];

    localStorage.setItem(`fincal_items_${userId}`, JSON.stringify(v1Data));
    localStorage.removeItem(`fincal_storage_version_${userId}`);

    // Primeira carga: deve migrar
    const result1 = loadUserData(userId);
    expect(result1.status).toBe('success');
    if (result1.status === 'success') {
      expect(result1.items.length).toBe(2);
      expect(result1.items[0].amountCents).toBe(3350);
      expect(result1.items[1].amountCents).toBe(123456);
      expect(result1.items[0].dateStr).toBe('2026-10-04');
    }

    // Verifica que a versão foi atualizada para 2
    expect(localStorage.getItem(`fincal_storage_version_${userId}`)).toBe(CURRENT_SCHEMA_VERSION.toString());

    // Verifica que foi gerado backup recuperável antes da migração
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`fincal_backup_v1_${userId}`)) {
        backupKeys.push(k);
      }
    }
    expect(backupKeys.length).toBe(1);
    expect(JSON.parse(localStorage.getItem(backupKeys[0])!)).toEqual(v1Data);

    // Segunda carga: não deve re-migrar nem alterar os centavos
    const result2 = loadUserData(userId);
    expect(result2.status).toBe('success');
    if (result2.status === 'success') {
      expect(result2.items[0].amountCents).toBe(3350);
      expect(result2.items[1].amountCents).toBe(123456);
    }

    // Não deve criar novos backups na segunda leitura
    const backupKeysAfter = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`fincal_backup_v1_${userId}`)) {
        backupKeysAfter.push(k);
      }
    }
    expect(backupKeysAfter.length).toBe(1);
  });
});
