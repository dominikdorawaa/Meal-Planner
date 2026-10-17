import { api } from './apiClient';

type EntityReference = string | { id?: string } | null | undefined;

export type PlanMeal = {
  id: string;
  meal_date: string;
  meal_type: string;
  recipe?: EntityReference;
  product?: EntityReference;
  portions_consumed?: number | null;
  manual_name?: string | null;
  manual_kcal?: number | null;
  manual_protein?: number | null;
  manual_fat?: number | null;
  manual_carbs?: number | null;
};
export type Placement = { meal: PlanMeal; meal_date: string; meal_type: string };
export type ConflictMode = 'overwrite' | 'append';
export type TransferResult = { created: PlanMeal[]; removed: PlanMeal[] };

export const slotKey = (mealDate: string, mealType: string) => `${mealDate}_${mealType}`;

export const parseSlotKey = (key: string) => {
  const separatorIndex = key.indexOf('_');
  return { meal_date: key.slice(0, separatorIndex), meal_type: key.slice(separatorIndex + 1) };
};

export const entityId = (value: EntityReference) => (typeof value === 'string' ? value : value?.id) || null;

const entityReference = (value: EntityReference) => {
  const id = entityId(value);
  return id ? { id } : null;
};

export const mealCopyPayload = (meal: PlanMeal, mealDate: string, mealType: string) => ({
  recipe: entityReference(meal.recipe),
  product: entityReference(meal.product),
  meal_date: mealDate,
  meal_type: mealType,
  portions_consumed: meal.portions_consumed,
  manual_name: meal.manual_name,
  manual_kcal: meal.manual_kcal,
  manual_protein: meal.manual_protein,
  manual_fat: meal.manual_fat,
  manual_carbs: meal.manual_carbs,
});

export const mealsOfDay = (meals: PlanMeal[], mealDate: string) => meals.filter(meal => meal.meal_date === mealDate);

export const placeMealInSlots = (meal: PlanMeal, slotKeys: string[]): Placement[] =>
  slotKeys.map(key => ({ meal, ...parseSlotKey(key) }));

export const placeDayOnDates = (meals: PlanMeal[], sourceDate: string, targetDates: string[]): Placement[] =>
  targetDates.flatMap(mealDate =>
    mealsOfDay(meals, sourceDate).map(meal => ({ meal, meal_date: mealDate, meal_type: meal.meal_type }))
  );

export const findConflicts = (meals: PlanMeal[], placements: Placement[], ignoredMeals: PlanMeal[] = []) => {
  const targetSlots = new Set(placements.map(placement => slotKey(placement.meal_date, placement.meal_type)));
  const ignoredIds = new Set(ignoredMeals.map(meal => meal.id));
  return meals.filter(meal => targetSlots.has(slotKey(meal.meal_date, meal.meal_type)) && !ignoredIds.has(meal.id));
};

export async function transferMeals(
  placements: Placement[],
  conflicts: PlanMeal[],
  mode: ConflictMode,
  removedSources: PlanMeal[] = []
): Promise<TransferResult> {
  const created = await Promise.all(
    placements.map(placement => api.meals.add(mealCopyPayload(placement.meal, placement.meal_date, placement.meal_type)))
  );
  const removed = [...(mode === 'overwrite' ? conflicts : []), ...removedSources];
  await deleteMeals(removed);
  return { created, removed };
}

export async function undoTransfer(result: TransferResult) {
  await Promise.all(result.removed.map(meal => api.meals.add(mealCopyPayload(meal, meal.meal_date, meal.meal_type))));
  await deleteMeals(result.created);
}

export async function deleteMeals(meals: PlanMeal[]) {
  await Promise.all(meals.map(meal => api.meals.delete(meal.id)));
}
