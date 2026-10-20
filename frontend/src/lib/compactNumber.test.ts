import { afterEach, describe, expect, it } from 'vitest';
import { formatCompactNumber } from './compactNumber';

afterEach(() => localStorage.clear());

describe('formatCompactNumber', () => {
  it('keeps values below ten thousand as rounded whole numbers', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(812.6)).toBe('813');
    expect(formatCompactNumber(9999)).toBe('9999');
  });

  it('shortens thousands with one decimal place in Polish', () => {
    expect(formatCompactNumber(12345)).toBe('12,3 tys.');
    expect(formatCompactNumber(45000)).toBe('45 tys.');
    expect(formatCompactNumber(999999)).toBe('1 mln');
  });

  it('shortens millions', () => {
    expect(formatCompactNumber(2_500_000)).toBe('2,5 mln');
  });

  it('uses English suffixes when English is selected', () => {
    localStorage.setItem('mp_language', 'en');
    expect(formatCompactNumber(12345)).toBe('12.3k');
    expect(formatCompactNumber(2_500_000)).toBe('2.5M');
  });

  it('keeps the sign of negative values', () => {
    expect(formatCompactNumber(-12345)).toBe('-12,3 tys.');
  });

  it('can keep one decimal place for small values', () => {
    expect(formatCompactNumber(12.34, 1)).toBe('12.3');
    expect(formatCompactNumber(12000.5, 1)).toBe('12 tys.');
  });
});
