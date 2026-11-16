import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RECIPES_VIEW_STORAGE_KEY, Recipes } from './Recipes';
import { t } from '../i18n';

const data = vi.hoisted(() => ({
  recipes: [] as unknown[],
  userMeals: [] as unknown[],
  user: null,
  loading: false,
  refreshRecipes: vi.fn(),
}));

const api = vi.hoisted(() => ({
  recipes: { save: vi.fn(), unsave: vi.fn() },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => data,
}));

vi.mock('../lib/apiClient', () => ({ api }));

vi.mock('../components/BottomNav', () => ({
  BottomNav: () => <nav />,
}));

const OATMEAL = { id: 'r1', name: 'Oatmeal', kcal: 412.6, protein: 12.34, fat: 8, carbs: 61, prep_time: 10, own: true, saved: false };
const SALMON = { id: 'r2', name: 'Baked salmon', kcal: 650, protein: 45, fat: 30, carbs: 10, prep_time: 0, own: false, saved: true };
const PASTA = { id: 'r3', name: 'Pasta', kcal: 380, protein: 14, fat: 9, carbs: 55, prep_time: 75, own: false, saved: false };

function renderRecipes(recipes: unknown[] = [OATMEAL, SALMON, PASTA], loading = false) {
  data.recipes = recipes;
  data.loading = loading;
  return render(
    <MemoryRouter initialEntries={['/recipes']}>
      <Routes>
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipe/:id" element={<p>details screen</p>} />
        <Route path="/add-recipe" element={<p>new recipe screen</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function names() {
  return screen.queryAllByRole('listitem').map(item => item.querySelector('.line-clamp-2')?.textContent);
}

function item(name: string) {
  return screen.getAllByRole('listitem').find(entry => entry.textContent?.includes(name)) as HTMLElement;
}

function showAll() {
  fireEvent.click(screen.getByRole('radio', { name: t('recipes.scope.all') }));
}

function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));
}

function showButton(count: number, form: 'one' | 'few' | 'many') {
  return screen.getByRole('button', { name: t(`recipes.filters.show.${form}`, { count }) });
}

function heart(name: string, saved: boolean) {
  return screen.getByRole('button', { name: t(saved ? 'recipes.unsaveNamed' : 'recipes.saveNamed', { name }) });
}

beforeEach(() => {
  data.userMeals = [];
  data.refreshRecipes = vi.fn().mockResolvedValue(undefined);
  api.recipes.save = vi.fn().mockResolvedValue(undefined);
  api.recipes.unsave = vi.fn().mockResolvedValue(undefined);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Recipes list', () => {
  it('shows own and saved recipes by default and every recipe in the all scope', () => {
    renderRecipes();

    expect(names()).toEqual(['Baked salmon', 'Oatmeal']);
    expect(screen.getByText(t('recipes.count.few', { count: 2 }))).toBeTruthy();

    showAll();
    expect(names()).toEqual(['Baked salmon', 'Oatmeal', 'Pasta']);
    expect(screen.getByRole('radio', { name: t('recipes.scope.all') }).getAttribute('aria-checked')).toBe('true');
  });

  it('uses the singular and plural counter forms', () => {
    renderRecipes([OATMEAL]);
    expect(screen.getByText(t('recipes.count.one', { count: 1 }))).toBeTruthy();
    cleanup();

    renderRecipes([1, 2, 3, 4, 5].map(index => ({ ...OATMEAL, id: `r${index}`, name: `Oatmeal ${index}` })));
    expect(screen.getByText(t('recipes.count.many', { count: 5 }))).toBeTruthy();
  });

  it('shows rounded calories and macros in rows', () => {
    renderRecipes();

    const row = within(item('Oatmeal'));
    expect(row.getByText('413')).toBeTruthy();
    expect(item('Oatmeal').textContent).toContain(`${t('plan.summary.proteinShort')} 12`);
    expect(item('Oatmeal').textContent).toContain(`${t('plan.summary.fatShort')} 8`);
    expect(item('Oatmeal').textContent).toContain(`${t('plan.summary.carbsShort')} 61`);
  });

  it('puts recently planned recipes first', () => {
    data.userMeals = [
      { recipe: { id: 'r1' }, created_at: '2026-11-10T10:00:00Z' },
      { recipe: 'r2', created_at: '2026-11-01T10:00:00Z' },
    ];
    renderRecipes();

    expect(names()).toEqual(['Oatmeal', 'Baked salmon']);
  });

  it('changes the sorting from the menu', () => {
    renderRecipes();
    showAll();

    const sortButton = screen.getByRole('button', { name: `${t('recipes.sort.label')}: ${t('recipes.sort.recent')}` });
    fireEvent.click(sortButton);
    expect(sortButton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: t('recipes.sort.kcal') }));
    expect(names()).toEqual(['Pasta', 'Oatmeal', 'Baked salmon']);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `${t('recipes.sort.label')}: ${t('recipes.sort.kcal')}` }));
    expect(screen.getByRole('menuitemradio', { name: t('recipes.sort.kcal') }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: t('recipes.sort.protein') }));
    expect(names()).toEqual(['Baked salmon', 'Pasta', 'Oatmeal']);
  });

  it('closes the sorting menu when tapping outside', () => {
    renderRecipes();

    fireEvent.click(screen.getByRole('button', { name: `${t('recipes.sort.label')}: ${t('recipes.sort.recent')}` }));
    fireEvent.click(document.querySelector('[data-outside-press-layer]') as HTMLElement);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('switches to tiles, remembers the choice and shows calories with time on the photo', () => {
    renderRecipes();

    fireEvent.click(screen.getByRole('button', { name: t('recipes.view.grid') }));
    expect(localStorage.getItem(RECIPES_VIEW_STORAGE_KEY)).toBe('grid');
    expect(within(item('Oatmeal')).getByText(`413 ${t('recipes.kcal')}`)).toBeTruthy();
    expect(within(item('Oatmeal')).getByText(t('recipes.minutes', { count: 10 }))).toBeTruthy();
    expect(within(item('Baked salmon')).queryByText('timer')).toBeNull();
    cleanup();

    renderRecipes();
    expect(screen.getByRole('button', { name: t('recipes.view.list') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.view.list') }));
    expect(localStorage.getItem(RECIPES_VIEW_STORAGE_KEY)).toBe('list');
  });

  it('falls back to the list when storage is unavailable', () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    const blocked = (key: string) => {
      if (key === RECIPES_VIEW_STORAGE_KEY) throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      blocked(key);
      return getItem.call(this, key);
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      blocked(key);
      setItem.call(this, key, value);
    });
    renderRecipes();

    expect(screen.getByRole('button', { name: t('recipes.view.grid') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.view.grid') }));
    expect(screen.getByRole('button', { name: t('recipes.view.list') })).toBeTruthy();
  });

  it('opens a recipe and the new recipe form', () => {
    renderRecipes();

    fireEvent.click(within(item('Oatmeal')).getAllByRole('button')[0]);
    expect(screen.getByText('details screen')).toBeTruthy();
    cleanup();

    renderRecipes();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.new') }));
    expect(screen.getByText('new recipe screen')).toBeTruthy();
  });

  it('opens a recipe from a tile', () => {
    localStorage.setItem(RECIPES_VIEW_STORAGE_KEY, 'grid');
    renderRecipes();

    fireEvent.click(within(item('Oatmeal')).getAllByRole('button')[0]);
    expect(screen.getByText('details screen')).toBeTruthy();
  });

  it('shows a skeleton while recipes load', () => {
    renderRecipes([], true);

    expect(screen.getByRole('status', { name: t('recipes.loading') })).toBeTruthy();
    expect(screen.queryByText(t('recipes.empty.mine'))).toBeNull();
    cleanup();

    localStorage.setItem(RECIPES_VIEW_STORAGE_KEY, 'grid');
    renderRecipes([], true);
    expect(screen.getByRole('status', { name: t('recipes.loading') }).querySelector('.grid')).toBeTruthy();
  });

  it('invites to add a recipe or browse all when there are none of your own', () => {
    renderRecipes([PASTA]);

    expect(screen.getByText(t('recipes.empty.mine'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.empty.browseAll')) }));
    expect(names()).toEqual(['Pasta']);
    cleanup();

    renderRecipes([]);
    showAll();
    expect(screen.getByText(t('recipes.empty.all'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(t('recipes.empty.browseAll')) })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.empty.add')) }));
    expect(screen.getByText('new recipe screen')).toBeTruthy();
  });
});

describe('Saving recipes from the list', () => {
  it('saves a recipe with the heart', async () => {
    renderRecipes();
    showAll();

    fireEvent.click(heart('Pasta', false));

    expect(heart('Pasta', true).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(data.refreshRecipes).toHaveBeenCalled());
    expect(api.recipes.save).toHaveBeenCalledWith('r3');
  });

  it('hides an unsaved recipe from your list and brings it back with undo', async () => {
    renderRecipes();

    fireEvent.click(heart('Baked salmon', true));

    expect(names()).toEqual(['Oatmeal']);
    expect(screen.getByText(t('recipes.unsaved'))).toBeTruthy();
    await waitFor(() => expect(api.recipes.unsave).toHaveBeenCalledWith('r2'));

    fireEvent.click(screen.getByRole('button', { name: t('plan.snackbar.undo') }));
    await waitFor(() => expect(api.recipes.save).toHaveBeenCalledWith('r2'));
    expect(names()).toEqual(['Baked salmon', 'Oatmeal']);
    expect(screen.queryByText(t('recipes.unsaved'))).toBeNull();
  });

  it('keeps your own recipe in the list after unsaving it', async () => {
    renderRecipes([{ ...OATMEAL, saved: true }]);

    fireEvent.click(heart('Oatmeal', true));

    expect(names()).toEqual(['Oatmeal']);
    expect(screen.queryByText(t('recipes.unsaved'))).toBeNull();
    await waitFor(() => expect(api.recipes.unsave).toHaveBeenCalledWith('r1'));
  });

  it('saves from a tile without opening the recipe', async () => {
    localStorage.setItem(RECIPES_VIEW_STORAGE_KEY, 'grid');
    renderRecipes();

    fireEvent.click(heart('Oatmeal', false));

    expect(screen.queryByText('details screen')).toBeNull();
    await waitFor(() => expect(api.recipes.save).toHaveBeenCalledWith('r1'));
  });

  it('restores the heart and explains when saving fails', async () => {
    api.recipes.save = vi.fn().mockRejectedValue(new Error('offline'));
    renderRecipes();
    showAll();

    fireEvent.click(heart('Pasta', false));

    expect(await screen.findByText(t('recipeDetails.savedFailed'))).toBeTruthy();
    expect(heart('Pasta', false).getAttribute('aria-pressed')).toBe('false');
  });

  it('hides the snackbar after its time', () => {
    vi.useFakeTimers();
    try {
      renderRecipes();
      fireEvent.click(heart('Baked salmon', true));
      expect(screen.getByText(t('recipes.unsaved'))).toBeTruthy();

      act(() => { vi.advanceTimersByTime(7000); });
      expect(screen.queryByText(t('recipes.unsaved'))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Recipes search and filters', () => {
  it('searches by name and clears the search', () => {
    renderRecipes();
    showAll();

    expect(screen.getByLabelText(t('recipes.searchPlaceholder')).getAttribute('autocomplete')).toBe('off');
    fireEvent.change(screen.getByLabelText(t('recipes.searchPlaceholder')), { target: { value: 'OAT' } });
    expect(names()).toEqual(['Oatmeal']);

    fireEvent.click(screen.getByRole('button', { name: t('recipes.clearSearch') }));
    expect(names()).toHaveLength(3);
  });

  it('toggles quick presets right on the list', () => {
    renderRecipes();
    showAll();

    const preset = screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.lowfat')) });
    fireEvent.click(preset);
    expect(preset.getAttribute('aria-pressed')).toBe('true');
    expect(names()).toEqual(['Oatmeal', 'Pasta']);

    fireEvent.click(preset);
    expect(names()).toHaveLength(3);
  });

  it('applies sheet filters with a live result count and shows how many are set', () => {
    renderRecipes();
    showAll();
    openFilters();

    expect(screen.getByRole('dialog', { name: t('recipes.filters.title') })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t('recipes.filters.kcal')), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.protein')), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.carbs')), { target: { value: '70' } });
    expect(screen.getByText(t('recipes.filters.upTo', { value: 450 }))).toBeTruthy();
    expect(screen.getByText(t('recipes.filters.atLeastGrams', { value: 10 }))).toBeTruthy();
    expect(screen.getByText(t('recipes.filters.upToGrams', { value: 70 }))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeUpTo', { count: 15 }) }));
    expect(showButton(1, 'one')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeUpTo', { count: 15 }) }));
    fireEvent.click(showButton(2, 'few'));

    expect(names()).toEqual(['Oatmeal', 'Pasta']);
    expect(screen.getByRole('button', { name: t('recipes.filters.openActive', { count: 3 }) }).textContent).toContain('3');
  });

  it('turns sliders back to no limit at their ends and resets without touching presets', () => {
    renderRecipes();
    showAll();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.lowfat')) }));
    openFilters();

    fireEvent.change(screen.getByLabelText(t('recipes.filters.kcal')), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.protein')), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.carbs')), { target: { value: '200' } });
    expect(screen.getAllByText(t('recipes.filters.noLimitShort'))).toHaveLength(2);
    expect(screen.getAllByText(t('recipes.filters.any')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeLong') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.reset') }));
    expect(screen.getByRole('button', { name: t('recipes.filters.prepTimeLong') }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(showButton(2, 'few'));
    expect(names()).toEqual(['Oatmeal', 'Pasta']);
  });

  it('closes the sheet without applying from the close button or outside', () => {
    renderRecipes();
    showAll();
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeLong') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.close') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(names()).toHaveLength(3);

    openFilters();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeLong') }));
    fireEvent.click(screen.getByTestId('recipe-filters-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(names()).toHaveLength(3);
  });

  it('explains empty filter results, lists closest recipes and removes conditions one by one', () => {
    renderRecipes();
    showAll();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.highprotein')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.lowcal')) }));

    expect(screen.getByText(t('recipes.noResults.title'))).toBeTruthy();
    expect(screen.getByText(t('recipes.noResults.filters'))).toBeTruthy();
    const near = within(screen.getByRole('region', { name: t('recipes.near.title') }));
    expect(near.getByText(t('recipes.missing.kcal', { value: 650 }))).toBeTruthy();
    expect(near.getByText(t('recipes.missing.protein', { value: 14 }))).toBeTruthy();

    const label = t('recipes.filters.quick.lowcal');
    fireEvent.click(screen.getByRole('button', { name: t('recipes.noResults.remove', { label }) }));
    expect(names()).toEqual(['Baked salmon']);
  });

  it('explains empty search results without closest recipes and clears everything', () => {
    renderRecipes();
    fireEvent.change(screen.getByLabelText(t('recipes.searchPlaceholder')), { target: { value: 'pizza' } });

    expect(screen.getByText(t('recipes.noResults.search'))).toBeTruthy();
    expect(screen.queryByRole('region', { name: t('recipes.near.title') })).toBeNull();
    expect(screen.queryByText(t('recipes.empty.mine'))).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('recipes.noResults.remove', { label: t('recipes.searchChip', { query: 'pizza' }) }) }));
    expect(names()).toHaveLength(2);

    fireEvent.change(screen.getByLabelText(t('recipes.searchPlaceholder')), { target: { value: 'pizza' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.quick')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.noResults.clearAll')) }));
    expect(names()).toHaveLength(2);
    expect(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.quick')) }).getAttribute('aria-pressed')).toBe('false');
  });
});
