import { api } from './apiClient';

export type PlanSelectionKind = 'recipe' | 'product';

export interface PlanSelectionItem {
  kind: PlanSelectionKind;
  id: string;
}

export const DEFAULT_RECIPE_PORTIONS = 1;
export const DEFAULT_PRODUCT_GRAMS = 100;

const STATE_KEY = 'planSelection';

function isPlanSelectionItem(value: unknown): value is PlanSelectionItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (item.kind === 'recipe' || item.kind === 'product') && typeof item.id === 'string';
}

export function readPlanSelection(locationState: unknown): PlanSelectionItem[] {
  if (typeof locationState !== 'object' || locationState === null) return [];
  const items = (locationState as Record<string, unknown>)[STATE_KEY];
  return Array.isArray(items) ? items.filter(isPlanSelectionItem) : [];
}

export function planSelectionState(items: PlanSelectionItem[]) {
  return { [STATE_KEY]: items };
}

export function isSelected(items: PlanSelectionItem[], kind: PlanSelectionKind, id: string | number) {
  return items.some(item => item.kind === kind && item.id === String(id));
}

export function toggleSelection(items: PlanSelectionItem[], kind: PlanSelectionKind, id: string | number) {
  const key = String(id);
  return isSelected(items, kind, key)
    ? items.filter(item => !(item.kind === kind && item.id === key))
    : [...items, { kind, id: key }];
}

export function selectionMealPayload(item: PlanSelectionItem, mealDate: string, mealType: string) {
  return item.kind === 'recipe'
    ? { recipe: { id: item.id }, meal_date: mealDate, meal_type: mealType, portions_consumed: DEFAULT_RECIPE_PORTIONS }
    : { product: { id: item.id }, meal_date: mealDate, meal_type: mealType, portions_consumed: DEFAULT_PRODUCT_GRAMS };
}

export class PlanSelectionSaveError extends Error {
  readonly remaining: PlanSelectionItem[];

  constructor(remaining: PlanSelectionItem[], cause: unknown) {
    super('Could not save the selected items', { cause });
    this.remaining = remaining;
  }
}

export async function addSelectionToPlan(items: PlanSelectionItem[], mealDate: string, mealType: string) {
  for (const [index, item] of items.entries()) {
    try {
      await api.meals.add(selectionMealPayload(item, mealDate, mealType));
    } catch (cause) {
      throw new PlanSelectionSaveError(items.slice(index), cause);
    }
  }
}
