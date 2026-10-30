import { formatCompactNumber } from './compactNumber';
import type { MacroKey } from './macroColors';

export const formatMacrosShort = (protein: number, fat: number, carbs: number) =>
  `B ${formatCompactNumber(protein)}g · T ${formatCompactNumber(fat)}g · W ${formatCompactNumber(carbs)}g`;

export const targetRange = (target: number, min?: number | null, max?: number | null) =>
  `${min || Math.round(target * 0.9)}-${max || Math.round(target * 1.1)}`;

export interface MacroGrams {
  protein: number;
  fat: number;
  carbs: number;
}

export interface MacroValues extends MacroGrams {
  kcal: number;
}

const roundGrams = (value: number) => Math.round(value * 10) / 10;

export function scaleMacros(values: MacroValues, factor: number): MacroValues {
  return {
    kcal: Math.round(values.kcal * factor),
    protein: roundGrams(values.protein * factor),
    fat: roundGrams(values.fat * factor),
    carbs: roundGrams(values.carbs * factor),
  };
}

const KCAL_PER_GRAM: Record<MacroKey, number> = { protein: 4, fat: 9, carbs: 4 };

export function macroEnergyPercents(grams: MacroGrams): Record<MacroKey, number> {
  const energy = (macro: MacroKey) => Math.max(0, grams[macro]) * KCAL_PER_GRAM[macro];
  const total = energy('protein') + energy('fat') + energy('carbs');
  const percent = (macro: MacroKey) => (total > 0 ? Math.round((energy(macro) / total) * 100) : 0);
  return { protein: percent('protein'), fat: percent('fat'), carbs: percent('carbs') };
}
