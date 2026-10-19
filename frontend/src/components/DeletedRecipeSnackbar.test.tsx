import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeletedRecipeSnackbar, RECIPE_UNDO_DURATION_MS } from './DeletedRecipeSnackbar';
import { announceDeletedRecipe, clearDeletedRecipe } from '../lib/deletedRecipe';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  restore: vi.fn(),
  refreshRecipes: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({
  api: { recipes: { restore: mocks.restore } },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({ refreshRecipes: mocks.refreshRecipes }),
}));

beforeEach(() => {
  mocks.restore.mockResolvedValue({});
  mocks.refreshRecipes.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => clearDeletedRecipe());
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('DeletedRecipeSnackbar', () => {
  it('shows nothing until a recipe is deleted', () => {
    render(<DeletedRecipeSnackbar />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('restores the deleted recipe when undo is pressed', async () => {
    render(<DeletedRecipeSnackbar />);

    act(() => announceDeletedRecipe({ id: 'r1', name: 'Owsianka' }));
    expect(screen.getByRole('status').textContent).toContain(t('recipeDelete.deleted', { name: 'Owsianka' }));
    fireEvent.click(screen.getByRole('button', { name: t('plan.snackbar.undo') }));

    await waitFor(() => expect(mocks.refreshRecipes).toHaveBeenCalled());
    expect(mocks.restore).toHaveBeenCalledWith('r1');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells when the recipe cannot be restored', async () => {
    mocks.restore.mockRejectedValue(new Error('Server error'));
    render(<DeletedRecipeSnackbar />);

    act(() => announceDeletedRecipe({ id: 'r1', name: 'Owsianka' }));
    fireEvent.click(screen.getByRole('button', { name: t('plan.snackbar.undo') }));

    expect(await screen.findByText(t('recipeDelete.restoreFailed'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('plan.snackbar.undo') })).toBeNull();
    expect(mocks.refreshRecipes).not.toHaveBeenCalled();
  });

  it('hides the undo after five seconds', () => {
    vi.useFakeTimers();
    render(<DeletedRecipeSnackbar />);

    act(() => announceDeletedRecipe({ id: 'r1', name: 'Owsianka' }));
    act(() => { vi.advanceTimersByTime(RECIPE_UNDO_DURATION_MS); });

    expect(screen.queryByRole('status')).toBeNull();
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
