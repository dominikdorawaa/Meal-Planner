import { t } from '../i18n';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { SettingsRow } from './settings/SettingsUi';

export function InstallAppCard() {
  const { mode, install } = useInstallPrompt();

  if (mode === 'prompt') {
    return <SettingsRow icon="install_mobile" label={t('install.title')} onClick={install} />;
  }

  if (mode === 'ios') {
    return (
      <div className="min-h-[52px] py-3 flex items-center gap-3.5">
        <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">ios_share</span>
        <span className="flex-1 min-w-0">
          <span className="block text-base font-medium text-on-surface">{t('install.title')}</span>
          <span className="block mt-0.5 text-[13px] text-on-surface-variant">{t('install.iosHint')}</span>
        </span>
      </div>
    );
  }

  return null;
}
