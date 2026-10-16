import type { Product } from './apiClient';

type SavedProduct = Omit<Partial<Product>, 'kcal'> & { kcal?: number | null };

interface MealWithProduct {
  product?: SavedProduct | string | null;
  created_at?: string;
}

function productId(meal: MealWithProduct | null | undefined): string | undefined {
  const product = meal?.product;
  if (typeof product === 'string') return product;
  return product?.id;
}

function withDetails(meal: MealWithProduct | null | undefined): Product | null {
  const product = meal?.product;
  if (!product || typeof product === 'string' || typeof product.name !== 'string') return null;
  return product as Product;
}

function withNutrition(meal: MealWithProduct | null | undefined): Product | null {
  const product = meal?.product;
  if (!product || typeof product === 'string' || product.kcal === undefined || product.kcal === null) return null;
  return product as Product;
}

export function resolveMealProduct(meal: MealWithProduct | null, meals: MealWithProduct[]): Product | null {
  const own = withDetails(meal);
  if (own) return own;
  const id = productId(meal);
  if (!id) return null;
  const known = meals.find(other => productId(other) === id && withDetails(other));
  return known ? withDetails(known) : null;
}

export function recentMealProducts(meals: MealWithProduct[], limit: number): Product[] {
  const sorted = [...meals].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const meal of sorted) {
    const product = withNutrition(meal);
    if (!product || product.deleted || seen.has(product.id)) continue;
    seen.add(product.id);
    result.push(product);
    if (result.length === limit) break;
  }
  return result;
}
