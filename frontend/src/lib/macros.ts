import { formatCompactNumber } from './compactNumber';

export const formatMacrosShort = (protein: number, fat: number, carbs: number) =>
  `B ${formatCompactNumber(protein)}g · T ${formatCompactNumber(fat)}g · W ${formatCompactNumber(carbs)}g`;

export const targetRange = (target: number, min?: number | null, max?: number | null) =>
  `${min || Math.round(target * 0.9)}-${max || Math.round(target * 1.1)}`;
