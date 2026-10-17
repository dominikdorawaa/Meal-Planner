import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlanSelectionSaveError,
  addSelectionAfterItem,
  addSelectionToPlan,
  finishPlanSelection,
  isSelected,
  newPlanSelection,
  planSelectionState,
  readPlanSelection,
  selectionMealPayload,
  toggleSelection,
} from './planSelection';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({ addMeal: vi.fn() }));

vi.mock('./apiClient', () => ({
  api: { meals: { add: mocks.addMeal } },
}));

const RECIPE = { kind: 'recipe' as const, id: 'r1' };
const PRODUCT = { kind: 'product' as const, id: 'p1' };

function payloads() {
  return mocks.addMeal.mock.calls.map(call => call[0]);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('planSelection', () => {
  it('reads the selection back from location state', () => {
    const selection = { id: 's1', items: [RECIPE, PRODUCT] };

    expect(readPlanSelection(planSelectionState(selection))).toEqual(selection);
  });

  it('starts every new selection empty with its own id', () => {
    const first = newPlanSelection();
    const second = newPlanSelection();

    expect(first.items).toEqual([]);
    expect(first.id).not.toBe(second.id);
  });

  it('returns no selection for missing or malformed state', () => {
    expect(readPlanSelection(null)).toBeNull();
    expect(readPlanSelection('text')).toBeNull();
    expect(readPlanSelection({})).toBeNull();
    expect(readPlanSelection({ planSelection: 'r1' })).toBeNull();
    expect(readPlanSelection({ planSelection: { id: 5, items: [] } })).toBeNull();
    expect(readPlanSelection({ planSelection: { id: 's1', items: 'r1' } })).toBeNull();
    expect(
      readPlanSelection({
        planSelection: { id: 's1', items: [null, { kind: 'meal', id: 'x' }, { kind: 'recipe', id: 5 }, PRODUCT] },
      })
    ).toEqual({ id: 's1', items: [PRODUCT] });
  });

  it('ignores a selection that was already saved', () => {
    const selection = { id: 's1', items: [RECIPE] };
    finishPlanSelection(selection);
    finishPlanSelection(selection);

    expect(readPlanSelection(planSelectionState(selection))).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('mp_finished_plan_selections')!)).toEqual(['s1']);
  });

  it('keeps only the latest saved selection ids', () => {
    for (let index = 0; index < 25; index++) finishPlanSelection({ id: `s${index}`, items: [] });

    const ids = JSON.parse(sessionStorage.getItem('mp_finished_plan_selections')!);
    expect(ids).toHaveLength(20);
    expect(ids[0]).toBe('s5');
  });

  it('treats unreadable or blocked storage as nothing saved', () => {
    sessionStorage.setItem('mp_finished_plan_selections', '{broken');
    expect(readPlanSelection(planSelectionState({ id: 's1', items: [RECIPE] }))).not.toBeNull();

    sessionStorage.setItem('mp_finished_plan_selections', '"s1"');
    expect(readPlanSelection(planSelectionState({ id: 's1', items: [RECIPE] }))).not.toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => finishPlanSelection({ id: 's2', items: [] })).not.toThrow();
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
    expect(selectionMealPayload(RECIPE, '2026-10-17', 'lunch')).toEqual({
      recipe: { id: 'r1' },
      meal_date: '2026-10-17',
      meal_type: 'lunch',
      portions_consumed: 1,
    });
    expect(selectionMealPayload(PRODUCT, '2026-10-17', 'lunch')).toEqual({
      product: { id: 'p1' },
      meal_date: '2026-10-17',
      meal_type: 'lunch',
      portions_consumed: 100,
    });
  });

  it('saves every selected item in order', async () => {
    mocks.addMeal.mockResolvedValue({});

    await addSelectionToPlan([RECIPE, PRODUCT], '2026-10-17', 'dinner');

    expect(payloads()).toEqual([
      { recipe: { id: 'r1' }, meal_date: '2026-10-17', meal_type: 'dinner', portions_consumed: 1 },
      { product: { id: 'p1' }, meal_date: '2026-10-17', meal_type: 'dinner', portions_consumed: 100 },
    ]);
  });

  it('reports the items that were not saved when a save fails', async () => {
    const failure = new Error('Server error (500)');
    mocks.addMeal.mockResolvedValueOnce({}).mockRejectedValueOnce(failure);
    const items = [RECIPE, PRODUCT, { kind: 'recipe' as const, id: 'r2' }];

    const error = await addSelectionToPlan(items, '2026-10-17', 'dinner').catch(err => err);

    expect(error).toBeInstanceOf(PlanSelectionSaveError);
    expect(error.remaining).toEqual(items.slice(1));
    expect(error.cause).toBe(failure);
    expect(mocks.addMeal).toHaveBeenCalledTimes(2);
  });
});

describe('addSelectionAfterItem', () => {
  it('does nothing without a selection', async () => {
    await addSelectionAfterItem(null, RECIPE, '2026-10-17', 'lunch');

    expect(mocks.addMeal).not.toHaveBeenCalled();
  });

  it('skips the item that was just saved with its own portion and finishes the selection', async () => {
    mocks.addMeal.mockResolvedValue({});
    const selection = { id: 's1', items: [RECIPE, PRODUCT] };

    await addSelectionAfterItem(selection, { kind: 'recipe', id: 'r1' }, '2026-10-17', 'lunch');

    expect(payloads()).toEqual([selectionMealPayload(PRODUCT, '2026-10-17', 'lunch')]);
    expect(readPlanSelection(planSelectionState(selection))).toBeNull();
  });

  it('saves the whole selection when no item is excluded', async () => {
    mocks.addMeal.mockResolvedValue({});

    await addSelectionAfterItem({ id: 's1', items: [RECIPE, PRODUCT] }, null, '2026-10-17', 'lunch');

    expect(mocks.addMeal).toHaveBeenCalledTimes(2);
  });

  it('tells the user when some selected items could not be saved', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.addMeal.mockRejectedValue(new Error('Server error (500)'));

    await addSelectionAfterItem({ id: 's1', items: [RECIPE] }, null, '2026-10-17', 'lunch');

    expect(alertMock).toHaveBeenCalledWith(t('planSelection.notAllSaved'));
  });
});
