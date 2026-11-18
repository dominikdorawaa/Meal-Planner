import { t, type MessageKey } from '../i18n';
import { addDaysToIsoDate, formatDayMonth, formatLongWeekday, parseIsoDate, toIsoDate } from './planDates';
import { mealTypeName } from './mealTypes';

const ADD_TO_MEAL: Record<string, MessageKey> = {
  breakfast: 'planTarget.addTo.breakfast',
  lunch: 'planTarget.addTo.lunch',
  dinner: 'planTarget.addTo.dinner',
  snack1: 'planTarget.addTo.snack1',
  snack2: 'planTarget.addTo.snack2',
  supper: 'planTarget.addTo.supper',
};

const WEEKDAY_KEYS: MessageKey[] = [
  'recipeDetails.weekday.sun',
  'recipeDetails.weekday.mon',
  'recipeDetails.weekday.tue',
  'recipeDetails.weekday.wed',
  'recipeDetails.weekday.thu',
  'recipeDetails.weekday.fri',
  'recipeDetails.weekday.sat',
];

export function weekdayShort(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return date ? t(WEEKDAY_KEYS[date.getDay()]) : isoDate;
}

export function weekStartOf(isoDate: string): string {
  const date = parseIsoDate(isoDate) ?? new Date();
  const offset = (date.getDay() + 6) % 7;
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset));
}

function relativeName(isoDate: string, today: string): string | null {
  if (isoDate === today) return t('recipeDetails.today');
  if (isoDate === addDaysToIsoDate(today, 1)) return t('recipeDetails.tomorrow');
  return null;
}

export function shortDayLabel(isoDate: string, today: string = toIsoDate(new Date())): string {
  return relativeName(isoDate, today) ?? `${weekdayShort(isoDate).toLowerCase()} ${formatDayMonth(isoDate)}`;
}

export function fullDayLabel(isoDate: string, today: string = toIsoDate(new Date())): string {
  const name = relativeName(isoDate, today) ?? formatLongWeekday(isoDate, t('recipeDetails.locale'));
  return `${name}, ${formatDayMonth(isoDate)}`;
}

export function addToMealLabel(mealId: string, meals: { id: string; name?: string }[]): string {
  const key = ADD_TO_MEAL[mealId];
  const usesDefaultName = key && mealTypeName(mealId, meals) === mealTypeName(mealId);
  return usesDefaultName ? t(key) : t('planTarget.addToNamed', { meal: mealTypeName(mealId, meals) });
}
