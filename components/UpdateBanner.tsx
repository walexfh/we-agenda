import React, { useEffect, useState } from 'react';
import { 
  startAutoUpdateMonitor, 
  applyUpdate, 
  UpdateCheckResult, 
  checkForLatestApkRelease, 
  ApkReleaseInfo,
  getCurrentCommit 
} from '../services/updateService';
import { RefreshCw, Sparkles, Download, X } from 'lucide-react';

export const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [apkInfo, setApkInfo] = useState<ApkReleaseInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Monitora atualizações web a cada 2 minutos ou ao focar no app
    const cleanup = startAutoUpdateMonitor((result) => {
      setUpdateInfo(result);
      setCountdown(5); // Inicia contagem regressiva de 5 segundos para auto-atualizar
    }, 120000);

    // Consulta se há APK novo no GitHub Releases
    checkForLatestApkRelease().then((res) => {
      if (res.hasApkUpdate) {
        setApkInfo(res);
      }
    });

    return () => cleanup();
  }, []);

  // Efeito de contagem regressiva para auto-reload transparente
  useEffect(() => {
    if (countdown === null || isDismissed) return;

    if (countdown <= 0) {
      handleApplyNow();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isDismissed]);

  const handleApplyNow = () => {
    setIsUpdating(true);
    setTimeout(() => {
      applyUpdate();
    }, 300);
  };

  if (isDismissed) return null;

  // Banner para nova versão Web / Live Update de commit
  if (updateInfo?.hasUpdate) {
    return (
      <div 
        role="alert"
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300"
      >
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-3.5 px-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-white/20 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={17} className="animate-spin text-amber-300" style={{ animationDuration: '3s' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate">
                Nova atualização detectada!
              </p>
              <p className="text-[11px] text-white/80 leading-tight">
                {countdown !== null && countdown > 0 
                  ? `Atualizando em ${countdown}s...` 
                  : `Commit recente: ${updateInfo.newCommit?.slice(0, 7)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApplyNow}
              disabled={isUpdating}
              className="py-1.5 px-3 bg-white text-blue-700 hover:bg-white/90 text-xs font-bold rounded-xl shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
              {isUpdating ? 'Atualizando...' : 'Atualizar Já'}
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              aria-label="Dispensar aviso"
              className="p-1 rounded-lg hover:bg-white/20 text-white/80 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner se houver um novo APK compilado no GitHub Releases
  if (apkInfo?.hasApkUpdate && apkInfo.apkUrl) {
    return (
      <div 
        role="alert"
        aria-live="polite"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] w-[90%] max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-300"
      >
        <div className="bg-gray-900/95 text-white p-3 px-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 border border-emerald-500/40 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Download size={15} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-bold text-emerald-400 leading-tight">
                Novo APK Android disponível
              </p>
              <p className="text-[10px] text-gray-400 leading-tight truncate">
                Versão: {apkInfo.tagName || 'Recente'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={apkInfo.apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              Baixar
            </a>
            <button
              type="button"
              onClick={() => setApkInfo(null)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
