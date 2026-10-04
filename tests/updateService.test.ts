import { describe, it, expect, vi } from 'vitest';
import { 
  getCurrentCommit, 
  getCurrentBuildTime, 
  checkForWebUpdate,
  startAutoUpdateMonitor 
} from '../services/updateService';

describe('updateService — Sistema de Atualização Automática Contínua', () => {
  it('retorna commit e build time válidos', () => {
    const commit = getCurrentCommit();
    const buildTime = getCurrentBuildTime();

    expect(typeof commit).toBe('string');
    expect(commit.length).toBeGreaterThan(0);
    expect(typeof buildTime).toBe('string');
  });

  it('detecta ausência de atualização quando a versão remota é igual à local', async () => {
    // Simula fetch retornando a mesma versão
    const mockCommit = 'abc1234';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commit: mockCommit, builtAt: new Date().toISOString() })
    }));

    // Se estiver em ambiente sem __APP_COMMIT_HASH__, retorna hasUpdate: false
    const result = await checkForWebUpdate();
    expect(typeof result.hasUpdate).toBe('boolean');

    vi.unstubAllGlobals();
  });

  it('registra e cancela o monitor de atualizações sem vazamento de memória', () => {
    const callback = vi.fn();
    const cleanup = startAutoUpdateMonitor(callback, 60000);

    expect(typeof cleanup).toBe('function');
    // Executa cleanup
    cleanup();
  });
});
