import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlanSelectionSaveError,
  addSelectionToPlan,
  isSelected,
  planSelectionState,
  readPlanSelection,
  selectionMealPayload,
  toggleSelection,
} from './planSelection';

const mocks = vi.hoisted(() => ({ addMeal: vi.fn() }));

vi.mock('./apiClient', () => ({
  api: { meals: { add: mocks.addMeal } },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('planSelection', () => {
  it('reads the selection back from location state', () => {
    const items = [{ kind: 'recipe' as const, id: 'r1' }, { kind: 'product' as const, id: 'p1' }];

    expect(readPlanSelection(planSelectionState(items))).toEqual(items);
  });

  it('returns an empty selection for missing or malformed state', () => {
    expect(readPlanSelection(null)).toEqual([]);
    expect(readPlanSelection('text')).toEqual([]);
    expect(readPlanSelection({})).toEqual([]);
    expect(readPlanSelection({ planSelection: 'r1' })).toEqual([]);
    expect(
      readPlanSelection({ planSelection: [null, { kind: 'meal', id: 'x' }, { kind: 'recipe', id: 5 }, { kind: 'product', id: 'p1' }] })
    ).toEqual([{ kind: 'product', id: 'p1' }]);
  });

  it('toggles items on and off by kind and id', () => {
    const withRecipe = toggleSelection([], 'recipe', 7);
    const withBoth = toggleSelection(withRecipe, 'product', 7);

    expect(withRecipe).toEqual([{ kind: 'recipe', id: '7' }]);
    expect(isSelected(withBoth, 'recipe', '7')).toBe(true);
    expect(isSelected(withBoth, 'product', 7)).toBe(true);
    expect(toggleSelection(withBoth, 'recipe', '7')).toEqual([{ kind: 'product', id: '7' }]);
  });

  it('uses the default portion shown on the add list', () => {
    expect(selectionMealPayload({ kind: 'recipe', id: 'r1' }, '2026-10-17', 'lunch')).toEqual({
      recipe: { id: 'r1' },
      meal_date: '2026-10-17',
      meal_type: 'lunch',
      portions_consumed: 1,
    });
    expect(selectionMealPayload({ kind: 'product', id: 'p1' }, '2026-10-17', 'lunch')).toEqual({
      product: { id: 'p1' },
      meal_date: '2026-10-17',
      meal_type: 'lunch',
      portions_consumed: 100,
    });
  });

  it('saves every selected item in order', async () => {
    mocks.addMeal.mockResolvedValue({});

    await addSelectionToPlan([{ kind: 'recipe', id: 'r1' }, { kind: 'product', id: 'p1' }], '2026-10-17', 'dinner');

    expect(mocks.addMeal.mock.calls.map(call => call[0])).toEqual([
      { recipe: { id: 'r1' }, meal_date: '2026-10-17', meal_type: 'dinner', portions_consumed: 1 },
      { product: { id: 'p1' }, meal_date: '2026-10-17', meal_type: 'dinner', portions_consumed: 100 },
    ]);
  });

  it('reports the items that were not saved when a save fails', async () => {
    const failure = new Error('Server error (500)');
    mocks.addMeal.mockResolvedValueOnce({}).mockRejectedValueOnce(failure);
    const items = [{ kind: 'recipe' as const, id: 'r1' }, { kind: 'product' as const, id: 'p1' }, { kind: 'recipe' as const, id: 'r2' }];

    const error = await addSelectionToPlan(items, '2026-10-17', 'dinner').catch(err => err);

    expect(error).toBeInstanceOf(PlanSelectionSaveError);
    expect(error.remaining).toEqual(items.slice(1));
    expect(error.cause).toBe(failure);
    expect(mocks.addMeal).toHaveBeenCalledTimes(2);
  });
});
