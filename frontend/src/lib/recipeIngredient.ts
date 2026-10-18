import type { Product } from './apiClient';

export interface IngredientDraft {
  id?: string;
  productId?: string;
  name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const PER_PIECE_UNIT = 'pc';
const DEFAULT_AMOUNT = 100;

function scaled(value: number | null | undefined, factor: number, digits: number): number {
  return Number(((Number(value) || 0) * factor).toFixed(digits));
}

export function ingredientFromProduct(product: Product): IngredientDraft {
  const perPiece = product.unit === PER_PIECE_UNIT;
  const amount = perPiece ? 1 : DEFAULT_AMOUNT;
  const factor = perPiece ? 1 : amount / 100;
  return {
    id: product.id,
    productId: product.id,
    name: product.name,
    amount,
    unit: perPiece ? 'szt' : product.unit === '100ml' ? 'ml' : 'g',
    kcal: Math.round((Number(product.kcal) || 0) * factor),
    protein: scaled(product.protein, factor, 1),
    fat: scaled(product.fat, factor, 1),
    carbs: scaled(product.carbs, factor, 1),
  };
}
