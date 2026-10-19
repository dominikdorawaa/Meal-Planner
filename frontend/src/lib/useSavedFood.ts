import { useCallback, useEffect, useState } from 'react';
import { api, type Product, type RecipeSummary } from './apiClient';

export interface SavedFood {
  savedProducts: Product[];
  ownProducts: Product[];
  savedRecipes: RecipeSummary[];
  recipeSavingAvailable: boolean;
  isProductSaved: (id: string) => boolean;
  isRecipeSaved: (id: string) => boolean;
  toggleProduct: (product: Product) => Promise<void>;
  toggleRecipe: (recipe: RecipeSummary) => Promise<void>;
  reload: () => Promise<void>;
}

function withoutId<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter(item => item.id !== id);
}

function loadSavedFood(): Promise<[Product[], Product[], RecipeSummary[] | null]> {
  return Promise.all([
    api.products.saved().catch(() => []),
    api.products.own().catch(() => []),
    api.recipes.saved().catch(() => null),
  ]);
}

export function useSavedFood(fallbackRecipes: RecipeSummary[]): SavedFood {
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [ownProducts, setOwnProducts] = useState<Product[]>([]);
  const [loadedRecipes, setLoadedRecipes] = useState<RecipeSummary[] | null>(null);

  const reload = useCallback(async () => {
    const [saved, own, recipes] = await loadSavedFood();
    setSavedProducts(saved);
    setOwnProducts(own);
    setLoadedRecipes(recipes);
  }, []);

  useEffect(() => {
    let current = true;
    loadSavedFood().then(([saved, own, recipes]) => {
      if (!current) return;
      setSavedProducts(saved);
      setOwnProducts(own);
      setLoadedRecipes(recipes);
    });
    return () => {
      current = false;
    };
  }, []);

  const recipeSavingAvailable = loadedRecipes !== null;
  const savedRecipes = loadedRecipes ?? fallbackRecipes.filter(recipe => recipe.saved === true);

  const isProductSaved = useCallback((id: string) => savedProducts.some(product => product.id === id), [savedProducts]);
  const isRecipeSaved = useCallback((id: string) => savedRecipes.some(recipe => recipe.id === id), [savedRecipes]);

  const toggleProduct = async (product: Product) => {
    const wasSaved = isProductSaved(product.id);
    setSavedProducts(current => wasSaved ? withoutId(current, product.id) : [product, ...current]);
    try {
      await (wasSaved ? api.products.unsave(product.id) : api.products.save(product.id));
    } catch {
      setSavedProducts(current => wasSaved ? [product, ...current] : withoutId(current, product.id));
    }
  };

  const toggleRecipe = async (recipe: RecipeSummary) => {
    if (!recipeSavingAvailable) return;
    const wasSaved = isRecipeSaved(recipe.id);
    setLoadedRecipes(current => {
      const list = current ?? [];
      return wasSaved ? withoutId(list, recipe.id) : [recipe, ...list];
    });
    try {
      await (wasSaved ? api.recipes.unsave(recipe.id) : api.recipes.save(recipe.id));
    } catch {
      setLoadedRecipes(current => {
        const list = current ?? [];
        return wasSaved ? [recipe, ...list] : withoutId(list, recipe.id);
      });
    }
  };

  return {
    savedProducts,
    ownProducts,
    savedRecipes,
    recipeSavingAvailable,
    isProductSaved,
    isRecipeSaved,
    toggleProduct,
    toggleRecipe,
    reload,
  };
}
