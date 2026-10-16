import { describe, expect, it } from 'vitest';
import { resolveMealProduct } from './mealProduct';

const listed = { id: 'listed-1', name: 'Listed product', kcal: 100 };

describe('resolveMealProduct', () => {
  it('uses the product embedded in the meal even when it is missing from the product list', () => {
    const deleted = { id: 'deleted-1', name: 'Deleted product', kcal: 250 };

    expect(resolveMealProduct({ product: deleted }, [listed])).toBe(deleted);
  });

  it('looks up the product list when the meal only has a product reference', () => {
    expect(resolveMealProduct({ product: { id: 'listed-1' } }, [listed])).toBe(listed);
  });

  it('looks up the product list when the meal product is a plain id', () => {
    expect(resolveMealProduct({ product: 'listed-1' }, [listed])).toBe(listed);
  });

  it('returns null when the product is unknown', () => {
    expect(resolveMealProduct({ product: { id: 'missing' } }, [listed])).toBeNull();
  });

  it('returns null when the meal has no product', () => {
    expect(resolveMealProduct({ product: null }, [listed])).toBeNull();
    expect(resolveMealProduct(null, [listed])).toBeNull();
  });
});
