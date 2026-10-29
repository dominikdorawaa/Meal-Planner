import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetails } from './ProductDetails';
import { RecipeDetails } from './RecipeDetails';
import { planSelectionState } from '../lib/planSelection';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  addMeal: vi.fn(),
  updateMeal: vi.fn(),
  getAllMeals: vi.fn(),
  getProduct: vi.fn(),
  getRecipe: vi.fn(),
  refreshMeals: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    meals: { add: mocks.addMeal, update: mocks.updateMeal, getAll: mocks.getAllMeals },
    products: { getById: mocks.getProduct, delete: vi.fn(), saved: vi.fn().mockResolvedValue([]) },
    recipes: { getById: mocks.getRecipe, archive: vi.fn() },
  },
}));

const recipes: unknown[] = [];
const alertMock = vi.fn();

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    user: { userId: 'user-1' },
    recipes,
    profile: null,
    refreshMeals: mocks.refreshMeals,
    refreshRecipes: vi.fn(),
    getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
  }),
}));

const SEARCH = '?selectDate=2026-10-17&selectType=lunch';
const SELECTION = [{ kind: 'recipe' as const, id: 'r9' }, { kind: 'product' as const, id: 'p9' }];
const SELECTION_PAYLOADS = [
  { recipe: { id: 'r9' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 1 },
  { product: { id: 'p9' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 100 },
];

function renderDetails(pathname: string, search = SEARCH, items = SELECTION) {
  return render(
    <MemoryRouter initialEntries={[{ pathname, search, state: planSelectionState({ id: 's1', items }) }]}>
      <Routes>
        <Route path="/" element={<p>plan screen</p>} />
        <Route path="/recipe/:id" element={<RecipeDetails />} />
        <Route path="/product/:id" element={<ProductDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

function addedPayloads() {
  return mocks.addMeal.mock.calls.map(call => call[0]);
}

beforeEach(() => {
  vi.stubGlobal('alert', alertMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.addMeal.mockResolvedValue({});
  mocks.updateMeal.mockResolvedValue({});
  mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 150 }]);
  mocks.refreshMeals.mockResolvedValue(undefined);
  mocks.getProduct.mockResolvedValue({ id: 'p1', name: 'Jogurt', kcal: 60, protein: 4, fat: 3, carbs: 5 });
  mocks.getRecipe.mockResolvedValue({
    id: 'r1',
    name: 'Owsianka',
    kcal: 350,
    protein: 12,
    fat: 8,
    carbs: 55,
    portions: 2,
    ingredients: [{ id: 'i1', name: 'Płatki', amount: 200, unit: 'g' }],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('adding from item details', () => {
  it('saves the product with its custom portion and all checked items', async () => {
    renderDetails('/product/p1');
    const gramsInput = await screen.findByDisplayValue('100');

    fireEvent.change(gramsInput, { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(addedPayloads()).toEqual([
      { product: { id: 'p1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 250, measure_code: null, measure_amount: null },
      ...SELECTION_PAYLOADS,
    ]);
  });

  it('does not add checked items when updating an existing product entry', async () => {
    renderDetails('/product/p1', `${SEARCH}&mealId=m1`);
    const grams = await screen.findByDisplayValue('150');

    fireEvent.change(grams, { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zaktualizuj' }));

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 180, measure_code: null, measure_amount: null });
    expect(mocks.addMeal).not.toHaveBeenCalled();
  });

  it('saves the recipe with its custom portion and all checked items', async () => {
    renderDetails('/recipe/r1');
    const portionsInput = await screen.findByDisplayValue('1');

    fireEvent.change(portionsInput, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(addedPayloads()).toEqual([
      { recipe: { id: 'r1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 2 },
      ...SELECTION_PAYLOADS,
    ]);
  });

  it('does not save the opened item twice when it is also checked', async () => {
    renderDetails('/product/p1', SEARCH, [...SELECTION, { kind: 'product', id: 'p1' }]);
    await screen.findByDisplayValue('100');

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(addedPayloads()).toEqual([
      { product: { id: 'p1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 100, measure_code: null, measure_amount: null },
      ...SELECTION_PAYLOADS,
    ]);
  });

  it('returns to the plan without saving the product again when checked items fail', async () => {
    mocks.addMeal.mockResolvedValueOnce({}).mockRejectedValue(new Error('Server error (500)'));
    renderDetails('/product/p1');
    await screen.findByDisplayValue('100');

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(alertMock).toHaveBeenCalledWith(t('planSelection.notAllSaved'));
    expect(mocks.addMeal).toHaveBeenCalledTimes(2);
  });

  it('still returns to the plan when saving checked items fails', async () => {
    mocks.addMeal.mockResolvedValueOnce({}).mockRejectedValue(new Error('Server error (500)'));
    renderDetails('/recipe/r1');
    await screen.findByDisplayValue('1');

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(alertMock).toHaveBeenCalledWith(t('planSelection.notAllSaved'));
    expect(mocks.refreshMeals).toHaveBeenCalled();
  });
});

describe('meal and day in item details', () => {
  it.each(['/product/p1', '/recipe/r1'])('lets the user pick them when adding from %s', async (pathname) => {
    renderDetails(pathname);
    const mealButton = await screen.findByRole('button', { name: /Dodajesz do: Lunch/ }) as HTMLButtonElement;

    expect(mealButton.disabled).toBe(false);
    fireEvent.click(mealButton);

    expect(screen.getByRole('button', { name: /^Śniadanie/ })).toBeTruthy();
  });

  it.each(['/product/p1', '/recipe/r1'])('shows them only as information when editing from %s', async (pathname) => {
    renderDetails(pathname, `${SEARCH}&mealId=m1`);
    const mealButton = await screen.findByRole('button', { name: /Edytujesz w: Lunch/ }) as HTMLButtonElement;
    const dayButton = screen.getByRole('button', { name: /17 października/ }) as HTMLButtonElement;

    expect(mealButton.disabled).toBe(true);
    expect(dayButton.disabled).toBe(true);
    expect(mealButton.textContent).not.toContain('expand_more');
    expect(dayButton.textContent).not.toContain('expand_more');

    fireEvent.click(mealButton);
    fireEvent.click(dayButton);

    expect(screen.queryByRole('button', { name: /^Śniadanie/ })).toBeNull();
    expect(screen.queryByText('chevron_left')).toBeNull();
  });
});
