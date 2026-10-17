import pl from './locales/pl.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['pl', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type MessageKey = keyof typeof pl;

export const DEFAULT_LANGUAGE: Language = 'pl';
export const LANGUAGE_CHANGE_EVENT = 'language-change';

const LANGUAGE_KEY = 'mp_language';

const dictionaries: Record<Language, Record<MessageKey, string>> = { pl, en };

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

export function applyLanguage(language: Language = getLanguage()) {
  document.documentElement.lang = language;
}

export function setLanguage(language: Language) {
  localStorage.setItem(LANGUAGE_KEY, language);
  applyLanguage(language);
  window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { language } }));
}

export function t(
  key: MessageKey,
  params: Record<string, string | number> = {},
  language: Language = getLanguage()
): string {
  return dictionaries[language][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder
  );
}

export type PluralForm = 'one' | 'few' | 'many';

export function pluralForm(count: number, language: Language = getLanguage()): PluralForm {
  const category = new Intl.PluralRules(language).select(count);
  return category === 'one' || category === 'few' ? category : 'many';
}
