import { describe, expect, it } from 'vitest';
import { addToMealLabel, fullDayLabel, shortDayLabel, weekdayShort, weekStartOf } from './planTarget';

const TODAY = '2026-11-17';

describe('planTarget', () => {
  it('starts weeks on Monday', () => {
    expect(weekStartOf('2026-11-17')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
  });

  it('names weekdays with their short Polish names', () => {
    expect(weekdayShort('2026-11-16')).toBe('Pn');
    expect(weekdayShort('2026-11-22')).toBe('Nd');
    expect(weekdayShort('not a date')).toBe('not a date');
  });

  it('says today and tomorrow and uses the weekday for other days', () => {
    expect(shortDayLabel(TODAY, TODAY)).toBe('Dziś');
    expect(shortDayLabel('2026-11-18', TODAY)).toBe('Jutro');
    expect(shortDayLabel('2026-11-20', TODAY)).toBe('pt 20.11');
    expect(fullDayLabel(TODAY, TODAY)).toBe('Dziś, 17.11');
    expect(fullDayLabel('2026-11-18', TODAY)).toBe('Jutro, 18.11');
    expect(fullDayLabel('2026-11-20', TODAY)).toBe('Piątek, 20.11');
  });

  it('declines default meal names and keeps custom ones as they are', () => {
    expect(addToMealLabel('dinner', [{ id: 'dinner', name: 'Obiad' }])).toBe('Dodaj do obiadu');
    expect(addToMealLabel('lunch', [])).toBe('Dodaj do II śniadania');
    expect(addToMealLabel('dinner', [{ id: 'dinner', name: 'Lunch w pracy' }])).toBe('Dodaj: Lunch w pracy');
    expect(addToMealLabel('gym', [{ id: 'gym', name: 'Po treningu' }])).toBe('Dodaj: Po treningu');
  });
});
