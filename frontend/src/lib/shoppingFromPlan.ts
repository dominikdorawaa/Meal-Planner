import { api } from './apiClient';
import { shoppingUnit, type MeasuredProduct } from './measures';

export type ShoppingFromPlanResult = 'added' | 'no-recipes' | 'no-ingredients';

type EntityRef = string | { id: string } | null | undefined;

export interface PlanMeal {
  id: string;
  meal_date: string;
  meal_type: string;
  recipe?: EntityRef;
  product?: EntityRef;
  portions_consumed?: number | null;
  manual_name?: string | null;
}

export interface RecipeIngredient {
  name: string;
  amount: number | string;
  unit: string;
  product?: MeasuredProduct | null;
}

export interface RecipeWithIngredients {
  id: string;
  portions?: number | null;
  ingredients?: RecipeIngredient[] | null;
}

export interface ShoppingItemDraft {
  ingredient_name: string;
  quantity: number;
  unit: string;
}

export const refId = (ref: EntityRef) => (typeof ref === 'object' && ref !== null ? ref.id : ref) || null;

export function toggleMealIds(selected: string[], ids: string[]): string[] {
  const allSelected = ids.length > 0 && ids.every(id => selected.includes(id));
  return allSelected ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])];
}

export function buildShoppingAdditions(meals: PlanMeal[], recipes: RecipeWithIngredients[]) {
  const items = new Map<string, ShoppingItemDraft>();
  const recipePortions = new Map<string, number>();

  meals.forEach(meal => {
    const recipe = recipes.find(r => r.id === refId(meal.recipe));
    if (!recipe) return;

    const ratio = (meal.portions_consumed || 1.0) / (recipe.portions || 1.0);
    recipePortions.set(recipe.id, (recipePortions.get(recipe.id) || 0) + ratio);

    (recipe.ingredients ?? []).forEach(ingredient => {
      const unit = shoppingUnit(ingredient.unit, ingredient.product);
      const key = `${ingredient.name.toLowerCase()}_${unit.toLowerCase()}`;
      const scaledAmount = Number(ingredient.amount) * ratio;
      const existing = items.get(key);
      if (existing) {
        existing.quantity += scaledAmount;
      } else {
        items.set(key, { ingredient_name: ingredient.name, quantity: scaledAmount, unit });
      }
    });
  });

  return { items: [...items.values()], recipePortions };
}

export async function addPlanMealsToShoppingList(meals: PlanMeal[]): Promise<ShoppingFromPlanResult> {
  const recipeIds = [...new Set(meals.map(meal => refId(meal.recipe)).filter((id): id is string => !!id))];
  if (recipeIds.length === 0) return 'no-recipes';

  const recipes: RecipeWithIngredients[] = await Promise.all(recipeIds.map(id => api.recipes.getById(id)));
  if (!recipes.some(recipe => recipe.ingredients?.length)) return 'no-ingredients';

  const { items, recipePortions } = buildShoppingAdditions(meals, recipes);
  await Promise.all([
    ...items.map(item => api.shoppingList.addItem(item)),
    ...[...recipePortions].map(([id, portions]) => api.shoppingList.addRecipe({ recipe: { id }, portions })),
  ]);
  return 'added';
}
