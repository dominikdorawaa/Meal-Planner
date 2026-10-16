import { describe, expect, it } from 'vitest';
import { recentMealProducts, resolveMealProduct } from './mealProducts';

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

describe('recentMealProducts', () => {
  it('returns unique products from the newest meals first', () => {
    const meals = [
      { created_at: '2026-10-01T08:00:00Z', product: oats },
      { created_at: '2026-10-03T08:00:00Z', product: skyr },
      { created_at: '2026-10-02T08:00:00Z', product: oats },
      { created_at: '2026-10-04T08:00:00Z', recipe: { id: 'recipe' } },
      { product: { id: 'no-data' } },
    ];

    expect(recentMealProducts(meals, 5)).toEqual([skyr, oats]);
  });

  it('skips products that were deleted', () => {
    const deleted = { id: 'deleted', name: 'Deleted', kcal: 100, deleted: true };
    const meals = [
      { created_at: '2026-10-02T08:00:00Z', product: deleted },
      { created_at: '2026-10-01T08:00:00Z', product: skyr },
    ];

    expect(recentMealProducts(meals, 5)).toEqual([skyr]);
  });

  it('stops at the limit', () => {
    const meals = [{ product: skyr }, { product: oats }];

    expect(recentMealProducts(meals, 1)).toHaveLength(1);
  });
});
