import { afterEach, describe, expect, it } from 'vitest';
import { defaultMealTypes, mealTypeName, profileMealTypes } from './mealTypes';

afterEach(() => {
  localStorage.clear();
});

describe('defaultMealTypes', () => {
  it('lists every meal of the day with Polish names', () => {
    expect(defaultMealTypes().map(meal => [meal.id, meal.name])).toEqual([
      ['breakfast', 'Śniadanie'],
      ['lunch', 'II śniadanie'],
      ['dinner', 'Obiad'],
      ['snack1', 'Przekąska'],
      ['snack2', 'Podwieczorek'],
      ['supper', 'Kolacja'],
    ]);
  });

  it('follows the chosen language', () => {
    localStorage.setItem('mp_language', 'en');

    expect(defaultMealTypes().map(meal => meal.name)).toEqual([
      'Breakfast',
      'Second breakfast',
      'Dinner',
      'Snack',
      'Afternoon snack',
      'Supper',
    ]);
  });
});

describe('profileMealTypes', () => {
  it('uses the saved meal settings when the profile has them', () => {
    const config = [{ id: 'lunch', name: 'Obiadek', icon: 'restaurant', visible: true }];

    expect(profileMealTypes({ meal_config: config })).toEqual(config);
  });

  it('shows the default name for a saved meal without a name', () => {
    const config = [{ id: 'snack2', name: ' ', icon: 'cookie', visible: true }];

    expect(profileMealTypes({ meal_config: config })[0].name).toBe('Podwieczorek');
  });

  it('shows every default meal without a profile', () => {
    expect(profileMealTypes(null)).toEqual(defaultMealTypes());
  });

  it('shows every default meal when the saved settings are empty', () => {
    expect(profileMealTypes({ meal_config: [] })).toEqual(defaultMealTypes());
  });

  it('hides default meals missing from the older visible meals list', () => {
    const visible = profileMealTypes({ visible_meals: ['breakfast', 'dinner'] })
      .filter(meal => meal.visible)
      .map(meal => meal.id);

    expect(visible).toEqual(['breakfast', 'dinner']);
  });
});

describe('mealTypeName', () => {
  it('uses the name from the meal settings', () => {
    expect(mealTypeName('snack1', [{ id: 'snack1', name: 'Owoce' }])).toBe('Owoce');
  });

  it('falls back to the default name when the settings miss the meal', () => {
    expect(mealTypeName('snack1', [{ id: 'breakfast', name: 'Rano' }])).toBe('Przekąska');
    expect(mealTypeName('snack2')).toBe('Podwieczorek');
  });

  it('shows an unknown meal id as it is', () => {
    expect(mealTypeName('brunch')).toBe('brunch');
  });
});
