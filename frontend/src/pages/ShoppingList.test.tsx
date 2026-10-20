import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShoppingList } from './ShoppingList';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  addPlanMeals: vi.fn(),
  refreshShoppingList: vi.fn(),
}));

vi.mock('../lib/shoppingFromPlan', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/shoppingFromPlan')>()),
  addPlanMealsToShoppingList: mocks.addPlanMeals,
}));

const MEALS = [
  { id: 'm1', meal_date: '2026-10-17', meal_type: 'breakfast', recipe: { id: 'r1' } },
  { id: 'm2', meal_date: '2026-10-17', meal_type: 'dinner', manual_name: 'Soup' },
];

const APP_DATA = {
  shoppingList: [],
  shoppingListRecipes: [],
  refreshShoppingList: mocks.refreshShoppingList,
  setShoppingList: vi.fn(),
  userMeals: MEALS,
  recipes: [{ id: 'r1', name: 'Omelette' }],
  profile: {
    meal_config: [
      { id: 'breakfast', name: 'Breakfast', icon: 'light_mode', visible: true },
      { id: 'dinner', name: 'Dinner', icon: 'restaurant', visible: true },
    ],
  },
};

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => APP_DATA,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ShoppingList />
    </MemoryRouter>
  );
}

function pickTodayAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: t('shopping.fromPlan') }));
  fireEvent.click(screen.getByRole('checkbox', { name: t('shopping.selectDay', { day: 'Dzisiaj' }) }));
  fireEvent.click(screen.getByRole('button', { name: t('shopping.addIngredients', { count: 2 }) }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 17, 12));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.addPlanMeals.mockReset().mockResolvedValue('added');
  mocks.refreshShoppingList.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ShoppingList create from plan', () => {
  it('adds the chosen plan meals, closes the picker and confirms briefly', async () => {
    renderPage();

    pickTodayAndConfirm();

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.ingredientsAdded')));
    expect(mocks.addPlanMeals).toHaveBeenCalledWith(MEALS);
    expect(mocks.refreshShoppingList).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {});
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['no-recipes', 'shopping.noRecipesSelected'],
    ['no-ingredients', 'shopping.noIngredients'],
  ] as const)('explains in the picker when the result is %s', async (result, message) => {
    mocks.addPlanMeals.mockResolvedValue(result);
    renderPage();

    pickTodayAndConfirm();

    expect(await screen.findByText(t(message))).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mocks.refreshShoppingList).not.toHaveBeenCalled();
  });

  it('keeps the added ingredients and closes the picker when reloading the list fails', async () => {
    mocks.refreshShoppingList.mockRejectedValue(new Error('offline'));
    renderPage();

    pickTodayAndConfirm();

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.addPlanMeals).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error refreshing shopping list:', expect.any(Error)));
  });

  it('shows an error when saving fails and lets the user close the picker', async () => {
    mocks.addPlanMeals.mockRejectedValue(new Error('offline'));
    renderPage();

    pickTodayAndConfirm();

    expect(await screen.findByText(t('shopping.fromPlanFailed'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('shopping.cancel') }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.fromPlan') }));
    expect(screen.queryByText(t('shopping.fromPlanFailed'))).toBeNull();
  });

  it('points to both ways of filling an empty list', () => {
    renderPage();

    expect(screen.getByText(t('shopping.emptyHint'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('shopping.addProduct') })).toBeTruthy();
  });
});

describe('ShoppingList add product form', () => {
  it('turns off autofill suggestions and limits the amount', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('shopping.addProduct')) }));

    expect(screen.getByPlaceholderText('np. Mleko 2%').getAttribute('autocomplete')).toBe('off');
    expect(screen.getByPlaceholderText('szt').getAttribute('autocomplete')).toBe('off');
    const amount = screen.getByLabelText('Ilość') as HTMLInputElement;
    expect(amount.getAttribute('autocomplete')).toBe('off');
    fireEvent.change(amount, { target: { value: '2,5' } });
    expect(amount.value).toBe('2,5');
    fireEvent.change(amount, { target: { value: '5001' } });
    expect(amount.value).toBe('2,5');
    expect(document.querySelector('[data-scroll-lock]')).not.toBeNull();
  });
});
