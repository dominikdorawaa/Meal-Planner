import { describe, expect, it } from 'vitest';
import { MEAL_TYPES, profileMealTypes } from './mealTypes';

describe('profileMealTypes', () => {
  it('uses the saved meal settings when the profile has them', () => {
    const config = [{ id: 'lunch', name: 'Obiadek', icon: 'restaurant', visible: true }];

    expect(profileMealTypes({ meal_config: config })).toBe(config);
  });

  it('shows every default meal without a profile', () => {
    expect(profileMealTypes(null)).toEqual(MEAL_TYPES.map(meal => ({ ...meal, visible: true })));
  });

  it('hides default meals missing from the older visible meals list', () => {
    const visible = profileMealTypes({ visible_meals: ['breakfast', 'dinner'] })
      .filter(meal => meal.visible)
      .map(meal => meal.id);

    expect(visible).toEqual(['breakfast', 'dinner']);
  });
});
