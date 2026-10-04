/**
 * updateService.ts — Sistema de Atualização Automática Contínua
 * Detecta novos commits no repositório / novos deploys e atualiza o app instantaneamente.
 */

export interface VersionInfo {
  commit: string;
  builtAt: string;
  timestamp?: number;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentCommit: string;
  newCommit?: string;
  builtAt?: string;
}

export interface ApkReleaseInfo {
  hasApkUpdate: boolean;
  tagName?: string;
  apkUrl?: string;
  publishedAt?: string;
  releaseNotes?: string;
}

// Obtém o hash atual do commit injetado no build pelo Vite
export function getCurrentCommit(): string {
  try {
    if (typeof __APP_COMMIT_HASH__ !== 'undefined') {
      return __APP_COMMIT_HASH__;
    }
  } catch {
    // Fallback
  }
  return 'dev';
}

export function getCurrentBuildTime(): string {
  try {
    if (typeof __APP_BUILD_TIME__ !== 'undefined') {
      return __APP_BUILD_TIME__;
    }
  } catch {
    // Fallback
  }
  return new Date().toISOString();
}

/**
 * Verifica se uma nova versão web foi gerada por um novo commit.
 * Consulta o arquivo version.json gerado a cada build com bypass total de cache.
 */
export async function checkForWebUpdate(): Promise<UpdateCheckResult> {
  const currentCommit = getCurrentCommit();

  // Em ambiente puramente de desenvolvimento local (sem hash), não força reload
  if (currentCommit === 'dev') {
    return { hasUpdate: false, currentCommit };
  }

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) {
      return { hasUpdate: false, currentCommit };
    }

    const remote: VersionInfo = await res.json();
    if (remote?.commit && remote.commit !== currentCommit) {
      return {
        hasUpdate: true,
        currentCommit,
        newCommit: remote.commit,
        builtAt: remote.builtAt
      };
    }

    return { hasUpdate: false, currentCommit };
  } catch {
    return { hasUpdate: false, currentCommit };
  }
}

/**
 * Consulta a API do GitHub para verificar se há novo release do APK Android compilado via CI/CD.
 */
export async function checkForLatestApkRelease(): Promise<ApkReleaseInfo> {
  try {
    const res = await fetch('https://api.github.com/repos/walexfh/we-agenda/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!res.ok) {
      return { hasApkUpdate: false };
    }

    const release = await res.json();
    const apkAsset = (release.assets || []).find((a: any) => 
      a.name.endsWith('.apk') || a.name === 'we-agenda.apk'
    );

    if (apkAsset?.browser_download_url) {
      return {
        hasApkUpdate: true,
        tagName: release.tag_name,
        apkUrl: apkAsset.browser_download_url,
        publishedAt: release.published_at,
        releaseNotes: release.body || ''
      };
    }

    return { hasApkUpdate: false };
  } catch {
    return { hasApkUpdate: false };
  }
}

/**
 * Aplica a atualização imediatamente: limpa os caches do Service Worker e recarrega.
 */
export async function applyUpdate(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map(k => window.caches.delete(k)));
    }
  } catch {
    // Continua mesmo se o cache API falhar
  }

  // Força recarregamento limpo a partir do servidor
  window.location.reload();
}

/**
 * Registra um monitor automático que verifica atualizações a cada intervalo
 * e ao focar novamente na janela ou aplicativo.
 */
export function startAutoUpdateMonitor(
  onUpdateDetected: (result: UpdateCheckResult) => void,
  intervalMs = 120000 // 2 minutos
): () => void {
  let isCancelled = false;

  const check = async () => {
    if (isCancelled) return;
    const result = await checkForWebUpdate();
    if (result.hasUpdate && !isCancelled) {
      onUpdateDetected(result);
    }
  };

  // Primeira checagem 3 segundos após carregar
  const initialTimer = setTimeout(check, 3000);

  // Intervalo periódico
  const intervalId = setInterval(check, intervalMs);

  // Checa sempre que o usuário voltar para o app/aba
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      check();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', check);
  }

  return () => {
    isCancelled = true;
    clearTimeout(initialTimer);
    clearInterval(intervalId);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', check);
    }
  };
}
