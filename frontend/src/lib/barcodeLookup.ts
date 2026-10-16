import { api, ApiError, type Product } from './apiClient';

export async function findProductByBarCode(barCode: string): Promise<Product | null> {
  try {
    return await api.products.getByBarCode(barCode);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function normalizeBarCode(value: string): string {
  return value.replace(/\D/g, '');
}
