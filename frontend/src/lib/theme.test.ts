import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  applyTheme,
  getThemePreference,
  isThemePreference,
  listenForSystemThemeChanges,
  resolveTheme,
  setThemePreference,
} from './theme';

type ChangeListener = () => void;

function mockSystemScheme(prefersDark: boolean) {
  const listeners = new Set<ChangeListener>();
  const query = {
    matches: prefersDark,
    addEventListener: vi.fn((_type: string, listener: ChangeListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: ChangeListener) => listeners.delete(listener)),
  };
  window.matchMedia = vi.fn().mockReturnValue(query) as unknown as typeof window.matchMedia;
  return {
    query,
    change(nextPrefersDark: boolean) {
      query.matches = nextPrefersDark;
      listeners.forEach((listener) => listener());
    },
  };
}

const isDark = () => document.documentElement.classList.contains('dark');
const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
const statusBarStyle = () => document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content');

beforeEach(() => {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.appendChild(meta);
  const statusBar = document.createElement('meta');
  statusBar.name = 'apple-mobile-web-app-status-bar-style';
  document.head.appendChild(statusBar);
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.head.innerHTML = '';
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('uses the dark theme by default', () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe('dark');
    expect(getThemePreference()).toBe('dark');

    applyTheme();

    expect(isDark()).toBe(true);
    expect(themeColor()).toBe(THEME_COLORS.dark);
    expect(statusBarStyle()).toBe('black-translucent');
  });

  it('ignores an unsupported stored preference', () => {
    localStorage.setItem('mp_theme', 'sepia');

    expect(getThemePreference()).toBe('dark');
  });

  it('recognises supported preferences only', () => {
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('stores the chosen preference, updates the document and notifies listeners', () => {
    const listener = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, listener);
    applyTheme('dark');

    setThemePreference('light');

    expect(localStorage.getItem('mp_theme')).toBe('light');
    expect(isDark()).toBe(false);
    expect(themeColor()).toBe(THEME_COLORS.light);
    expect(statusBarStyle()).toBe('default');
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ preference: 'light' });
    window.removeEventListener(THEME_CHANGE_EVENT, listener);
  });

  it('follows the system scheme when the system preference is chosen', () => {
    mockSystemScheme(false);
    expect(resolveTheme('system')).toBe('light');

    mockSystemScheme(true);
    expect(resolveTheme('system')).toBe('dark');
  });

  it('falls back to light for the system preference when the browser cannot report a scheme', () => {
    expect(resolveTheme('system')).toBe('light');
  });

  it('reacts to system scheme changes only while the system preference is chosen', () => {
    const system = mockSystemScheme(false);
    setThemePreference('system');
    const stopListening = listenForSystemThemeChanges();

    system.change(true);
    expect(isDark()).toBe(true);

    setThemePreference('light');
    system.change(true);
    expect(isDark()).toBe(false);

    stopListening();
    expect(system.query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('does nothing when the browser cannot report a scheme', () => {
    const stopListening = listenForSystemThemeChanges();

    expect(() => stopListening()).not.toThrow();
  });

  it('still applies the chosen theme when it cannot be saved', () => {
    const listener = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, listener);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    applyTheme('dark');

    setThemePreference('light');

    expect(isDark()).toBe(false);
    expect(themeColor()).toBe(THEME_COLORS.light);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(THEME_CHANGE_EVENT, listener);
  });

  it('falls back to the default preference when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });

    expect(getThemePreference()).toBe('dark');
  });
});
