import { useCallback, useEffect, useState } from 'react';
import { api, type Product, type RecipeSummary } from './apiClient';

export interface SavedFood {
  savedProducts: Product[];
  ownProducts: Product[];
  savedRecipes: RecipeSummary[];
  reload: () => Promise<void>;
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

  const savedRecipes = loadedRecipes ?? fallbackRecipes.filter(recipe => recipe.saved === true);

  return {
    savedProducts,
    ownProducts,
    savedRecipes,
    reload,
  };
}
