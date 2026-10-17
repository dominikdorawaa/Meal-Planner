import { describe, expect, it } from 'vitest';
import { ingredientFromProduct } from './recipeIngredient';

const base = { id: 'p1', name: 'Product', kcal: 250, protein: 10.04, fat: 5, carbs: 30 };

describe('ingredientFromProduct', () => {
  it('adds 100 g of a product measured per 100 g', () => {
    expect(ingredientFromProduct({ ...base, unit: '100g' })).toEqual({
      id: 'p1', productId: 'p1', name: 'Product', amount: 100, unit: 'g', kcal: 250, protein: 10, fat: 5, carbs: 30,
    });
  });

  it('adds 100 ml of a drink', () => {
    expect(ingredientFromProduct({ ...base, unit: '100ml' })).toMatchObject({ amount: 100, unit: 'ml', kcal: 250 });
  });

  it('adds one piece with the nutrition of one piece for products counted per piece', () => {
    expect(ingredientFromProduct({ ...base, unit: 'pc', kcal: 75, protein: 6.3, fat: 5, carbs: 0.4 })).toEqual({
      id: 'p1', productId: 'p1', name: 'Product', amount: 1, unit: 'szt', kcal: 75, protein: 6.3, fat: 5, carbs: 0.4,
    });
  });

  it('treats missing nutrition values as zero', () => {
    expect(ingredientFromProduct({ id: 'p2', name: 'Empty', unit: '100g' } as never)).toMatchObject({
      kcal: 0, protein: 0, fat: 0, carbs: 0,
    });
  });
});
