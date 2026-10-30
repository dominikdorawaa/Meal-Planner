import { describe, expect, it } from 'vitest';
import {
  extraNutrientInputs,
  formatNutritionFact,
  measureUnit,
  recipeExtraNutrients,
  recipeExtraNutrientsPerPortion,
  scaleNutritionFacts,
} from './nutrients';

const cream = { unit: '100g', saturated_fat: 12, sugars: 3.4, fiber: 0, salt: 0.1 };
const egg = { unit: 'pc', saturated_fat: 1.5, sugars: 0.2, fiber: 0, salt: 0.2 };

describe('scaleNutritionFacts', () => {
  it('scales known values and keeps missing ones missing', () => {
    expect(scaleNutritionFacts({ kcal: 200, fat: 10, sugars: null }, 1.5)).toEqual({
      kcal: 300, fat: 15, saturated_fat: null, carbs: null, sugars: null, fiber: null, protein: null, salt: null,
    });
  });
});

describe('formatNutritionFact', () => {
  it('formats energy, grams and salt', () => {
    expect(formatNutritionFact('kcal', 185.6)).toBe('186 kcal');
    expect(formatNutritionFact('fat', 18.04)).toBe('18 g');
    expect(formatNutritionFact('sugars', 3.36)).toBe('3.4 g');
    expect(formatNutritionFact('salt', 0.125)).toBe('0.13 g');
  });

  it('shortens very large values', () => {
    expect(formatNutritionFact('kcal', 45000)).toBe('45 tys. kcal');
    expect(formatNutritionFact('fat', 12345.6)).toBe('12,3 tys. g');
  });

  it('returns nothing for a missing value', () => {
    expect(formatNutritionFact('fiber', null)).toBeNull();
    expect(formatNutritionFact('fiber', undefined)).toBeNull();
  });
});

describe('recipeExtraNutrientsPerPortion', () => {
  const NO_VALUES = { saturated_fat: null, sugars: null, fiber: null, salt: null };

  it('sums every ingredient and divides by the number of portions', () => {
    expect(recipeExtraNutrientsPerPortion([
      { amount: 200, unit: 'g', product: cream },
      { amount: 2, unit: 'piece', product: egg },
      { amount: 100, unit: 'ml', product: { ...cream, unit: '100ml' } },
    ], 2)).toEqual({
      saturated_fat: expect.closeTo(19.5), sugars: expect.closeTo(5.3), fiber: 0, salt: expect.closeTo(0.35),
    });
  });

  it('leaves out only the nutrient that an ingredient misses', () => {
    expect(recipeExtraNutrientsPerPortion([{ amount: 200, unit: 'g', product: { ...cream, salt: null } }], 2)).toEqual({
      saturated_fat: expect.closeTo(12), sugars: expect.closeTo(3.4), fiber: 0, salt: null,
    });
  });

  it('leaves out every nutrient when an amount cannot be converted to the product unit', () => {
    expect(recipeExtraNutrientsPerPortion([{ amount: 1, unit: 'szt', product: cream }], 1)).toEqual(NO_VALUES);
    expect(recipeExtraNutrientsPerPortion([{ amount: 50, unit: 'g', product: egg }], 1)).toEqual(NO_VALUES);
  });

  it('leaves out every nutrient without ingredients or portions', () => {
    expect(recipeExtraNutrientsPerPortion([], 1)).toEqual(NO_VALUES);
    expect(recipeExtraNutrientsPerPortion([{ amount: 200, unit: 'g', product: cream }], 0)).toEqual(NO_VALUES);
  });

  it('treats a missing amount as zero', () => {
    expect(recipeExtraNutrientsPerPortion([{ amount: Number.NaN, unit: 'g', product: cream }], 1))
      .toEqual({ saturated_fat: 0, sugars: 0, fiber: 0, salt: 0 });
  });
});

describe('recipeExtraNutrients', () => {
  it('sums the ingredients with data and names the ones without it', () => {
    expect(recipeExtraNutrients([
      { name: 'Cream', amount: 200, unit: 'g', product: cream },
      { name: 'Honey', amount: 20, unit: 'g' },
      { name: 'Salted butter', amount: 10, unit: 'g', product: { unit: '100g', saturated_fat: 50, sugars: null, fiber: null, salt: 1 } },
    ], 2)).toEqual({
      values: { saturated_fat: expect.closeTo(14.5), sugars: expect.closeTo(3.4), fiber: 0, salt: expect.closeTo(0.15) },
      missing: { saturated_fat: ['Honey'], sugars: ['Honey', 'Salted butter'], fiber: ['Honey', 'Salted butter'], salt: ['Honey'] },
    });
  });

  it('shows no value and no names when no ingredient has the data', () => {
    expect(recipeExtraNutrients([{ amount: 20, unit: 'g' }], 1)).toEqual({
      values: { saturated_fat: null, sugars: null, fiber: null, salt: null },
      missing: {},
    });
  });

  it('names an ingredient without a name as an empty name', () => {
    expect(recipeExtraNutrients([{ amount: 200, unit: 'g', product: cream }, { amount: 1, unit: 'g' }], 1).missing.salt).toEqual(['']);
  });
});

describe('measureUnit', () => {
  it('measures drinks in millilitres and everything else in grams', () => {
    expect(measureUnit('100ml')).toBe('ml');
    expect(measureUnit('100g')).toBe('g');
    expect(measureUnit(null)).toBe('g');
  });
});

describe('extraNutrientInputs', () => {
  it('turns known values into form text and leaves missing ones empty', () => {
    expect(extraNutrientInputs({ saturated_fat: 12.1, sugars: 0, fiber: null })).toEqual({
      saturated_fat: '12.1', sugars: '0', fiber: '', salt: '',
    });
  });
});
