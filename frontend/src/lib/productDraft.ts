import type { Product } from './apiClient';
import type { NewProductDraft } from '../components/NewProductSheet';

export function draftFromProduct(product: Product): NewProductDraft {
  return {
    barCode: product.bar_code ?? undefined,
    prefill: {
      name: product.name,
      brand: product.brand ?? null,
      kcal: product.kcal,
      protein: product.protein,
      fat: product.fat,
      carbs: product.carbs,
      saturated_fat: product.saturated_fat ?? null,
      sugars: product.sugars ?? null,
      fiber: product.fiber ?? null,
      salt: product.salt ?? null,
      package_weight: product.package_weight ?? null,
    },
  };
}
