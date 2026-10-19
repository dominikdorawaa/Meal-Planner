import { describe, expect, it } from 'vitest';
import {
  defaultIngredientAmount,
  ingredientFactor,
  ingredientGrams,
  ingredientAmountLabel,
  ingredientMacros,
  ingredientUnits,
  supportedIngredientUnit,
  recipeMacrosPerPortion,
} from './recipeIngredient';

const skyr = { id: 'p1', name: 'Skyr', kcal: 65, protein: 12, fat: 0.2, carbs: 4.2, unit: '100g' };
const juice = { id: 'p2', name: 'Sok', kcal: 45, protein: 0, fat: 0, carbs: 11, unit: '100ml', package_weight: 1000 };
const egg = { id: 'p3', name: 'Jajko', kcal: 75, protein: 6.3, fat: 5, carbs: 0.4, unit: 'pc' };

describe('ingredientUnits', () => {
  it('offers grams for products measured per 100 g', () => {
    expect(ingredientUnits(skyr)).toEqual(['g']);
  });

  it('adds packages and pieces only when their weight is known', () => {
    expect(ingredientUnits({ ...skyr, package_weight: 450, piece_weight: 150 })).toEqual(['g', 'szt', 'opak']);
    expect(ingredientUnits(juice)).toEqual(['ml', 'opak']);
  });

  it('offers only pieces for products counted per piece', () => {
    expect(ingredientUnits(egg)).toEqual(['szt']);
  });
});

describe('defaultIngredientAmount', () => {
  it('starts with 100 g or 100 ml', () => {
    expect(defaultIngredientAmount(skyr)).toEqual({ amount: 100, unit: 'g' });
    expect(defaultIngredientAmount(juice)).toEqual({ amount: 100, unit: 'ml' });
  });

  it('starts with one piece for products counted per piece', () => {
    expect(defaultIngredientAmount(egg)).toEqual({ amount: 1, unit: 'szt' });
  });
});

describe('ingredientFactor', () => {
  it('scales nutrition per 100 g by the weight', () => {
    expect(ingredientFactor({ amount: 250, unit: 'g', product: skyr })).toBe(2.5);
  });

  it('turns packages and pieces into their weight', () => {
    expect(ingredientFactor({ amount: 2, unit: 'opak', product: { ...skyr, package_weight: 450 } })).toBe(9);
    expect(ingredientFactor({ amount: 3, unit: 'szt', product: { ...skyr, piece_weight: 50 } })).toBe(1.5);
  });

  it('counts pieces directly for products counted per piece', () => {
    expect(ingredientFactor({ amount: 2, unit: 'szt', product: egg })).toBe(2);
  });

  it('cannot scale units the product does not support', () => {
    expect(ingredientFactor({ amount: 1, unit: 'opak', product: skyr })).toBeNull();
    expect(ingredientFactor({ amount: 100, unit: 'g', product: egg })).toBeNull();
    expect(ingredientFactor({ amount: 1, unit: 'łyżka', product: skyr })).toBeNull();
    expect(ingredientFactor({ amount: 100, unit: 'g', product: null })).toBeNull();
  });
});

describe('ingredientGrams', () => {
  it('shows the weight of packages and pieces', () => {
    expect(ingredientGrams({ amount: 2, unit: 'opak', product: { ...skyr, package_weight: 450 } })).toBe(900);
    expect(ingredientGrams({ amount: 150, unit: 'g', product: skyr })).toBe(150);
  });

  it('has no weight when it cannot be known', () => {
    expect(ingredientGrams({ amount: 2, unit: 'szt', product: egg })).toBeNull();
    expect(ingredientGrams({ amount: 1, unit: 'opak', product: skyr })).toBeNull();
    expect(ingredientGrams({ amount: 2, unit: 'szt', product: null })).toBeNull();
  });

  it('keeps the weight of ingredients saved without a product', () => {
    expect(ingredientGrams({ amount: 200, unit: 'g', product: null })).toBe(200);
  });
});

describe('ingredientMacros', () => {
  it('scales the product nutrition to the chosen amount', () => {
    expect(ingredientMacros({ amount: 1, unit: 'opak', product: { ...skyr, package_weight: 450 } })).toEqual({
      kcal: 293, protein: 54, fat: 0.9, carbs: 18.9,
    });
  });

  it('is zero when the amount cannot be scaled', () => {
    expect(ingredientMacros({ amount: 1, unit: 'opak', product: skyr })).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
    expect(ingredientMacros({ amount: 1, unit: 'g', product: { id: 'p9', name: 'Empty', unit: '100g' } as never })).toEqual({
      kcal: 0, protein: 0, fat: 0, carbs: 0,
    });
  });
});

describe('recipeMacrosPerPortion', () => {
  const ingredients = [
    { amount: 200, unit: 'g', product: skyr },
    { amount: 2, unit: 'szt', product: egg },
  ];

  it('adds up all ingredients for a single portion', () => {
    expect(recipeMacrosPerPortion(ingredients)).toEqual({ kcal: 280, protein: 36.6, fat: 10.4, carbs: 9.2 });
  });

  it('divides the totals by the number of portions', () => {
    expect(recipeMacrosPerPortion(ingredients, 4)).toEqual({ kcal: 70, protein: 9.2, fat: 2.6, carbs: 2.3 });
  });

  it('treats a missing or invalid number of portions as one portion', () => {
    expect(recipeMacrosPerPortion(ingredients, 0)).toEqual(recipeMacrosPerPortion(ingredients, 1));
  });
});

describe('ingredientAmountLabel', () => {
  it('shows the amount with the weight of packages and pieces', () => {
    expect(ingredientAmountLabel({ amount: 2, unit: 'opak', product: { ...skyr, package_weight: 450 } })).toBe('2 opak. (900 g)');
    expect(ingredientAmountLabel({ amount: 1, unit: 'opak', product: { ...juice } })).toBe('1 opak. (1000 ml)');
    expect(ingredientAmountLabel({ amount: 3, unit: 'szt', product: { ...skyr, piece_weight: 50 } })).toBe('3 szt. (150 g)');
  });

  it('shows the plain amount for base units, pieces of products counted per piece and old ingredients', () => {
    expect(ingredientAmountLabel({ amount: 150, unit: 'g', product: skyr })).toBe('150 g');
    expect(ingredientAmountLabel({ amount: 2, unit: 'szt', product: egg })).toBe('2 szt.');
    expect(ingredientAmountLabel({ amount: 1, unit: 'łyżka', product: null })).toBe('1 łyżka');
  });
});

describe('supportedIngredientUnit', () => {
  it('accepts units the product can be measured in', () => {
    expect(supportedIngredientUnit(juice, 'opak')).toBe('opak');
    expect(supportedIngredientUnit(skyr, 'g')).toBe('g');
  });

  it('rejects units the product cannot be measured in', () => {
    expect(supportedIngredientUnit(skyr, 'opak')).toBeNull();
    expect(supportedIngredientUnit(skyr, 'łyżka')).toBeNull();
  });
});
