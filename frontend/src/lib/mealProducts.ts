import type { Product } from './apiClient';

type SavedProduct = Omit<Partial<Product>, 'kcal'> & { kcal?: number | null };

interface MealWithProduct {
  product?: SavedProduct | string | null;
  recipe?: { id?: string } | string | null;
  created_at?: string;
}

interface KnownRecipe {
  id: string;
}

export type RecentItem<R extends KnownRecipe> =
  | { kind: 'product'; item: Product }
  | { kind: 'recipe'; item: R };

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

function newestFirst(meals: MealWithProduct[]): MealWithProduct[] {
  return [...meals].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function recipeId(meal: MealWithProduct): string | undefined {
  const recipe = meal.recipe;
  if (typeof recipe === 'string') return recipe;
  return recipe?.id;
}

export function recentMealItems<R extends KnownRecipe>(meals: MealWithProduct[], recipes: R[], limit: number): RecentItem<R>[] {
  const seen = new Set<string>();
  const result: RecentItem<R>[] = [];
  for (const meal of newestFirst(meals)) {
    const product = withNutrition(meal);
    const id = recipeId(meal);
    const recipe = id ? recipes.find(known => known.id === id) : undefined;
    const entry: RecentItem<R> | null = product && !product.deleted
      ? { kind: 'product', item: product }
      : recipe ? { kind: 'recipe', item: recipe } : null;
    if (!entry) continue;
    const key = `${entry.kind}:${entry.item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
    if (result.length === limit) break;
  }
  return result;
}

interface RecipeWithIngredients {
  own?: boolean;
  created_at?: string;
  ingredients?: { product?: SavedProduct | null; created_at?: string }[] | null;
}

export function recentIngredientProducts(meals: MealWithProduct[], recipes: RecipeWithIngredients[], limit: number): Product[] {
  const ingredientUses = recipes
    .filter(recipe => recipe.own)
    .flatMap(recipe => (recipe.ingredients ?? []).map(ingredient => ({
      product: ingredient.product,
      created_at: ingredient.created_at ?? recipe.created_at,
    })));
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const use of newestFirst([...meals, ...ingredientUses])) {
    const product = withNutrition(use);
    if (!product || product.deleted || seen.has(product.id)) continue;
    seen.add(product.id);
    result.push(product);
    if (result.length === limit) break;
  }
  return result;
}
