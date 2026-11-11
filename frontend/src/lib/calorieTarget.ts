export type Sex = 'male' | 'female';
export type WeightGoal = 'reduce' | 'maintain' | 'build';

export interface BodyProfile {
  gender: Sex | string;
  age: number | string;
  height: number | string;
  weight: number | string;
  target_weight?: number | string | null;
  lifestyle_activity: number | string;
  exercise_activity: number | string;
  change_speed: number | string;
}

export interface CalorieTarget {
  goal: WeightGoal;
  resting: number;
  activityFactor: number;
  maintenance: number;
  adjustment: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  proteinMin: number;
  proteinMax: number;
  fatMin: number;
  fatMax: number;
  carbsMin: number;
  carbsMax: number;
}

export const BASE_ACTIVITY_FACTOR = 1.2;
export const MIN_DAILY_KCAL = 1200;
export const LIFESTYLE_LEVELS = [0, 0.1, 0.2, 0.3] as const;
export const EXERCISE_LEVELS = [0, 0.1, 0.2, 0.3] as const;
export const PACE_MIN = 0.1;
export const PACE_MAX = 1;
export const PACE_STEP = 0.1;
export const RECOMMENDED_PACE = 0.5;
export const KCAL_PER_KG_WEEKLY = 1000;

const MACRO_RANGES: Record<WeightGoal, { protein: [number, number]; fat: [number, number]; carbs: [number, number] }> = {
  maintain: { protein: [1.6, 2.0], fat: [0.8, 1.2], carbs: [3.0, 5.0] },
  reduce: { protein: [2.0, 2.4], fat: [0.8, 1.0], carbs: [2.0, 4.0] },
  build: { protein: [1.6, 2.0], fat: [1.0, 1.3], carbs: [4.0, 7.0] },
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function weightGoal(weight: number | string, targetWeight?: number | string | null): WeightGoal {
  const current = toNumber(weight);
  const target = toNumber(targetWeight) || current;
  if (current > target) return 'reduce';
  if (current < target) return 'build';
  return 'maintain';
}

export function restingKcal(profile: Pick<BodyProfile, 'gender' | 'age' | 'height' | 'weight'>): number {
  const base = 10 * toNumber(profile.weight) + 6.25 * toNumber(profile.height) - 5 * toNumber(profile.age);
  return base + (profile.gender === 'male' ? 5 : -161);
}

export function activityFactor(profile: Pick<BodyProfile, 'lifestyle_activity' | 'exercise_activity'>): number {
  return BASE_ACTIVITY_FACTOR + toNumber(profile.lifestyle_activity) + toNumber(profile.exercise_activity);
}

export function calorieTarget(profile: BodyProfile): CalorieTarget {
  const weight = toNumber(profile.weight);
  const goal = weightGoal(profile.weight, profile.target_weight);
  const resting = restingKcal(profile);
  const factor = activityFactor(profile);
  const maintenance = resting * factor;
  const pace = toNumber(profile.change_speed) * KCAL_PER_KG_WEEKLY;
  const adjustment = goal === 'reduce' ? -pace : goal === 'build' ? pace : 0;
  const kcal = Math.max(MIN_DAILY_KCAL, Math.round(maintenance + adjustment));
  const ranges = MACRO_RANGES[goal];
  const middle = (range: [number, number]) => Math.round((weight * (range[0] + range[1])) / 2);
  const protein = middle(ranges.protein);
  const fat = middle(ranges.fat);

  return {
    goal,
    resting: Math.round(resting),
    activityFactor: Math.round(factor * 100) / 100,
    maintenance: Math.round(maintenance),
    adjustment: Math.round(adjustment),
    kcal,
    protein,
    fat,
    carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)),
    proteinMin: Math.round(weight * ranges.protein[0]),
    proteinMax: Math.round(weight * ranges.protein[1]),
    fatMin: Math.round(weight * ranges.fat[0]),
    fatMax: Math.round(weight * ranges.fat[1]),
    carbsMin: Math.round(weight * ranges.carbs[0]),
    carbsMax: Math.round(weight * ranges.carbs[1]),
  };
}

export function activityLevelKcal(profile: Pick<BodyProfile, 'gender' | 'age' | 'height' | 'weight'>, level: number): number {
  return Math.round(restingKcal(profile) * level);
}

export interface GoalEta {
  weeks: number;
  date: Date;
  kilograms: number;
}

export function goalEta(weight: number | string, targetWeight: number | string | null | undefined, pace: number | string, today = new Date()): GoalEta | null {
  const current = toNumber(weight);
  const target = toNumber(targetWeight);
  const speed = toNumber(pace);
  if (!current || !target || current === target || speed <= 0) return null;
  const kilograms = Math.abs(current - target);
  const weeksExact = kilograms / speed;
  const date = new Date(today);
  date.setDate(date.getDate() + Math.ceil(weeksExact * 7));
  return { weeks: Math.ceil(weeksExact), date, kilograms: Math.round(kilograms * 10) / 10 };
}

export function manualPace(profile: BodyProfile, dailyKcal: number | string): number {
  const target = calorieTarget(profile);
  const weekly = (target.maintenance - toNumber(dailyKcal)) / KCAL_PER_KG_WEEKLY;
  if (target.goal === 'reduce') return Math.max(0, weekly);
  if (target.goal === 'build') return Math.max(0, -weekly);
  return 0;
}

export function macroRanges(goal: WeightGoal): { protein: [number, number]; fat: [number, number]; carbs: [number, number] } {
  return MACRO_RANGES[goal];
}
