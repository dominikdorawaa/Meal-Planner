import { api } from './apiClient';
import { t } from '../i18n';

export type PlanSelectionKind = 'recipe' | 'product';

export interface PlanSelectionItem {
  kind: PlanSelectionKind;
  id: string;
}

export interface PlanSelection {
  id: string;
  items: PlanSelectionItem[];
}

export const DEFAULT_RECIPE_PORTIONS = 1;
export const DEFAULT_PRODUCT_GRAMS = 100;

const STATE_KEY = 'planSelection';
const FINISHED_KEY = 'mp_finished_plan_selections';
const FINISHED_LIMIT = 20;

function isPlanSelectionItem(value: unknown): value is PlanSelectionItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (item.kind === 'recipe' || item.kind === 'product') && typeof item.id === 'string';
}

function finishedSelectionIds(): string[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(FINISHED_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function newPlanSelection(): PlanSelection {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, items: [] };
}

export function readPlanSelection(locationState: unknown): PlanSelection | null {
  if (typeof locationState !== 'object' || locationState === null) return null;
  const stored = (locationState as Record<string, unknown>)[STATE_KEY];
  if (typeof stored !== 'object' || stored === null) return null;
  const { id, items } = stored as Record<string, unknown>;
  if (typeof id !== 'string' || !Array.isArray(items) || finishedSelectionIds().includes(id)) return null;
  return { id, items: items.filter(isPlanSelectionItem) };
}

export function planSelectionState(selection: PlanSelection) {
  return { [STATE_KEY]: selection };
}

export function finishPlanSelection(selection: PlanSelection) {
  try {
    const ids = [...finishedSelectionIds().filter(id => id !== selection.id), selection.id].slice(-FINISHED_LIMIT);
    sessionStorage.setItem(FINISHED_KEY, JSON.stringify(ids));
  } catch {
    return;
  }
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

export async function addSelectionAfterItem(
  selection: PlanSelection | null,
  savedItem: PlanSelectionItem | null,
  mealDate: string,
  mealType: string
) {
  if (!selection) return;
  finishPlanSelection(selection);
  const items = savedItem
    ? selection.items.filter(item => !(item.kind === savedItem.kind && item.id === savedItem.id))
    : selection.items;
  try {
    await addSelectionToPlan(items, mealDate, mealType);
  } catch (err) {
    console.error('Selected items save error:', err);
    alert(t('planSelection.notAllSaved'));
  }
}
