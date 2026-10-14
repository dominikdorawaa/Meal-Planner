import { t } from '../i18n';
import { useInstallPrompt } from '../lib/useInstallPrompt';

export function InstallAppCard() {
  const { mode, install } = useInstallPrompt();

  if (mode === 'prompt') {
    return (
      <button
        onClick={install}
        className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex items-center justify-between active:scale-95 transition-transform border border-outline-variant/10 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
            <span className="material-symbols-outlined">install_mobile</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-on-surface text-[15px]">{t('install.title')}</span>
            <span className="text-xs text-on-surface-variant mt-0.5">{t('install.description')}</span>
          </div>
        </div>
        <span className="material-symbols-outlined text-primary/50">download</span>
      </button>
    );
  }

  if (mode === 'ios') {
    return (
      <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex items-center gap-4 border border-outline-variant/10">
        <div className="w-12 h-12 shrink-0 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">ios_share</span>
        </div>
        <div className="flex flex-col text-left">
          <span className="font-bold text-on-surface text-[15px]">{t('install.title')}</span>
          <span className="text-xs text-on-surface-variant mt-0.5">{t('install.iosHint')}</span>
        </div>
      </div>
    );
  }

  return null;
}
