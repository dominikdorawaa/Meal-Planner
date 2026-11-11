import { getLanguage, t, type MessageKey } from '../../i18n';
import { EXERCISE_LEVELS, LIFESTYLE_LEVELS } from '../../lib/calorieTarget';

export type ActivityKind = 'day' | 'training';

export const ACTIVITY_LEVELS: Record<ActivityKind, readonly number[]> = {
  day: LIFESTYLE_LEVELS,
  training: EXERCISE_LEVELS,
};

export function formatDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

export function formatWeight(value: number | string | null | undefined): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '--';
  return Number.isInteger(parsed) ? String(parsed) : formatDecimal(parsed, 1);
}

export function formatPace(value: number): string {
  return String(value).replace('.', ',');
}

export function dateLocale(): string {
  return getLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

export function activityLevelIndex(kind: ActivityKind, value: number): number {
  return ACTIVITY_LEVELS[kind].findIndex(level => Math.abs(level - value) < 0.001);
}

export function activityLabel(kind: ActivityKind, value: number): string {
  const index = activityLevelIndex(kind, value);
  return index === -1 ? formatPace(value) : t(`settings.activity.${kind}${index}` as MessageKey);
}


export type HeightUnit = 'cm' | 'ft';

const HEIGHT_UNIT_KEY = 'mp_height_unit';

export function readHeightUnit(): HeightUnit {
  try {
    return localStorage.getItem(HEIGHT_UNIT_KEY) === 'ft' ? 'ft' : 'cm';
  } catch {
    return 'cm';
  }
}

export function storeHeightUnit(unit: HeightUnit): void {
  try {
    localStorage.setItem(HEIGHT_UNIT_KEY, unit);
  } catch {
    return;
  }
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / 2.54);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}

export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'ft') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}′ ${inches}″`;
  }
  return `${Number.isInteger(cm) ? cm : formatDecimal(cm, 1)} cm`;
}
