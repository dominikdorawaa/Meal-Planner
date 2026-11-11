import { describe, expect, it } from 'vitest';
import { manualRange, toSettingsProfile, withCalculatedTargets } from './settingsProfile';
import { activityLabel, formatLongDate, formatPace, formatShortDate, formatWeight } from './settingsFormat';

describe('toSettingsProfile', () => {
  it('fills missing values with defaults', () => {
    expect(toSettingsProfile(null)).toMatchObject({ display_name: '', gender: 'female', age: 30, height: 170, weight: 65, target_weight: 65, change_speed: 0.5, goal: 'maintain', is_manual_macros: false });
  });

  it('reads numbers stored as text and uses the current weight as the default goal', () => {
    expect(toSettingsProfile({ gender: 'male', weight: '80.5', age: 'x', goal: 'reduce', is_manual_macros: true })).toMatchObject({
      gender: 'male',
      weight: 80.5,
      target_weight: 80.5,
      age: 30,
      goal: 'reduce',
      is_manual_macros: true,
    });
  });
});

describe('withCalculatedTargets', () => {
  it('keeps manual goals untouched', () => {
    const manual = { ...toSettingsProfile(null), is_manual_macros: true, target_kcal: 1800 };
    expect(withCalculatedTargets(manual)).toBe(manual);
  });

  it('fills calculated goals and ranges', () => {
    const profile = withCalculatedTargets({ ...toSettingsProfile({ gender: 'male', age: 23, height: 182, weight: 78, target_weight: 74, lifestyle_activity: 0.2, exercise_activity: 0.2 }) });
    expect(profile).toMatchObject({ goal: 'reduce', target_kcal: 2392, target_protein: 172, target_fat_min: 62, target_carbs_max: 312 });
  });
});

describe('manualRange', () => {
  it('allows five percent around a manual goal', () => {
    expect(manualRange(100)).toEqual({ min: 95, max: 105 });
  });
});

describe('settings formatting', () => {
  it('formats weights, paces and dates in Polish', () => {
    expect(formatWeight(74)).toBe('74');
    expect(formatWeight(72.5)).toBe('72,5');
    expect(formatWeight('x')).toBe('--');
    expect(formatPace(0.25)).toBe('0,25');
    expect(formatShortDate(new Date(2027, 0, 6))).toBe('06.01.2027');
    expect(formatLongDate(new Date(2027, 0, 6))).toBe('6 stycznia 2027');
  });

  it('names activity levels and falls back to the raw value', () => {
    expect(activityLabel('day', 0)).toBe('Siedzący');
    expect(activityLabel('training', 0.3)).toBe('5 i więcej');
    expect(activityLabel('training', 0.4)).toBe('0,4');
  });

  it('formats dates in English when English is chosen', () => {
    localStorage.setItem('mp_language', 'en');
    expect(formatLongDate(new Date(2027, 0, 6))).toBe('6 January 2027');
    localStorage.clear();
  });
});
