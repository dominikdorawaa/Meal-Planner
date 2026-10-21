import { api, ApiError, type Product } from './apiClient';
import type { ProductMeasure } from './measures';

export interface ProductPrefill {
  name?: string | null;
  brand?: string | null;
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  saturated_fat?: number | null;
  sugars?: number | null;
  fiber?: number | null;
  salt?: number | null;
  package_weight?: number | null;
  measures?: ProductMeasure[] | null;
}

export interface BarCodeLookup {
  product: Product | null;
  prefill: ProductPrefill | null;
}

function prefillFrom(body: unknown): ProductPrefill | null {
  if (!body || typeof body !== 'object' || !('prefill' in body)) return null;
  const prefill = (body as { prefill: unknown }).prefill;
  return prefill && typeof prefill === 'object' ? (prefill as ProductPrefill) : null;
}

export async function findProductByBarCode(barCode: string): Promise<BarCodeLookup> {
  try {
    return { product: await api.products.getByBarCode(barCode), prefill: null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { product: null, prefill: prefillFrom(error.body) };
    throw error;
  }
}

export async function findExistingProduct(barCode: string): Promise<Product | null> {
  try {
    return await api.products.getExistingByBarCode(barCode);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export type MissingProductMessage = 'scanner.notFound' | 'scanner.foundToReview' | 'scanner.foundToReviewWithoutName';

export function missingProductMessage(prefill: ProductPrefill | null): MissingProductMessage {
  if (!prefill) return 'scanner.notFound';
  return prefill.name?.trim() ? 'scanner.foundToReview' : 'scanner.foundToReviewWithoutName';
}

export function normalizeBarCode(value: string): string {
  return value.replace(/\D/g, '');
}
