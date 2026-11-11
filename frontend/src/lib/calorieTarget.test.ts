import { describe, expect, it } from 'vitest';
import { activityFactor, activityLevelKcal, calorieTarget, goalEta, manualPace, restingKcal, weightGoal, type BodyProfile } from './calorieTarget';

const profile: BodyProfile = {
  gender: 'male',
  age: 23,
  height: 182,
  weight: 78,
  target_weight: 74,
  lifestyle_activity: 0.2,
  exercise_activity: 0.2,
  change_speed: 0.5,
};

describe('weightGoal', () => {
  it('reads the goal from the current and the target weight', () => {
    expect(weightGoal(78, 74)).toBe('reduce');
    expect(weightGoal(70, 74)).toBe('build');
    expect(weightGoal(74, 74)).toBe('maintain');
    expect(weightGoal(74, null)).toBe('maintain');
    expect(weightGoal('74,5', '74')).toBe('reduce');
  });
});

describe('restingKcal', () => {
  it('uses the Mifflin-St Jeor formula for both sexes', () => {
    expect(restingKcal(profile)).toBeCloseTo(1807.5);
    expect(restingKcal({ ...profile, gender: 'female' })).toBeCloseTo(1641.5);
  });
});

describe('activityFactor', () => {
  it('adds lifestyle and training to the base factor', () => {
    expect(activityFactor(profile)).toBeCloseTo(1.6);
    expect(activityFactor({ lifestyle_activity: '', exercise_activity: 'x' })).toBeCloseTo(1.2);
  });
});

describe('calorieTarget', () => {
  it('subtracts the weekly pace when reducing', () => {
    const target = calorieTarget(profile);
    expect(target).toMatchObject({ goal: 'reduce', resting: 1808, activityFactor: 1.6, maintenance: 2892, adjustment: -500, kcal: 2392 });
    expect(target.protein).toBe(172);
    expect(target.fat).toBe(70);
    expect(target.carbs).toBe(269);
    expect([target.proteinMin, target.proteinMax]).toEqual([156, 187]);
  });

  it('adds the pace when building and ignores it when maintaining', () => {
    expect(calorieTarget({ ...profile, target_weight: 82 })).toMatchObject({ goal: 'build', adjustment: 500, kcal: 3392 });
    expect(calorieTarget({ ...profile, target_weight: 78 })).toMatchObject({ goal: 'maintain', adjustment: 0, kcal: 2892 });
  });

  it('never goes below the daily minimum and never returns negative carbs', () => {
    const tiny = calorieTarget({ ...profile, gender: 'female', weight: 40, height: 140, age: 90, target_weight: 30, change_speed: 1.5 });
    expect(tiny.kcal).toBe(1200);
    expect(tiny.carbs).toBeGreaterThanOrEqual(0);
  });
});

describe('activityLevelKcal', () => {
  it('shows how many calories one activity level adds', () => {
    expect(activityLevelKcal(profile, 0.1)).toBe(181);
    expect(activityLevelKcal(profile, 0)).toBe(0);
  });
});

describe('goalEta', () => {
  const today = new Date(2026, 10, 11);

  it('counts weeks and the date of reaching the goal', () => {
    const eta = goalEta(78, 74, 0.5, today);
    expect(eta?.weeks).toBe(8);
    expect(eta?.kilograms).toBe(4);
    expect(eta?.date).toEqual(new Date(2027, 0, 6));
  });

  it('rounds partial weeks up', () => {
    expect(goalEta(78, 77, 0.75, today)?.weeks).toBe(2);
  });

  it('returns nothing when there is no change to make', () => {
    expect(goalEta(74, 74, 0.5, today)).toBeNull();
    expect(goalEta(78, 74, 0, today)).toBeNull();
    expect(goalEta(78, null, 0.5, today)).toBeNull();
  });
});

describe('manualPace', () => {
  const body: BodyProfile = { gender: 'male', age: 23, height: 182, weight: 78, target_weight: 74, lifestyle_activity: 0.2, exercise_activity: 0.2, change_speed: 0.5 };

  it('turns a hand set daily goal into the weekly pace it gives', () => {
    expect(manualPace(body, 2392)).toBeCloseTo(0.5, 5);
    expect(manualPace(body, 3000)).toBe(0);
    expect(manualPace({ ...body, target_weight: 82 }, 3392)).toBeCloseTo(0.5, 5);
    expect(manualPace({ ...body, target_weight: 82 }, 2000)).toBe(0);
    expect(manualPace({ ...body, target_weight: 78 }, 2000)).toBe(0);
  });
});
