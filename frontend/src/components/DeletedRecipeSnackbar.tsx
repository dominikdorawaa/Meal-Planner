import { useCallback, useState } from 'react';
import { t } from '../i18n';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { clearDeletedRecipe, useDeletedRecipe } from '../lib/deletedRecipe';
import { UndoSnackbar } from './UndoSnackbar';

export const RECIPE_UNDO_DURATION_MS = 5000;

export function DeletedRecipeSnackbar() {
  const deleted = useDeletedRecipe();
  const { refreshRecipes } = useAppData();
  const [restoreFailed, setRestoreFailed] = useState(false);

  const close = useCallback(() => clearDeletedRecipe(), []);
  const closeFailure = useCallback(() => setRestoreFailed(false), []);

  const undo = async () => {
    if (!deleted) return;
    clearDeletedRecipe();
    try {
      await api.recipes.restore(deleted.id);
      await refreshRecipes();
    } catch {
      setRestoreFailed(true);
    }
  };

  if (restoreFailed) {
    return <UndoSnackbar message={t('recipeDelete.restoreFailed')} onClose={closeFailure} />;
  }
  if (!deleted) return null;
  return (
    <UndoSnackbar
      key={deleted.id}
      message={t('recipeDelete.deleted', { name: deleted.name })}
      onUndo={undo}
      onClose={close}
      durationMs={RECIPE_UNDO_DURATION_MS}
    />
  );
}
