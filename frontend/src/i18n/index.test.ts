import { afterEach, describe, expect, it, vi } from 'vitest';
import en from './locales/en.json';
import pl from './locales/pl.json';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CHANGE_EVENT,
  applyLanguage,
  getLanguage,
  isSupportedLanguage,
  setLanguage,
  t,
} from '.';

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
});

describe('i18n', () => {
  it('uses Polish by default', () => {
    expect(DEFAULT_LANGUAGE).toBe('pl');
    expect(getLanguage()).toBe('pl');
  });

  it('ignores an unsupported stored language', () => {
    localStorage.setItem('mp_language', 'de');

    expect(getLanguage()).toBe('pl');
  });

  it('recognises supported languages only', () => {
    expect(isSupportedLanguage('pl')).toBe(true);
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('de')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });

  it('stores the chosen language, updates the document and notifies listeners', () => {
    const listener = vi.fn();
    window.addEventListener(LANGUAGE_CHANGE_EVENT, listener);

    setLanguage('en');

    expect(getLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ language: 'en' });
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, listener);
  });

  it('applies the current language to the document', () => {
    applyLanguage();

    expect(document.documentElement.lang).toBe('pl');
  });

  it('translates messages in the current language', () => {
    expect(t('api.sessionExpired')).toBe(pl['api.sessionExpired']);

    setLanguage('en');

    expect(t('api.sessionExpired')).toBe('Your session has expired. Please sign in again.');
  });

  it('fills placeholders and keeps unknown ones', () => {
    expect(t('api.serverError', { status: 503 }, 'en')).toBe('Server error (503)');
    expect(t('api.serverError', {}, 'en')).toBe('Server error ({status})');
  });

  it('defines the same keys for every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
  });
});
