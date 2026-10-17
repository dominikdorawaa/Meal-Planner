import { arrayMove } from '@dnd-kit/sortable';

export interface MealSetting {
  id: string;
  name: string;
  icon?: string;
  visible: boolean;
}

export function reorderMeals<T extends MealSetting>(meals: T[], activeId: string, overId: string | null): T[] {
  if (!overId || activeId === overId) return meals;
  const from = meals.findIndex(meal => meal.id === activeId);
  const to = meals.findIndex(meal => meal.id === overId);
  if (from < 0 || to < 0) return meals;
  return arrayMove(meals, from, to);
}
