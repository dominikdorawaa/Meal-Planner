export const AMOUNT_LIMITS = {
  g: 5000,
  ml: 5000,
  portion: 50,
  szt: 100,
  opak: 100,
} as const;

export type AmountLimitUnit = keyof typeof AMOUNT_LIMITS;

export const AMOUNT_DECIMALS = 1;

export const NUTRITION_LIMITS = {
  kcal: 900,
  protein: 100,
  fat: 100,
  carbs: 100,
  saturated_fat: 100,
  sugars: 100,
  fiber: 100,
  salt: 100,
} as const;

export const NUTRITION_DECIMALS = 2;

export const RECIPE_LIMITS = {
  prepMinutes: 1440,
} as const;

export const MEAL_LIMITS = {
  kcal: 10000,
  grams: 1000,
} as const;

export const PROFILE_LIMITS = {
  targetKcal: 10000,
  weight: 500,
  macroGrams: 1000,
  macroPercent: 100,
} as const;

export function amountLimit(unit: string): number {
  return unit in AMOUNT_LIMITS ? AMOUNT_LIMITS[unit as AmountLimitUnit] : AMOUNT_LIMITS.g;
}

function numberPattern(decimals: number): RegExp {
  return decimals > 0 ? new RegExp(`^\\d*([.,]\\d{0,${decimals}})?$`) : /^\d*$/;
}

export function acceptsLimitedNumber(raw: string, max: number, decimals = AMOUNT_DECIMALS): boolean {
  if (raw === '') return true;
  if (!numberPattern(decimals).test(raw)) return false;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value <= max;
}

export function isPositiveWithinLimit(value: number | string | null | undefined, max: number): boolean {
  if (value == null || value === '') return false;
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max;
}

export function numberFieldProps(max: number, decimals = AMOUNT_DECIMALS) {
  return {
    type: 'number',
    inputMode: decimals > 0 ? 'decimal' : 'numeric',
    autoComplete: 'off',
    min: 0,
    max,
    step: decimals > 0 ? 10 ** -decimals : 1,
  } as const;
}
