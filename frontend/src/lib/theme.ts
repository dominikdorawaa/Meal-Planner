export const THEME_PREFERENCES = ['dark', 'light', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Theme = Exclude<ThemePreference, 'system'>;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';
export const THEME_CHANGE_EVENT = 'theme-change';
export const THEME_COLORS: Record<Theme, string> = { light: '#f8faf7', dark: '#0a0a0a' };
export const STATUS_BAR_STYLES: Record<Theme, string> = { light: 'default', dark: 'black-translucent' };

const THEME_KEY = 'mp_theme';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function resolveTheme(preference: ThemePreference = getThemePreference()): Theme {
  if (preference !== 'system') return preference;
  return window.matchMedia?.(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference = getThemePreference()) {
  const theme = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', STATUS_BAR_STYLES[theme]);
}

function storeThemePreference(preference: ThemePreference): boolean {
  try {
    localStorage.setItem(THEME_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function setThemePreference(preference: ThemePreference) {
  storeThemePreference(preference);
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { preference } }));
}

export function listenForSystemThemeChanges() {
  const query = window.matchMedia?.(DARK_SCHEME_QUERY);
  if (!query) return () => {};
  const onChange = () => {
    if (getThemePreference() === 'system') applyTheme('system');
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
