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
    products: { getById: mocks.getProduct, delete: vi.fn() },
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

function renderDetails(pathname: string, search = SEARCH) {
  return render(
    <MemoryRouter initialEntries={[{ pathname, search, state: planSelectionState(SELECTION) }]}>
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
});

describe('adding from item details', () => {
  it('saves the product with its custom portion and all checked items', async () => {
    renderDetails('/product/p1');
    const gramsInput = await screen.findByDisplayValue('100');

    fireEvent.change(gramsInput, { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(addedPayloads()).toEqual([
      { product: { id: 'p1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 250 },
      ...SELECTION_PAYLOADS,
    ]);
  });

  it('does not add checked items when updating an existing product entry', async () => {
    renderDetails('/product/p1', `${SEARCH}&mealId=m1`);
    await screen.findByDisplayValue('150');

    fireEvent.click(screen.getByRole('button', { name: 'Zaktualizuj' }));

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 150 });
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

  it('still returns to the plan when saving checked items fails', async () => {
    mocks.addMeal.mockResolvedValueOnce({}).mockRejectedValue(new Error('Server error (500)'));
    renderDetails('/recipe/r1');
    await screen.findByDisplayValue('1');

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(alertMock).toHaveBeenCalledWith(t('addFood.addSelectedFailed'));
    expect(mocks.refreshMeals).toHaveBeenCalled();
  });
});
