import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Recipes } from './Recipes';
import { t } from '../i18n';

const data = vi.hoisted(() => ({ recipes: [] as unknown[], loading: false }));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => data,
}));

vi.mock('../components/BottomNav', () => ({
  BottomNav: () => <nav />,
}));

const OATMEAL = { id: 'r1', name: 'Owsianka', kcal: 412.6, protein: 12.34, fat: 8, carbs: 61, prep_time: 10, own: true, saved: false };
const SALMON = { id: 'r2', name: 'Łosoś z piekarnika', kcal: 650, protein: 45, fat: 30, carbs: 10, prep_time: 0, own: false, saved: true };
const PASTA = { id: 'r3', name: 'Makaron', kcal: 380, protein: 14, fat: 9, carbs: 55, prep_time: 75, own: false, saved: false };

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
  return screen.queryAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
}

function card(name: string) {
  return screen.getByRole('heading', { level: 3, name }).parentElement!.parentElement as HTMLElement;
}

function applyFilters() {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.apply')) }));
}

afterEach(() => {
  cleanup();
});

describe('Recipes list', () => {
  it('lists recipes alphabetically with the counter in the right plural form', () => {
    renderRecipes();

    expect(names()).toEqual(['Łosoś z piekarnika', 'Makaron', 'Owsianka']);
    expect(screen.getByText(t('recipes.count.few', { count: 3 }))).toBeTruthy();
  });

  it('uses the singular form for one recipe', () => {
    renderRecipes([PASTA]);

    expect(screen.getByText(t('recipes.count.one', { count: 1 }))).toBeTruthy();
  });

  it('uses the plural form for five and more recipes', () => {
    renderRecipes([1, 2, 3, 4, 5].map(index => ({ ...PASTA, id: `r${index}`, name: `Makaron ${index}` })));

    expect(screen.getByText(t('recipes.count.many', { count: 5 }))).toBeTruthy();
  });

  it('rounds the nutrition on the cards and hides an empty preparation time', () => {
    renderRecipes();

    const oatmeal = within(card('Owsianka'));
    expect(oatmeal.getByText('413 kcal')).toBeTruthy();
    expect(oatmeal.getByText(t('recipes.macro.protein', { value: 12.3 }))).toBeTruthy();
    expect(oatmeal.getByText(t('recipes.minutes', { count: 10 }))).toBeTruthy();

    const salmon = within(card('Łosoś z piekarnika'));
    expect(salmon.queryByText('0')).toBeNull();
    expect(salmon.queryByText(t('recipes.minutes', { count: 0 }))).toBeNull();
  });

  it('marks saved recipes', () => {
    renderRecipes();

    expect(within(card('Łosoś z piekarnika')).getByLabelText(t('recipes.savedBadge'))).toBeTruthy();
    expect(within(card('Makaron')).queryByLabelText(t('recipes.savedBadge'))).toBeNull();
  });

  it('opens a recipe and the new recipe form', () => {
    renderRecipes();

    fireEvent.click(card('Makaron'));
    expect(screen.getByText('details screen')).toBeTruthy();
  });

  it('opens the new recipe form from the header', () => {
    renderRecipes();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.new')) }));
    expect(screen.getByText('new recipe screen')).toBeTruthy();
  });

  it('shows a loader while recipes load', () => {
    renderRecipes([], true);

    expect(screen.getByText(t('recipes.loading'))).toBeTruthy();
    expect(screen.queryByText(t('recipes.empty.title'))).toBeNull();
  });

  it('invites to add the first recipe when there are none', () => {
    renderRecipes([]);

    expect(screen.getByText(t('recipes.empty.title'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.empty.add')) }));
    expect(screen.getByText('new recipe screen')).toBeTruthy();
  });
});

describe('Recipes search and filters', () => {
  it('searches by name and clears the search', () => {
    renderRecipes();

    fireEvent.change(screen.getByLabelText(t('recipes.searchPlaceholder')), { target: { value: 'OWS' } });
    expect(names()).toEqual(['Owsianka']);
    expect(screen.getByText(t('recipes.countFor', { query: 'OWS' }))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('recipes.clearSearch') }));
    expect(names()).toHaveLength(3);
  });

  it('shows an empty result and resets everything with one button', () => {
    renderRecipes();

    fireEvent.change(screen.getByLabelText(t('recipes.searchPlaceholder')), { target: { value: 'pizza' } });
    expect(screen.getByText(t('recipes.empty.noResults'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(t('recipes.empty.add')) })).toBeNull();

    fireEvent.click(screen.getByText(t('recipes.clearAll')).closest('button')!);
    expect(names()).toHaveLength(3);
  });

  it('combines quick filters', () => {
    renderRecipes();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.highprotein')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.lowcarb')) }));
    applyFilters();

    expect(names()).toEqual(['Łosoś z piekarnika']);
    expect(screen.getByRole('button', { name: t('recipes.filters.open') }).textContent).toContain('2');
  });

  it.each([
    ['quick', ['Owsianka']],
    ['lowcal', ['Makaron']],
    ['lowfat', ['Makaron', 'Owsianka']],
  ])('filters with the %s preset', (preset, expected) => {
    renderRecipes();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t(`recipes.filters.quick.${preset}` as Parameters<typeof t>[0])) }));
    applyFilters();

    expect(names()).toEqual(expected);
  });

  it('filters with sliders and preparation time and resets the panel', () => {
    renderRecipes();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));

    fireEvent.change(screen.getByLabelText(t('recipes.filters.kcal')), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.protein')), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.carbs')), { target: { value: '60' } });
    expect(screen.getByText(t('recipes.filters.upTo', { value: 450 }))).toBeTruthy();
    expect(screen.getByText(t('recipes.filters.atLeastGrams', { value: 10 }))).toBeTruthy();
    expect(screen.getByText(t('recipes.filters.upToGrams', { value: 60 }))).toBeTruthy();
    applyFilters();
    expect(names()).toEqual(['Makaron']);

    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.reset')) }));
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeLong') }));
    applyFilters();
    expect(names()).toEqual(['Makaron']);

    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeLong') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.prepTimeUpTo', { count: 15 }) }));
    applyFilters();
    expect(names()).toEqual(['Łosoś z piekarnika', 'Owsianka']);
  });

  it('turns sliders back to no limit at their ends', () => {
    renderRecipes();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));

    fireEvent.change(screen.getByLabelText(t('recipes.filters.kcal')), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.protein')), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(t('recipes.filters.carbs')), { target: { value: '200' } });

    expect(screen.getByText(t('recipes.filters.any'))).toBeTruthy();
    applyFilters();
    expect(names()).toHaveLength(3);
  });

  it('closes the filters without applying them when tapping outside', () => {
    renderRecipes();
    fireEvent.click(screen.getByRole('button', { name: t('recipes.filters.open') }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipes.filters.quick.lowcal')) }));

    fireEvent.click(screen.getByText(t('recipes.filters.title')).closest('.fixed') as HTMLElement);

    expect(screen.queryByText(t('recipes.filters.title'))).toBeNull();
    expect(names()).toHaveLength(3);
  });
});
