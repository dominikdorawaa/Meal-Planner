import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHOPPING_GROUPED_STORAGE_KEY, ShoppingList } from './ShoppingList';
import { t } from '../i18n';
import { api } from '../lib/apiClient';
import { measure, withMeasures } from '../lib/measureFixtures';

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
  shoppingList: [] as unknown[],
  shoppingListRecipes: [] as unknown[],
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
    <MemoryRouter initialEntries={['/cart']}>
      <Routes>
        <Route path="/cart" element={<ShoppingList />} />
        <Route path="/recipe/:id" element={<p>Recipe page</p>} />
      </Routes>
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
  vi.spyOn(api.shoppingList, 'getDepartments').mockResolvedValue({ custom: [], assignments: [] });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  APP_DATA.shoppingListRecipes = [];
  APP_DATA.shoppingList = [];
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
    fireEvent.click(screen.getByRole('button', { name: t('shopping.close') }));
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

    expect(screen.getByLabelText(t('shopping.name')).getAttribute('autocomplete')).toBe('off');
    expect(screen.getByLabelText(t('shopping.unit')).getAttribute('autocomplete')).toBe('off');
    const amount = screen.getByLabelText(t('shopping.quantity')) as HTMLInputElement;
    expect(amount.getAttribute('autocomplete')).toBe('off');
    fireEvent.change(amount, { target: { value: '2,5' } });
    expect(amount.value).toBe('2,5');
    fireEvent.change(amount, { target: { value: '5001' } });
    expect(amount.value).toBe('2,5');
    expect(document.querySelector('[data-scroll-lock]')).not.toBeNull();
  });
});

describe('ShoppingList by recipes', () => {
  it('shows the total amount of kitchen measures in the base unit', () => {
    APP_DATA.shoppingList = [{ id: 's1', ingredient_name: 'Olej', quantity: 2, unit: 'łyżki', is_checked: false }];
    const oil = withMeasures({ unit: '100ml' }, measure('tbsp', 15));
    APP_DATA.shoppingListRecipes = [{
      id: 'r1', name: 'Omelette', portions: 2,
      ingredients: [
        { name: 'Olej', amount: 1, unit: 'tbsp', product: oil },
        { name: 'Mleko', amount: 100, unit: 'ml', product: oil },
      ],
    }];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.viewRecipes') }));

    expect(screen.getByText('2 łyżki (30 ml)')).toBeTruthy();
    expect(screen.getByText('200 ml')).toBeTruthy();
  });
});

describe('ShoppingList clearing', () => {
  it('asks before clearing the whole list and keeps it when cancelled', async () => {
    const clearAll = vi.spyOn(api.shoppingList, 'clearAll').mockResolvedValue(undefined as never);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.clearConfirm') }));
    const sheet = within(screen.getByRole('alertdialog', { name: t('shopping.clearQuestion') }));
    expect(sheet.getByText(t('shopping.clearText'))).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: t('common.cancel') }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(clearAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.clearConfirm') }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t('shopping.clearConfirm') }));

    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalled());
    expect(clearAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

const ITEMS = [
  { id: 's1', ingredient_name: 'Ziemniaki', quantity: 500.4, unit: 'g', is_checked: false },
  { id: 's2', ingredient_name: 'Banan', quantity: 1.255, unit: 'szt', is_checked: true },
  { id: 's3', ingredient_name: 'Papier', quantity: 1, unit: 'szt', is_checked: false },
];

describe('ShoppingList products', () => {
  beforeEach(() => {
    APP_DATA.shoppingList = ITEMS;
  });

  it('shows the tab title, the progress and the products grouped by department', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: t('nav.shopping') })).toBeTruthy();
    expect(screen.getByText(t('shopping.progress', { done: 1, total: 3 }))).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('shopping.category.produce') })).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('shopping.category.other') })).toBeTruthy();
    expect(screen.getByText('500 g')).toBeTruthy();
    expect(screen.getByText('1.25 szt')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Banan/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('turns the departments off and on and remembers the choice', () => {
    const { unmount } = renderPage();
    const toggle = () => screen.getByRole('button', { name: t('shopping.groupByCategory') });

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle());

    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('heading', { name: t('shopping.category.produce') })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(localStorage.getItem(SHOPPING_GROUPED_STORAGE_KEY)).toBe('0');

    unmount();
    renderPage();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOPPING_GROUPED_STORAGE_KEY)).toBe('1');
    expect(screen.getByRole('heading', { name: t('shopping.category.produce') })).toBeTruthy();
  });

  it('marks a product as bought and reloads the list even when saving fails', async () => {
    const toggleItem = vi.spyOn(api.shoppingList, 'toggleItem').mockResolvedValueOnce(undefined as never).mockRejectedValueOnce(new Error('offline'));
    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: /Ziemniaki/ }));
    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalledTimes(1));
    expect(toggleItem).toHaveBeenCalledWith('s1', true);

    fireEvent.click(screen.getByRole('checkbox', { name: /Banan/ }));
    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalledTimes(2));
    expect(toggleItem).toHaveBeenLastCalledWith('s2', false);
  });

  it('removes a single product and puts it back on undo', async () => {
    const deleteItem = vi.spyOn(api.shoppingList, 'deleteItem').mockResolvedValue(undefined as never);
    const addItem = vi.spyOn(api.shoppingList, 'addItem').mockResolvedValue({} as never);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Banan' }) }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.itemRemoved')));
    expect(deleteItem).toHaveBeenCalledWith('s2');
    expect(APP_DATA.setShoppingList).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: t('plan.snackbar.undo') }));

    await waitFor(() => expect(addItem).toHaveBeenCalledWith({ ingredient_name: 'Banan', quantity: 1.255, unit: 'szt', is_checked: true }));
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalledTimes(2));
  });

  it('says when a product could not be removed or restored', async () => {
    const deleteItem = vi.spyOn(api.shoppingList, 'deleteItem').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined as never);
    vi.spyOn(api.shoppingList, 'addItem').mockRejectedValue(new Error('offline'));
    mocks.refreshShoppingList.mockRejectedValue(new Error('offline'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Papier' }) }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.removeFailed')));
    expect(screen.queryByRole('button', { name: t('plan.snackbar.undo') })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Papier' }) }));
    await waitFor(() => expect(deleteItem).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: t('plan.snackbar.undo') }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.addFailed')));
  });

  it('reloads the list when clearing fails', async () => {
    vi.spyOn(api.shoppingList, 'clearAll').mockRejectedValue(new Error('offline'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.clearConfirm') }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t('shopping.clearConfirm') }));

    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalled());
    expect(console.error).toHaveBeenCalledWith('Error clearing list:', expect.any(Error));
  });
});

describe('ShoppingList recipes view', () => {
  it('lists recipe ingredients, ticks the ones on the list and opens the recipe', async () => {
    const toggleItem = vi.spyOn(api.shoppingList, 'toggleItem').mockResolvedValue(undefined as never);
    APP_DATA.shoppingList = ITEMS;
    APP_DATA.shoppingListRecipes = [
      { id: 'r1', name: 'Omelette', kcal: 610.4, portions: 2, ingredients: [{ name: 'ziemniaki', amount: 250, unit: 'g' }, { name: 'Sól', amount: 1, unit: 'g' }] },
      { recipe: { id: 'r2', name: 'Soup' }, portions: 1, ingredients: [] },
    ];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.viewRecipes') }));

    expect(screen.queryByRole('button', { name: t('shopping.groupByCategory') })).toBeNull();
    expect(screen.getByText(`${t('shopping.portions.few', { count: 2 })}, 610 kcal`)).toBeTruthy();
    expect(screen.getByText(`${t('shopping.portions.one', { count: 1 })}, 0 kcal`)).toBeTruthy();
    expect(screen.getByText(t('shopping.noRecipeIngredients'))).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Sól/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: t('shopping.removeItem', { name: 'ziemniaki' }) })).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /ziemniaki/ }));
    await waitFor(() => expect(toggleItem).toHaveBeenCalledWith('s1', true));

    fireEvent.click(screen.getByRole('button', { name: /Soup/ }));
    expect(screen.getByText('Recipe page')).toBeTruthy();
  });

  it('says when no recipes are linked to the list', () => {
    APP_DATA.shoppingList = ITEMS;
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.viewRecipes') }));

    expect(screen.getByText(t('shopping.noSourceRecipes'))).toBeTruthy();
  });
});

describe('ShoppingList departments', () => {
  const PET = { id: 'd1', name: 'Dla psa' };
  const groupNames = () => screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent);
  const openMove = (name: string) => fireEvent.click(screen.getByRole('button', { name: t('shopping.moveItem', { name }) }));
  const sheet = () => within(screen.getByRole('dialog'));

  beforeEach(() => {
    APP_DATA.shoppingList = ITEMS;
  });

  it('groups products by the remembered departments, including own ones', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'papier', department: 'd1' }, { product_name: 'banan', department: 'gone' }],
    });
    renderPage();

    await waitFor(() => expect(groupNames()).toEqual([t('shopping.category.produce'), 'Dla psa']));
  });

  it('moves a product to another department and remembers it', async () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment').mockResolvedValue({
      custom: [],
      assignments: [{ product_name: 'papier', department: 'bakery' }],
    });
    renderPage();

    openMove('Papier');
    expect(sheet().getByRole('button', { name: t('shopping.category.other') }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.bakery') }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.bakery')]);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.moved', { department: t('shopping.category.bakery') })));
    expect(assign).toHaveBeenCalledWith({ product_name: 'Papier', department: 'bakery' });
  });

  it('only closes the sheet when the current department is picked', () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment');
    renderPage();

    openMove('Papier');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.other') }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('creates an own department or reuses one with the same name', async () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment').mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'papier', department: 'd1' }],
    });
    renderPage();

    openMove('Papier');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartment') }));
    fireEvent.change(sheet().getByLabelText(t('shopping.newDepartmentName')), { target: { value: 'Dla psa' } });
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartmentAdd') }));

    await waitFor(() => expect(groupNames()).toContain('Dla psa'));
    expect(assign).toHaveBeenCalledWith({ product_name: 'Papier', new_department_name: 'Dla psa' });

    openMove('Ziemniaki');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartment') }));
    fireEvent.change(sheet().getByLabelText(t('shopping.newDepartmentName')), { target: { value: ' dla PSA ' } });
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartmentAdd') }));

    await waitFor(() => expect(assign).toHaveBeenLastCalledWith({ product_name: 'Ziemniaki', department: 'd1' }));
  });

  it('puts the product back when moving fails', async () => {
    vi.spyOn(api.shoppingList, 'assignDepartment').mockRejectedValue(new Error('offline'));
    renderPage();

    openMove('Papier');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.dairy') }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.moveFailed')));
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.other')]);
  });

  it('keeps the guessed departments when loading the remembered ones fails', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockRejectedValue(new Error('offline'));
    renderPage();

    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error loading shopping departments:', expect.any(Error)));
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.other')]);
  });

  it('closes the sheet from the close button', () => {
    renderPage();

    openMove('Papier');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.close') }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
