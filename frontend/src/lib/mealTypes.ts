export interface MealType {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
}

export const MEAL_TYPES = [
  { id: 'breakfast', name: 'Śniadanie', icon: 'light_mode' },
  { id: 'snack1', name: '2 Śniadanie', icon: 'bakery_dining' },
  { id: 'lunch', name: 'Lunch', icon: 'lunch_dining' },
  { id: 'snack2', name: 'Przekąska', icon: 'nutrition' },
  { id: 'dinner', name: 'Obiad', icon: 'restaurant' },
  { id: 'supper', name: 'Kolacja', icon: 'dark_mode' },
];

interface MealTypeProfile {
  meal_config?: unknown;
  visible_meals?: unknown;
}

export function profileMealTypes(profile: MealTypeProfile | null | undefined): MealType[] {
  if (Array.isArray(profile?.meal_config)) return profile.meal_config as MealType[];
  const visibleMeals = profile?.visible_meals;
  return MEAL_TYPES.map(meal => ({
    ...meal,
    visible: !Array.isArray(visibleMeals) || visibleMeals.includes(meal.id),
  }));
}
