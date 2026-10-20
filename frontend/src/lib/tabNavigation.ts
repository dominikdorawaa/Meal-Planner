import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MessageKey } from '../i18n';
import { runTabTransition, type SlideDirection } from './tabTransition';

export const HOME_TAB = '/';

export const TABS: { path: string; icon: string; label: MessageKey }[] = [
  { path: HOME_TAB, icon: 'calendar_month', label: 'nav.plan' },
  { path: '/recipes', icon: 'restaurant_menu', label: 'nav.recipes' },
  { path: '/cart', icon: 'list_alt', label: 'nav.shopping' },
  { path: '/profile', icon: 'more_horiz', label: 'nav.more' },
];

const FROM_HOME_KEY = 'fromHomeTab';

export function tabIndex(path: string): number {
  return TABS.findIndex(tab => tab.path === path);
}

export function isTabPath(path: string): boolean {
  return tabIndex(path) !== -1;
}

export function neighborTab(path: string, step: 1 | -1): string | null {
  const index = tabIndex(path);
  if (index === -1) return null;
  return TABS[index + step]?.path ?? null;
}

function cameFromHome(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[FROM_HOME_KEY] === true;
}

export function useTabNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname;
  const state: unknown = location.state;

  return useCallback((target: string) => {
    if (target === current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const direction: SlideDirection = tabIndex(target) > tabIndex(current) ? 'forward' : 'backward';
    runTabTransition(direction, () => {
      if (current === HOME_TAB) {
        navigate(target, { state: { [FROM_HOME_KEY]: true } });
      } else if (target !== HOME_TAB) {
        navigate(target, { replace: true, state });
      } else {
        navigate(-1);
      }
    });
  }, [current, navigate, state]);
}

export function useHomeBelowTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, search, hash } = location;
  const needsHome = pathname !== HOME_TAB && isTabPath(pathname) && !cameFromHome(location.state);

  useEffect(() => {
    if (!needsHome) return;
    navigate(HOME_TAB, { replace: true });
    navigate({ pathname, search, hash }, { state: { [FROM_HOME_KEY]: true } });
  }, [needsHome, navigate, pathname, search, hash]);
}
