import type { Product } from './apiClient';
import { t } from '../i18n';

export type IngredientUnit = 'g' | 'ml' | 'szt' | 'opak';

export interface ScalableProduct {
  unit?: string | null;
  piece_weight?: number | null;
  package_weight?: number | null;
}

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

const PER_PIECE_UNIT = 'pc';
const PER_100_ML_UNIT = '100ml';
const DEFAULT_AMOUNT = 100;
const ZERO_MACROS: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

function baseUnit(product: ScalableProduct): IngredientUnit {
  if (product.unit === PER_PIECE_UNIT) return 'szt';
  return product.unit === PER_100_ML_UNIT ? 'ml' : 'g';
}

export function ingredientUnits(product: ScalableProduct): IngredientUnit[] {
  const base = baseUnit(product);
  if (base === 'szt') return ['szt'];
  const units: IngredientUnit[] = [base];
  if (product.piece_weight) units.push('szt');
  if (product.package_weight) units.push('opak');
  return units;
}

export function supportedIngredientUnit(product: ScalableProduct, unit: string): IngredientUnit | null {
  return ingredientUnits(product).find(supported => supported === unit) ?? null;
}

export function defaultIngredientAmount(product: ScalableProduct): IngredientQuantity {
  const unit = baseUnit(product);
  return { amount: unit === 'szt' ? 1 : DEFAULT_AMOUNT, unit };
}

export function ingredientGrams({ amount, unit, product }: IngredientAmount): number | null {
  const value = Number(amount) || 0;
  if (!product) return unit === 'g' || unit === 'ml' ? value : null;
  if (baseUnit(product) === 'szt') return null;
  if (unit === baseUnit(product)) return value;
  if (unit === 'opak' && product.package_weight) return value * product.package_weight;
  if (unit === 'szt' && product.piece_weight) return value * product.piece_weight;
  return null;
}

export function ingredientFactor(ingredient: IngredientAmount): number | null {
  const { amount, unit, product } = ingredient;
  if (!product) return null;
  if (baseUnit(product) === 'szt') return unit === 'szt' ? Number(amount) || 0 : null;
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

export function recipeMacros(ingredients: IngredientAmount<Partial<Macros> & ScalableProduct>[]): Macros {
  const totals = ingredients.map(ingredientMacros).reduce((sum, macros) => ({
    kcal: sum.kcal + macros.kcal,
    protein: sum.protein + macros.protein,
    fat: sum.fat + macros.fat,
    carbs: sum.carbs + macros.carbs,
  }), ZERO_MACROS);
  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein),
    fat: Math.round(totals.fat),
    carbs: Math.round(totals.carbs),
  };
}

export function ingredientUnitLabel(unit: string): string {
  if (unit === 'opak') return t('units.opak');
  if (unit === 'szt') return t('units.szt');
  return unit;
}

export function ingredientAmountLabel(ingredient: IngredientAmount): string {
  const label = `${ingredient.amount} ${ingredientUnitLabel(ingredient.unit)}`;
  const product = ingredient.product;
  if (!product || ingredient.unit === baseUnit(product)) return label;
  const grams = ingredientGrams(ingredient);
  return grams == null ? label : `${label} (${Math.round(grams)} ${baseUnit(product)})`;
}
