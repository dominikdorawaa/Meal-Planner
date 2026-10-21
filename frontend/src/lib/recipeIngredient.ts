import type { Product } from './apiClient';
import { formatCompactNumber } from './compactNumber';
import {
  baseMeasureCode,
  defaultMeasure,
  defaultMeasureAmount,
  findMeasure,
  isBaseMeasure,
  isPerPiece,
  measureBaseAmount,
  PIECE_CODE,
  productMeasures,
  unitLabel,
  type MeasuredProduct,
} from './measures';

export type IngredientUnit = string;

export type ScalableProduct = MeasuredProduct;

export interface IngredientQuantity {
  amount: number;
  unit: IngredientUnit;
}

export interface IngredientAmount<P extends ScalableProduct = ScalableProduct> {
  amount: number;
  unit: string;
  product?: P | null;
}

export interface IngredientDraft extends IngredientAmount<Product> {
  id?: string;
  name: string;
}

export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const ZERO_MACROS: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

export function ingredientUnits(product: ScalableProduct): IngredientUnit[] {
  return productMeasures(product).map(measure => measure.code);
}

export function supportedIngredientUnit(product: ScalableProduct, unit: string): IngredientUnit | null {
  return findMeasure(product, unit)?.code ?? null;
}

export function defaultIngredientAmount(product: ScalableProduct): IngredientQuantity {
  const unit = defaultMeasure(product).code;
  return { amount: defaultMeasureAmount(product, unit), unit };
}

export function ingredientGrams({ amount, unit, product }: IngredientAmount): number | null {
  const value = Number(amount) || 0;
  if (!product) return unit === 'g' || unit === 'ml' ? value : null;
  if (isPerPiece(product)) return null;
  return measureBaseAmount(product, unit, value);
}

export function ingredientFactor(ingredient: IngredientAmount): number | null {
  const { amount, unit, product } = ingredient;
  if (!product) return null;
  if (isPerPiece(product)) return unit === PIECE_CODE ? Number(amount) || 0 : null;
  const grams = ingredientGrams(ingredient);
  return grams == null ? null : grams / 100;
}

function scaled(value: number | null | undefined, factor: number, digits: number): number {
  return Number(((Number(value) || 0) * factor).toFixed(digits));
}

export function ingredientMacros(ingredient: IngredientAmount<Partial<Macros> & ScalableProduct>): Macros {
  const factor = ingredientFactor(ingredient);
  const product = ingredient.product;
  if (factor == null || !product) return ZERO_MACROS;
  return {
    kcal: Math.round((Number(product.kcal) || 0) * factor),
    protein: scaled(product.protein, factor, 1),
    fat: scaled(product.fat, factor, 1),
    carbs: scaled(product.carbs, factor, 1),
  };
}

export function recipeMacrosPerPortion(
  ingredients: IngredientAmount<Partial<Macros> & ScalableProduct>[],
  portions = 1
): Macros {
  const totals = ingredients.map(ingredientMacros).reduce((sum, macros) => ({
    kcal: sum.kcal + macros.kcal,
    protein: sum.protein + macros.protein,
    fat: sum.fat + macros.fat,
    carbs: sum.carbs + macros.carbs,
  }), ZERO_MACROS);
  const count = portions > 0 ? portions : 1;
  return {
    kcal: Math.round(totals.kcal / count),
    protein: scaled(totals.protein, 1 / count, 1),
    fat: scaled(totals.fat, 1 / count, 1),
    carbs: scaled(totals.carbs, 1 / count, 1),
  };
}

export function ingredientUnitLabel(unit: string, amount = 1, product?: ScalableProduct | null): string {
  return unitLabel(unit, amount, product);
}

export function ingredientAmountLabel(ingredient: IngredientAmount): string {
  const amount = Number(ingredient.amount) || 0;
  const product = ingredient.product;
  const label = `${formatCompactNumber(amount, 1)} ${ingredientUnitLabel(ingredient.unit, amount, product)}`;
  if (!product || isBaseMeasure(product, ingredient.unit)) return label;
  const grams = ingredientGrams(ingredient);
  return grams == null ? label : `${label} (${formatCompactNumber(grams)} ${baseMeasureCode(product)})`;
}
