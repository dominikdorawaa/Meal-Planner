import { useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'prompt' | 'ios' | 'installed' | 'unavailable';

interface InstallState {
  installed: boolean;
  promptEvent: BeforeInstallPromptEvent | null;
}

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

const initialState: InstallState = { installed: false, promptEvent: null };
let state: InstallState = initialState;
const subscribers = new Set<() => void>();
let stopListening: (() => void) | null = null;

function setState(next: Partial<InstallState>) {
  state = { ...state, ...next };
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

function getSnapshot() {
  return state;
}

export function listenForInstallPrompt(): () => void {
  if (stopListening) return stopListening;

  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    setState({ promptEvent: event as BeforeInstallPromptEvent });
  };
  const handleAppInstalled = () => {
    setState({ promptEvent: null, installed: true });
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  stopListening = () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    stopListening = null;
    state = initialState;
  };
  return stopListening;
}

export function useInstallPrompt() {
  const { installed, promptEvent } = useSyncExternalStore(subscribe, getSnapshot);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    setState({ promptEvent: null });
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setState({ installed: true });
  }, [promptEvent]);

  let mode: InstallMode = 'unavailable';
  if (installed || isRunningInstalled()) mode = 'installed';
  else if (promptEvent) mode = 'prompt';
  else if (isIos()) mode = 'ios';

  return { mode, install };
}
