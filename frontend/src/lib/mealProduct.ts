interface ProductLike {
  id?: string;
  kcal?: number | null;
}

interface MealWithProduct<T extends ProductLike> {
  product?: ProductLike | T | string | null;
}

export function resolveMealProduct<T extends ProductLike>(
  meal: MealWithProduct<T> | null | undefined,
  products: T[],
): T | null {
  const product = meal?.product;
  if (!product) return null;
  if (typeof product !== 'string' && product.kcal !== undefined && product.kcal !== null) return product as T;
  const id = typeof product === 'string' ? product : product.id;
  return products.find(p => p.id === id) || null;
}
