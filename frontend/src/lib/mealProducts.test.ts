import { describe, expect, it } from 'vitest';
import { recentIngredientProducts, recentMealItems, resolveMealProduct } from './mealProducts';

const skyr = { id: 'skyr', name: 'Skyr', kcal: 65 };
const oats = { id: 'oats', name: 'Oats', kcal: 370 };

describe('resolveMealProduct', () => {
  it('uses the product embedded in the meal', () => {
    expect(resolveMealProduct({ product: skyr }, [])).toBe(skyr);
  });

  it('finds full product data in another meal when the meal only has the product id', () => {
    const meals = [{ product: { id: 'skyr' } }, { product: skyr }];

    expect(resolveMealProduct({ product: { id: 'skyr' } }, meals)).toBe(skyr);
    expect(resolveMealProduct({ product: 'skyr' }, meals)).toBe(skyr);
  });

  it('returns null when the product is unknown or missing', () => {
    expect(resolveMealProduct({ product: { id: 'missing' } }, [{ product: { id: 'missing' } }])).toBeNull();
    expect(resolveMealProduct({ product: null }, [])).toBeNull();
    expect(resolveMealProduct(null, [])).toBeNull();
  });
});

describe('resolveMealProduct with incomplete nutrition', () => {
  it('keeps a saved product without calories so its meal card still shows', () => {
    const noCalories = { id: 'old', name: 'Old product', kcal: null };

    expect(resolveMealProduct({ product: noCalories }, [])).toBe(noCalories);
    expect(resolveMealProduct({ product: { id: 'old' } }, [{ product: noCalories }])).toBe(noCalories);
  });
});

describe('recentMealItems', () => {
  const omelette = { id: 'omelette', name: 'Omelette' };
  const recipes = [omelette];

  it('does not offer products without calories for new meals', () => {
    const noCalories = { id: 'old', name: 'Old product', kcal: null };

    expect(recentMealItems([{ product: noCalories }, { product: skyr }], recipes, 5)).toEqual([{ kind: 'product', item: skyr }]);
  });

  it('returns unique products and recipes from the newest meals first', () => {
    const meals = [
      { created_at: '2026-10-01T08:00:00Z', product: oats },
      { created_at: '2026-10-03T08:00:00Z', product: skyr },
      { created_at: '2026-10-02T08:00:00Z', product: oats },
      { created_at: '2026-10-04T08:00:00Z', recipe: { id: 'omelette' } },
      { created_at: '2026-10-05T08:00:00Z', recipe: 'omelette' },
      { created_at: '2026-10-06T08:00:00Z', recipe: { id: 'archived' } },
      { product: { id: 'no-data' } },
    ];

    expect(recentMealItems(meals, recipes, 5)).toEqual([
      { kind: 'recipe', item: omelette },
      { kind: 'product', item: skyr },
      { kind: 'product', item: oats },
    ]);
  });

  it('skips products that were deleted', () => {
    const deleted = { id: 'deleted', name: 'Deleted', kcal: 100, deleted: true };
    const meals = [
      { created_at: '2026-10-02T08:00:00Z', product: deleted },
      { created_at: '2026-10-01T08:00:00Z', product: skyr },
    ];

    expect(recentMealItems(meals, recipes, 5)).toEqual([{ kind: 'product', item: skyr }]);
  });

  it('stops at the limit', () => {
    const meals = [{ product: skyr }, { product: oats }];

    expect(recentMealItems(meals, recipes, 1)).toHaveLength(1);
  });
});

describe('recentIngredientProducts', () => {
  const milk = { id: 'milk', name: 'Milk', kcal: 50 };

  it('merges products from meals and own recipe ingredients, newest first and without repeats', () => {
    const meals = [
      { created_at: '2026-10-01T08:00:00Z', product: skyr },
      { created_at: '2026-10-05T08:00:00Z', product: oats },
      { created_at: '2026-10-06T08:00:00Z', recipe: { id: 'omelette' } },
    ];
    const recipes = [
      {
        own: true,
        created_at: '2026-09-01T08:00:00Z',
        ingredients: [
          { created_at: '2026-10-03T08:00:00Z', product: skyr },
          { created_at: '2026-10-04T08:00:00Z', product: milk },
          { created_at: '2026-10-02T08:00:00Z', product: oats },
        ],
      },
    ];

    expect(recentIngredientProducts(meals, recipes, 5)).toEqual([oats, milk, skyr]);
  });

  it('uses the recipe date for ingredients without their own date', () => {
    const meals = [{ created_at: '2026-10-02T08:00:00Z', product: skyr }];
    const recipes = [{ own: true, created_at: '2026-10-03T08:00:00Z', ingredients: [{ product: milk }] }];

    expect(recentIngredientProducts(meals, recipes, 5)).toEqual([milk, skyr]);
  });

  it('ignores recipes of other people and recipes without ingredients', () => {
    const recipes = [
      { own: false, ingredients: [{ product: milk }] },
      { own: true, ingredients: null },
      { own: true },
    ];

    expect(recentIngredientProducts([], recipes, 5)).toEqual([]);
  });

  it('skips deleted products, products without calories and missing products', () => {
    const deleted = { id: 'deleted', name: 'Deleted', kcal: 100, deleted: true };
    const noCalories = { id: 'old', name: 'Old product', kcal: null };
    const meals = [{ product: deleted }, { product: noCalories }, { product: 'skyr' }, { product: null }];
    const recipes = [{ own: true, ingredients: [{ product: null }, { product: oats }] }];

    expect(recentIngredientProducts(meals, recipes, 5)).toEqual([oats]);
  });

  it('stops at the limit', () => {
    expect(recentIngredientProducts([{ product: skyr }, { product: oats }], [], 1)).toEqual([skyr]);
  });
});
