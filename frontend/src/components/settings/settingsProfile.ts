import { calorieTarget } from '../../lib/calorieTarget';

export interface SettingsProfile {
  display_name: string;
  gender: string;
  age: number;
  height: number;
  weight: number;
  target_weight: number;
  lifestyle_activity: number;
  exercise_activity: number;
  goal: string;
  change_speed: number;
  is_manual_macros: boolean;
  target_kcal: number;
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  target_protein_min: number;
  target_protein_max: number;
  target_fat_min: number;
  target_fat_max: number;
  target_carbs_min: number;
  target_carbs_max: number;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
}

export function toSettingsProfile(data: Record<string, unknown> | null | undefined): SettingsProfile {
  const source = data ?? {};
  const weight = numberOr(source.weight, 65);
  return {
    display_name: typeof source.display_name === 'string' ? source.display_name : '',
    gender: source.gender === 'male' ? 'male' : 'female',
    age: numberOr(source.age, 30),
    height: numberOr(source.height, 170),
    weight,
    target_weight: numberOr(source.target_weight, weight),
    lifestyle_activity: numberOr(source.lifestyle_activity, 0),
    exercise_activity: numberOr(source.exercise_activity, 0),
    goal: typeof source.goal === 'string' && source.goal ? source.goal : 'maintain',
    change_speed: numberOr(source.change_speed, 0.5),
    is_manual_macros: source.is_manual_macros === true,
    target_kcal: numberOr(source.target_kcal, 2000),
    target_protein: numberOr(source.target_protein, 120),
    target_fat: numberOr(source.target_fat, 60),
    target_carbs: numberOr(source.target_carbs, 200),
    target_protein_min: numberOr(source.target_protein_min, 100),
    target_protein_max: numberOr(source.target_protein_max, 140),
    target_fat_min: numberOr(source.target_fat_min, 50),
    target_fat_max: numberOr(source.target_fat_max, 70),
    target_carbs_min: numberOr(source.target_carbs_min, 180),
    target_carbs_max: numberOr(source.target_carbs_max, 220),
  };
}

export function withCalculatedTargets(profile: SettingsProfile): SettingsProfile {
  if (profile.is_manual_macros) return profile;
  const target = calorieTarget(profile);
  return {
    ...profile,
    goal: target.goal,
    target_kcal: target.kcal,
    target_protein: target.protein,
    target_fat: target.fat,
    target_carbs: target.carbs,
    target_protein_min: target.proteinMin,
    target_protein_max: target.proteinMax,
    target_fat_min: target.fatMin,
    target_fat_max: target.fatMax,
    target_carbs_min: target.carbsMin,
    target_carbs_max: target.carbsMax,
  };
}

export function manualRange(grams: number): { min: number; max: number } {
  return { min: Math.floor(grams * 0.95), max: Math.ceil(grams * 1.05) };
}

export type ManualTargets = { kcal: number; protein: number; fat: number; carbs: number };

const MANUAL_TARGETS_KEY = 'mp_manual_targets';

function isManualTargets(value: unknown): value is ManualTargets {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ['kcal', 'protein', 'fat', 'carbs'].every(key => typeof record[key] === 'number' && Number.isFinite(record[key]));
}

export function readManualTargets(): ManualTargets | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MANUAL_TARGETS_KEY) ?? 'null');
    return isManualTargets(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeManualTargets(targets: ManualTargets): void {
  try {
    localStorage.setItem(MANUAL_TARGETS_KEY, JSON.stringify(targets));
  } catch {
    return;
  }
}
