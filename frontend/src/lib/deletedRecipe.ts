import { useSyncExternalStore } from 'react';

export interface DeletedRecipe {
  id: string;
  name: string;
}

let deletedRecipe: DeletedRecipe | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function announceDeletedRecipe(recipe: DeletedRecipe) {
  deletedRecipe = recipe;
  emit();
}

export function clearDeletedRecipe() {
  deletedRecipe = null;
  emit();
}

export function useDeletedRecipe(): DeletedRecipe | null {
  return useSyncExternalStore(subscribe, () => deletedRecipe);
}
