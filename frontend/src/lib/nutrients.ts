import type { MessageKey } from '../i18n';

export const EXTRA_NUTRIENTS = ['saturated_fat', 'sugars', 'fiber', 'salt'] as const;
export type ExtraNutrient = (typeof EXTRA_NUTRIENTS)[number];
export type ExtraNutrientValues = Partial<Record<ExtraNutrient, number | null>>;

export const NUTRITION_FACTS = ['kcal', 'fat', 'saturated_fat', 'carbs', 'sugars', 'fiber', 'protein', 'salt'] as const;
export type NutritionFact = (typeof NUTRITION_FACTS)[number];
export type NutritionFactValues = Partial<Record<NutritionFact, number | null>>;

export const NUTRITION_FACT_LABELS: Record<NutritionFact, MessageKey> = {
  kcal: 'nutrients.energy',
  fat: 'nutrients.fat',
  saturated_fat: 'nutrients.saturatedFat',
  carbs: 'nutrients.carbs',
  sugars: 'nutrients.sugars',
  fiber: 'nutrients.fiber',
  protein: 'nutrients.protein',
  salt: 'nutrients.salt',
};

export const NESTED_NUTRITION_FACTS: readonly NutritionFact[] = ['saturated_fat', 'sugars'];

const PER_PIECE_UNIT = 'pc';
const PIECE_INGREDIENT_UNIT = 'szt';
const MASS_INGREDIENT_UNITS = ['g', 'ml'];

export function scaleNutritionFacts(values: NutritionFactValues, factor: number): NutritionFactValues {
  const scaled: NutritionFactValues = {};
  for (const fact of NUTRITION_FACTS) {
    const value = values[fact];
    scaled[fact] = value == null ? null : value * factor;
  }
  return scaled;
}

export function formatNutritionFact(fact: NutritionFact, value: number | null | undefined): string | null {
  if (value == null) return null;
  if (fact === 'kcal') return `${Math.round(value)} kcal`;
  return `${Number(value.toFixed(fact === 'salt' ? 2 : 1))} g`;
}

export interface IngredientWithProduct {
  amount: number;
  unit: string;
  product?: (ExtraNutrientValues & { unit?: string | null }) | null;
}

function ingredientFactor(ingredient: IngredientWithProduct): number | null {
  const product = ingredient.product;
  if (!product) return null;
  const perPiece = product.unit === PER_PIECE_UNIT;
  if (perPiece && ingredient.unit === PIECE_INGREDIENT_UNIT) return Number(ingredient.amount) || 0;
  if (!perPiece && MASS_INGREDIENT_UNITS.includes(ingredient.unit)) return (Number(ingredient.amount) || 0) / 100;
  return null;
}

export function recipeExtraNutrientsPerPortion(
  ingredients: IngredientWithProduct[],
  portions: number,
): ExtraNutrientValues | null {
  if (ingredients.length === 0 || !(portions > 0)) return null;
  const totals: Record<ExtraNutrient, number> = { saturated_fat: 0, sugars: 0, fiber: 0, salt: 0 };
  for (const ingredient of ingredients) {
    const factor = ingredientFactor(ingredient);
    if (factor == null) return null;
    for (const nutrient of EXTRA_NUTRIENTS) {
      const value = ingredient.product?.[nutrient];
      if (value == null) return null;
      totals[nutrient] += value * factor;
    }
  }
  const perPortion: ExtraNutrientValues = {};
  for (const nutrient of EXTRA_NUTRIENTS) perPortion[nutrient] = totals[nutrient] / portions;
  return perPortion;
}
