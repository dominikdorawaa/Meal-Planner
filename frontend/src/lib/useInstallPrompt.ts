import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'prompt' | 'ios' | 'installed' | 'unavailable';

function isRunningInstalled(): boolean {
  const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneDisplay || iosStandalone;
}

function isIos(): boolean {
  const userAgent = window.navigator.userAgent;
  const iPadWithDesktopUserAgent = /Macintosh/.test(userAgent) && window.navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(userAgent) || iPadWithDesktopUserAgent;
}

export function useInstallPrompt() {
  const [installed, setInstalled] = useState(isRunningInstalled);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    setPromptEvent(null);
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
  }, [promptEvent]);

  let mode: InstallMode = 'unavailable';
  if (installed) mode = 'installed';
  else if (promptEvent) mode = 'prompt';
  else if (isIos()) mode = 'ios';

  return { mode, install };
}
