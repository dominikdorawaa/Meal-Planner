import { t, type MessageKey } from '../i18n';

export const MEAL_COLORS = ['#f2b84b', '#7fc77a', '#a78bfa', '#60a5fa', '#f472b6', '#2dd4bf'];

export function mealColor(index: number): string {
  return MEAL_COLORS[Math.max(index, 0) % MEAL_COLORS.length];
}

export interface MealType {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
}

const DEFAULT_MEAL_TYPES: { id: string; nameKey: MessageKey; icon: string }[] = [
  { id: 'breakfast', nameKey: 'mealType.breakfast', icon: 'egg_alt' },
  { id: 'lunch', nameKey: 'mealType.lunch', icon: 'bakery_dining' },
  { id: 'dinner', nameKey: 'mealType.dinner', icon: 'lunch_dining' },
  { id: 'snack1', nameKey: 'mealType.snack1', icon: 'nutrition' },
  { id: 'snack2', nameKey: 'mealType.snack2', icon: 'cookie' },
  { id: 'supper', nameKey: 'mealType.supper', icon: 'dinner_dining' },
];

interface MealTypeProfile {
  meal_config?: unknown;
  visible_meals?: unknown;
}

function fallbackMealTypeName(id: string): string {
  const meal = DEFAULT_MEAL_TYPES.find(type => type.id === id);
  return meal ? t(meal.nameKey) : id;
}

export function defaultMealTypes(): MealType[] {
  return DEFAULT_MEAL_TYPES.map(({ id, nameKey, icon }) => ({ id, name: t(nameKey), icon, visible: true }));
}

export function profileMealTypes(profile: MealTypeProfile | null | undefined): MealType[] {
  const config = profile?.meal_config;
  if (Array.isArray(config) && config.length > 0) {
    return (config as MealType[]).map(meal => ({ ...meal, name: meal.name?.trim() || fallbackMealTypeName(meal.id) }));
  }
  const visibleMeals = profile?.visible_meals;
  return defaultMealTypes().map(meal => ({
    ...meal,
    visible: !Array.isArray(visibleMeals) || visibleMeals.includes(meal.id),
  }));
}

export function mealTypeName(id: string, mealTypes: { id: string; name?: string }[] = []): string {
  return mealTypes.find(meal => meal.id === id)?.name?.trim() || fallbackMealTypeName(id);
}
