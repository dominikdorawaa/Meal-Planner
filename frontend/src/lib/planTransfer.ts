import { api } from './apiClient';

type EntityReference = string | { id?: string } | null | undefined;

export type PlanMeal = {
  id: string;
  meal_date: string;
  meal_type: string;
  recipe?: EntityReference;
  product?: EntityReference;
  portions_consumed?: number | null;
  measure_code?: string | null;
  measure_amount?: number | null;
  manual_name?: string | null;
  manual_kcal?: number | null;
  manual_protein?: number | null;
  manual_fat?: number | null;
  manual_carbs?: number | null;
};
export type Placement = { meal: PlanMeal; meal_date: string; meal_type: string };
export type ConflictMode = 'overwrite' | 'append';
export type TransferResult = { created: PlanMeal[]; removed: PlanMeal[]; complete: boolean };

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
  measure_code: meal.measure_code,
  measure_amount: meal.measure_amount,
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

const fulfilledValues = <T>(results: PromiseSettledResult<T>[]) =>
  results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));

const addCopy = (meal: PlanMeal, mealDate: string, mealType: string): Promise<PlanMeal> =>
  api.meals.add(mealCopyPayload(meal, mealDate, mealType));

export async function transferMeals(
  placements: Placement[],
  conflicts: PlanMeal[],
  mode: ConflictMode,
  removedSources: PlanMeal[] = []
): Promise<TransferResult> {
  const created = fulfilledValues(
    await Promise.allSettled(placements.map(placement => addCopy(placement.meal, placement.meal_date, placement.meal_type)))
  );
  if (created.length < placements.length) {
    await Promise.allSettled(created.map(meal => api.meals.delete(meal.id)));
    throw new Error('Could not add every meal copy');
  }
  const toRemove = [...(mode === 'overwrite' ? conflicts : []), ...removedSources];
  const deletions = await Promise.allSettled(toRemove.map(meal => api.meals.delete(meal.id)));
  const removed = toRemove.filter((_, index) => deletions[index].status === 'fulfilled');
  return { created, removed, complete: removed.length === toRemove.length };
}

export async function undoTransfer(result: TransferResult) {
  const restores = await Promise.allSettled(result.removed.map(meal => addCopy(meal, meal.meal_date, meal.meal_type)));
  const deletions = await Promise.allSettled(result.created.map(meal => api.meals.delete(meal.id)));
  if ([...restores, ...deletions].some(outcome => outcome.status === 'rejected')) {
    throw new Error('Could not undo every change');
  }
}

export async function deleteMeals(meals: PlanMeal[]) {
  await Promise.all(meals.map(meal => api.meals.delete(meal.id)));
}
