import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPlanMealsToShoppingList, buildShoppingAdditions, refId, toggleMealIds, type PlanMeal } from './shoppingFromPlan';

const mocks = vi.hoisted(() => ({
  getRecipe: vi.fn(),
  addItem: vi.fn(),
  addRecipe: vi.fn(),
}));

vi.mock('./apiClient', () => ({
  api: {
    recipes: { getById: mocks.getRecipe },
    shoppingList: { addItem: mocks.addItem, addRecipe: mocks.addRecipe },
  },
}));

const OMELETTE = {
  id: 'r1',
  portions: 2,
  ingredients: [
    { name: 'Eggs', amount: 4, unit: 'pcs' },
    { name: 'Milk', amount: '100', unit: 'ml' },
  ],
};
const PANCAKES = {
  id: 'r2',
  portions: null,
  ingredients: [
    { name: 'milk', amount: 200, unit: 'ML' },
    { name: 'Flour', amount: 150, unit: 'g' },
  ],
};

function meal(id: string, extra: Partial<PlanMeal> = {}): PlanMeal {
  return { id, meal_date: '2026-10-17', meal_type: 'breakfast', ...extra };
}

beforeEach(() => {
  mocks.getRecipe.mockReset();
  mocks.addItem.mockReset().mockResolvedValue({});
  mocks.addRecipe.mockReset().mockResolvedValue({});
});

describe('refId', () => {
  it('reads an id from a plain id or a nested object', () => {
    expect(refId('r1')).toBe('r1');
    expect(refId({ id: 'r2' })).toBe('r2');
    expect(refId(null)).toBeNull();
    expect(refId(undefined)).toBeNull();
    expect(refId('')).toBeNull();
  });
});

describe('toggleMealIds', () => {
  it('selects all given meals when any of them is missing', () => {
    expect(toggleMealIds(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('unselects the given meals when all of them are selected', () => {
    expect(toggleMealIds(['a', 'b', 'c'], ['a', 'b'])).toEqual(['c']);
  });

  it('does nothing for an empty group', () => {
    expect(toggleMealIds(['a'], [])).toEqual(['a']);
  });
});

describe('buildShoppingAdditions', () => {
  it('scales ingredients by eaten portions and merges the same name and unit', () => {
    const meals = [
      meal('m1', { recipe: { id: 'r1' }, portions_consumed: 1 }),
      meal('m2', { recipe: 'r1', portions_consumed: null }),
      meal('m3', { recipe: 'r2', portions_consumed: 0.5 }),
      meal('m4', { product: 'p1' }),
      meal('m5', { recipe: 'missing' }),
    ];

    const { items, recipePortions } = buildShoppingAdditions(meals, [OMELETTE, PANCAKES]);

    expect(items).toEqual([
      { ingredient_name: 'Eggs', quantity: 4, unit: 'pcs' },
      { ingredient_name: 'Milk', quantity: 200, unit: 'ml' },
      { ingredient_name: 'Flour', quantity: 75, unit: 'g' },
    ]);
    expect([...recipePortions]).toEqual([
      ['r1', 1],
      ['r2', 0.5],
    ]);
  });

  it('keeps a recipe without ingredients in the recipe portions', () => {
    const { items, recipePortions } = buildShoppingAdditions([meal('m1', { recipe: 'r3' })], [{ id: 'r3' }]);

    expect(items).toEqual([]);
    expect([...recipePortions]).toEqual([['r3', 1]]);
  });
});

describe('addPlanMealsToShoppingList', () => {
  it('fetches each recipe once and saves the merged items and recipe portions', async () => {
    mocks.getRecipe.mockImplementation(async (id: string) => (id === 'r1' ? OMELETTE : PANCAKES));

    const result = await addPlanMealsToShoppingList([
      meal('m1', { recipe: 'r1', portions_consumed: 2 }),
      meal('m2', { recipe: 'r1', portions_consumed: 2 }),
      meal('m3', { recipe: 'r2' }),
    ]);

    expect(result).toBe('added');
    expect(mocks.getRecipe.mock.calls).toEqual([['r1'], ['r2']]);
    expect(mocks.addItem.mock.calls.map(call => call[0])).toEqual([
      { ingredient_name: 'Eggs', quantity: 8, unit: 'pcs' },
      { ingredient_name: 'Milk', quantity: 400, unit: 'ml' },
      { ingredient_name: 'Flour', quantity: 150, unit: 'g' },
    ]);
    expect(mocks.addRecipe.mock.calls.map(call => call[0])).toEqual([
      { recipe: { id: 'r1' }, portions: 2 },
      { recipe: { id: 'r2' }, portions: 1 },
    ]);
  });

  it('reports when no selected meal is a recipe', async () => {
    expect(await addPlanMealsToShoppingList([meal('m1', { product: 'p1' }), meal('m2')])).toBe('no-recipes');
    expect(await addPlanMealsToShoppingList([])).toBe('no-recipes');
    expect(mocks.getRecipe).not.toHaveBeenCalled();
  });

  it('reports when the selected recipes have no ingredients', async () => {
    mocks.getRecipe.mockResolvedValue({ id: 'r1', ingredients: [] });

    expect(await addPlanMealsToShoppingList([meal('m1', { recipe: 'r1' })])).toBe('no-ingredients');
    expect(mocks.addItem).not.toHaveBeenCalled();
    expect(mocks.addRecipe).not.toHaveBeenCalled();
  });

  it('passes on a failed save', async () => {
    mocks.getRecipe.mockResolvedValue(OMELETTE);
    mocks.addItem.mockRejectedValue(new Error('offline'));

    await expect(addPlanMealsToShoppingList([meal('m1', { recipe: 'r1' })])).rejects.toThrow('offline');
  });
});
