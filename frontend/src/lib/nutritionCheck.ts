import type { MessageKey } from '../i18n';

export type NutritionIssue =
  | 'NAME_MISSING'
  | 'NUTRIENT_MISSING'
  | 'NEGATIVE_VALUE'
  | 'KCAL_ABOVE_900'
  | 'MACRO_ABOVE_100G'
  | 'MACROS_SUM_ABOVE_100G'
  | 'KCAL_LOOKS_LIKE_KJ'
  | 'KCAL_MISMATCH'
  | 'INVALID_BAR_CODE'
  | 'KCAL_DEVIATION';

export interface NutritionInput {
  name?: string | null;
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  unit?: string | null;
  barCode?: string | null;
}

export interface NutritionCheck {
  errors: NutritionIssue[];
  warnings: NutritionIssue[];
  valid: boolean;
}

const MAX_KCAL_PER_100G = 900;
const MAX_GRAMS_PER_100G = 100;
const MACROS_SUM_ROUNDING = 1;
const KJ_RATIO_MIN = 3.8;
const KJ_RATIO_MAX = 4.6;
const KJ_MIN_EXPECTED_KCAL = 20;
const MISMATCH_MIN_KCAL = 40;
const MISMATCH_RATIO = 0.35;
const DEVIATION_MIN_KCAL = 15;
const DEVIATION_RATIO = 0.15;
const PER_PIECE_UNIT = 'pc';
const BAR_CODE_LENGTHS = [8, 12, 13];
const WARNINGS: NutritionIssue[] = ['KCAL_MISMATCH', 'KCAL_DEVIATION'];

export function isValidBarCode(barCode: string): boolean {
  if (!BAR_CODE_LENGTHS.includes(barCode.length) || !/^\d+$/.test(barCode)) return false;
  const lastIndex = barCode.length - 1;
  let sum = 0;
  for (let i = lastIndex - 1; i >= 0; i--) {
    const digit = Number(barCode[i]);
    sum += (lastIndex - i) % 2 === 1 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === Number(barCode[lastIndex]);
}

export function parseNutritionValue(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function energyIssue(kcal: number, protein: number, fat: number, carbs: number): NutritionIssue | null {
  const expected = 4 * protein + 4 * carbs + 9 * fat;
  if (expected > KJ_MIN_EXPECTED_KCAL) {
    const ratio = kcal / expected;
    if (ratio >= KJ_RATIO_MIN && ratio <= KJ_RATIO_MAX) return 'KCAL_LOOKS_LIKE_KJ';
  }
  const difference = Math.abs(kcal - expected);
  const scale = Math.max(kcal, expected);
  if (difference > Math.max(MISMATCH_MIN_KCAL, MISMATCH_RATIO * scale)) return 'KCAL_MISMATCH';
  if (difference > Math.max(DEVIATION_MIN_KCAL, DEVIATION_RATIO * scale)) return 'KCAL_DEVIATION';
  return null;
}

function split(issues: NutritionIssue[]): NutritionCheck {
  const errors = issues.filter(issue => !WARNINGS.includes(issue));
  return { errors, warnings: issues.filter(issue => WARNINGS.includes(issue)), valid: errors.length === 0 };
}

export function checkNutrition({ name, kcal, protein, fat, carbs, unit, barCode }: NutritionInput): NutritionCheck {
  const issues: NutritionIssue[] = [];
  if (!name || name.trim() === '') issues.push('NAME_MISSING');
  if (barCode && barCode.trim() !== '' && !isValidBarCode(barCode.trim())) issues.push('INVALID_BAR_CODE');
  if (kcal == null || protein == null || fat == null || carbs == null) {
    issues.push('NUTRIENT_MISSING');
    return split(issues);
  }
  if ([kcal, protein, fat, carbs].some(value => value < 0)) issues.push('NEGATIVE_VALUE');
  if (unit !== PER_PIECE_UNIT) {
    if (kcal > MAX_KCAL_PER_100G) issues.push('KCAL_ABOVE_900');
    if ([protein, fat, carbs].some(value => value > MAX_GRAMS_PER_100G)) issues.push('MACRO_ABOVE_100G');
    if (protein + fat + carbs > MAX_GRAMS_PER_100G + MACROS_SUM_ROUNDING) issues.push('MACROS_SUM_ABOVE_100G');
  }
  const energy = energyIssue(kcal, protein, fat, carbs);
  if (energy) issues.push(energy);
  return split(issues);
}

export function formNutritionHints(check: NutritionCheck, nutrientsStarted: boolean): NutritionIssue[] {
  const errors = check.errors.filter(issue =>
    issue !== 'NAME_MISSING' && (issue !== 'NUTRIENT_MISSING' || nutrientsStarted));
  return [...errors, ...check.warnings];
}

export function nutritionIssueMessageKey(issue: NutritionIssue): MessageKey {
  return `nutrition.${issue.toLowerCase().replace(/_/g, '-')}` as MessageKey;
}
