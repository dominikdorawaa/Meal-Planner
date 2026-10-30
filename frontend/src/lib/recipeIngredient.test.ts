import { describe, expect, it } from 'vitest';
import {
  defaultIngredientAmount,
  ingredientFactor,
  ingredientGrams,
  ingredientAmountLabel,
  ingredientMacros,
  ingredientNutrition,
  ingredientUnits,
  ingredientsWithoutProduct,
  supportedIngredientUnit,
  recipeMacrosPerPortion,
} from './recipeIngredient';
import { measure, withMeasures } from './measureFixtures';

const skyr = { id: 'p1', name: 'Skyr', kcal: 65, protein: 12, fat: 0.2, carbs: 4.2, unit: '100g' };
const juice = withMeasures({ id: 'p2', name: 'Sok', kcal: 45, protein: 0, fat: 0, carbs: 11, unit: '100ml' }, measure('package', 1000));
const skyrIn = (...extra: ReturnType<typeof measure>[]) => withMeasures(skyr, ...extra);
const egg = { id: 'p3', name: 'Jajko', kcal: 75, protein: 6.3, fat: 5, carbs: 0.4, unit: 'pc' };

describe('ingredientsWithoutProduct', () => {
  it('lists only ingredients that have no product', () => {
    const honey = { name: 'Miód', amount: 20, unit: 'g', product: null };
    const salt = { name: 'Sól', amount: 1, unit: 'g' };
    const ingredients = [{ name: 'Skyr', amount: 100, unit: 'g', product: skyr }, honey, salt];
    expect(ingredientsWithoutProduct(ingredients)).toEqual([honey, salt]);
  });
});

describe('ingredientUnits', () => {
  it('offers grams for products measured per 100 g', () => {
    expect(ingredientUnits(skyr)).toEqual(['g']);
  });

  it('offers every measure of the product starting with the best fitting one', () => {
    expect(ingredientUnits(skyrIn(measure('package', 450), measure('piece', 150)))).toEqual(['g', 'package', 'piece']);
    expect(ingredientUnits(skyrIn(measure('tbsp', 25, true), measure('package', 450)))).toEqual(['tbsp', 'package', 'g']);
    expect(ingredientUnits(juice)).toEqual(['ml', 'package']);
  });

  it('offers only pieces for products counted per piece', () => {
    expect(ingredientUnits(egg)).toEqual(['piece']);
  });
});

describe('defaultIngredientAmount', () => {
  it('starts with 100 g or 100 ml', () => {
    expect(defaultIngredientAmount(skyr)).toEqual({ amount: 100, unit: 'g' });
    expect(defaultIngredientAmount(juice)).toEqual({ amount: 100, unit: 'ml' });
  });

  it('starts with one piece for products counted per piece', () => {
    expect(defaultIngredientAmount(egg)).toEqual({ amount: 1, unit: 'piece' });
  });

  it('starts with one default measure when the product has one', () => {
    expect(defaultIngredientAmount(skyrIn(measure('piece', 120, true)))).toEqual({ amount: 1, unit: 'piece' });
  });
});

describe('ingredientFactor', () => {
  it('scales nutrition per 100 g by the weight', () => {
    expect(ingredientFactor({ amount: 250, unit: 'g', product: skyr })).toBe(2.5);
  });

  it('turns every measure into its weight', () => {
    expect(ingredientFactor({ amount: 2, unit: 'package', product: skyrIn(measure('package', 450)) })).toBe(9);
    expect(ingredientFactor({ amount: 3, unit: 'piece', product: skyrIn(measure('piece', 50)) })).toBe(1.5);
    expect(ingredientFactor({ amount: 2, unit: 'tbsp', product: skyrIn(measure('tbsp', 25)) })).toBe(0.5);
    expect(ingredientFactor({ amount: 1, unit: 'cup', product: withMeasures(juice, measure('cup', 250)) })).toBe(2.5);
  });

  it('counts pieces directly for products counted per piece', () => {
    expect(ingredientFactor({ amount: 2, unit: 'piece', product: egg })).toBe(2);
  });

  it('cannot scale units the product does not support', () => {
    expect(ingredientFactor({ amount: 1, unit: 'package', product: skyr })).toBeNull();
    expect(ingredientFactor({ amount: 100, unit: 'g', product: egg })).toBeNull();
    expect(ingredientFactor({ amount: 1, unit: 'tbsp', product: skyr })).toBeNull();
    expect(ingredientFactor({ amount: 100, unit: 'g', product: null })).toBeNull();
  });
});

describe('ingredientGrams', () => {
  it('shows the weight of packages and pieces', () => {
    expect(ingredientGrams({ amount: 2, unit: 'package', product: skyrIn(measure('package', 450)) })).toBe(900);
    expect(ingredientGrams({ amount: 150, unit: 'g', product: skyr })).toBe(150);
  });

  it('has no weight when it cannot be known', () => {
    expect(ingredientGrams({ amount: 2, unit: 'piece', product: egg })).toBeNull();
    expect(ingredientGrams({ amount: 1, unit: 'package', product: skyr })).toBeNull();
    expect(ingredientGrams({ amount: 2, unit: 'piece', product: null })).toBeNull();
  });

  it('keeps the weight of ingredients saved without a product', () => {
    expect(ingredientGrams({ amount: 200, unit: 'g', product: null })).toBe(200);
  });
});

describe('ingredientMacros', () => {
  it('scales the product nutrition to the chosen amount', () => {
    expect(ingredientMacros({ amount: 1, unit: 'package', product: skyrIn(measure('package', 450)) })).toEqual({
      kcal: 293, protein: 54, fat: 0.9, carbs: 18.9,
    });
  });

  it('is zero when the amount cannot be scaled', () => {
    expect(ingredientMacros({ amount: 1, unit: 'package', product: skyr })).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
    expect(ingredientMacros({ amount: 1, unit: 'g', product: { id: 'p9', name: 'Empty', unit: '100g' } as never })).toEqual({
      kcal: 0, protein: 0, fat: 0, carbs: 0,
    });
  });
});

describe('ingredientNutrition', () => {
  it('scales the product nutrition including products without calories', () => {
    expect(ingredientNutrition({ amount: 1, unit: 'package', product: skyrIn(measure('package', 450)) })?.kcal).toBe(293);
    expect(ingredientNutrition({ amount: 250, unit: 'ml', product: { id: 'w', name: 'Water', unit: '100ml', kcal: 0 } as never })).toEqual({
      kcal: 0, protein: 0, fat: 0, carbs: 0,
    });
  });

  it('has no data without a product, calories or a known measure', () => {
    expect(ingredientNutrition({ amount: 20, unit: 'g', product: null })).toBeNull();
    expect(ingredientNutrition({ amount: 1, unit: 'package', product: skyr })).toBeNull();
    expect(ingredientNutrition({ amount: 1, unit: 'g', product: { id: 'p9', name: 'Empty', unit: '100g' } as never })).toBeNull();
  });
});

describe('recipeMacrosPerPortion', () => {
  const ingredients = [
    { amount: 200, unit: 'g', product: skyr },
    { amount: 2, unit: 'piece', product: egg },
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
  it('shows the amount in the declined measure name with its weight', () => {
    expect(ingredientAmountLabel({ amount: 2, unit: 'package', product: skyrIn(measure('package', 450)) })).toBe('2 opakowania (900 g)');
    expect(ingredientAmountLabel({ amount: 100, unit: 'package', product: skyrIn(measure('package', 50000)) })).toBe('100 opakowań (5 mln g)');
    expect(ingredientAmountLabel({ amount: 1, unit: 'package', product: juice })).toBe('1 opakowanie (1000 ml)');
    expect(ingredientAmountLabel({ amount: 1.5, unit: 'tbsp', product: skyrIn(measure('tbsp', 20)) })).toBe('1.5 łyżki (30 g)');
    expect(ingredientAmountLabel({ amount: 5, unit: 'tbsp', product: skyrIn(measure('tbsp', 20)) })).toBe('5 łyżek (100 g)');
    expect(ingredientAmountLabel({ amount: 2, unit: 'tbsp', product: withMeasures({ unit: '100ml' }, measure('tbsp', 15)) })).toBe('2 łyżki (30 ml)');
    expect(ingredientAmountLabel({ amount: 1, unit: 'pinch', product: skyrIn(measure('pinch', 0.5)) })).toBe('1 szczypta (0.5 g)');
    expect(ingredientAmountLabel({ amount: 0.5, unit: 'pinch', product: skyrIn(measure('pinch', 0.5)) })).toBe('0.5 szczypty (0.3 g)');
  });

  it('shows the plain amount for base units, pieces of products counted per piece and old ingredients', () => {
    expect(ingredientAmountLabel({ amount: 150, unit: 'g', product: skyr })).toBe('150 g');
    expect(ingredientAmountLabel({ amount: 2, unit: 'piece', product: egg })).toBe('2 szt.');
    expect(ingredientAmountLabel({ amount: 1, unit: 'łyżka', product: null })).toBe('1 łyżka');
    expect(ingredientAmountLabel({ amount: 2, unit: 'package', product: null })).toBe('2 opak.');
    expect(ingredientAmountLabel({ amount: 1, unit: 'tbsp', product: skyr })).toBe('1 tbsp');
  });
});

describe('supportedIngredientUnit', () => {
  it('accepts units the product can be measured in', () => {
    expect(supportedIngredientUnit(juice, 'package')).toBe('package');
    expect(supportedIngredientUnit(skyr, 'g')).toBe('g');
  });

  it('rejects units the product cannot be measured in', () => {
    expect(supportedIngredientUnit(skyr, 'package')).toBeNull();
    expect(supportedIngredientUnit(skyr, 'tbsp')).toBeNull();
  });
});
