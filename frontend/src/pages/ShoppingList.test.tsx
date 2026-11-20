import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHOPPING_GROUPED_STORAGE_KEY, ShoppingList } from './ShoppingList';
import { DEPARTMENT_DELETE_DELAY_MS } from '../lib/useShoppingDepartments';
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
  useAppData: () => {
    const [list, setList] = useState(() => APP_DATA.shoppingList);
    APP_DATA.setShoppingList = vi.fn((updater: unknown) => {
      setList(previous => {
        const next = typeof updater === 'function' ? (updater as (items: unknown[]) => unknown[])(previous) : (updater as unknown[]);
        APP_DATA.shoppingList = next;
        return next;
      });
    });
    return {
      ...APP_DATA,
      shoppingList: list,
    };
  },
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
  it('asks only for the product name', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('shopping.addProduct')) }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getAllByRole('textbox')).toEqual([dialog.getByLabelText(t('shopping.name'))]);
    expect(document.querySelector('[data-scroll-lock]')).not.toBeNull();
  });
});

describe('ShoppingList by recipes', () => {
  it('shows the total amount of kitchen measures in the base unit', () => {
    APP_DATA.shoppingList = [{ id: 's1', ingredient_name: 'Olive oil', quantity: 2, unit: 'tbsp', is_checked: false }];
    const oil = withMeasures({ unit: '100ml' }, measure('tbsp', 15));
    APP_DATA.shoppingListRecipes = [{
      id: 'r1', name: 'Omelette', portions: 2,
      ingredients: [
        { name: 'Olive oil', amount: 1, unit: 'tbsp', product: oil },
        { name: 'Milk', amount: 100, unit: 'ml', product: oil },
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
  { id: 's1', ingredient_name: 'Paper towels', quantity: 1, unit: 'pcs', is_checked: false },
  { id: 's2', ingredient_name: 'Quinoa', quantity: 500.4, unit: 'g', is_checked: false },
  { id: 's3', ingredient_name: 'Banana', quantity: 1.255, unit: 'pcs', is_checked: true },
];

describe('ShoppingList without device storage', () => {
  it('still groups by department and switches grouping when storage is blocked', () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === SHOPPING_GROUPED_STORAGE_KEY) throw new Error('blocked');
      return getItem.call(this, key);
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === SHOPPING_GROUPED_STORAGE_KEY) throw new Error('blocked');
      setItem.call(this, key, value);
    });
    APP_DATA.shoppingList = ITEMS;
    renderPage();
    const toggle = () => screen.getByRole('button', { name: t('shopping.groupByCategory') });

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });
});

describe('ShoppingList products', () => {
  beforeEach(() => {
    APP_DATA.shoppingList = ITEMS;
  });

  it('shows the tab title and the products grouped by department', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: t('nav.shopping') })).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('shopping.category.produce') })).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('shopping.category.grains') })).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('shopping.category.other') })).toBeTruthy();
    expect(screen.getByText('500 g')).toBeTruthy();
    expect(screen.getByText('1.25 pcs')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Banana/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('shows a product added by name alone without an amount', () => {
    APP_DATA.shoppingList = [{ id: 's4', ingredient_name: '2 kg potatoes', quantity: null, unit: null, is_checked: false }];
    renderPage();

    const row = screen.getByRole('button', { name: t('shopping.moveItem', { name: '2 kg potatoes' }) });
    expect(row.textContent).toBe('2 kg potatoes');
  });

  it('shows an amount without a unit', () => {
    APP_DATA.shoppingList = [{ id: 's5', ingredient_name: 'Lemons', quantity: 3, unit: null, is_checked: false }];
    renderPage();

    expect(screen.getByRole('button', { name: t('shopping.moveItem', { name: 'Lemons' }) }).textContent).toBe('Lemons3');
  });

  it('turns the departments off to keep server order and remembers the choice', () => {
    const { unmount } = renderPage();
    const toggle = () => screen.getByRole('button', { name: t('shopping.groupByCategory') });
    const removeLabels = () =>
      screen
        .getAllByRole('button', { name: new RegExp(`^${t('shopping.removeItem', { name: '' })}`) })
        .map(button => button.getAttribute('aria-label'));

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(removeLabels()).toEqual([
      t('shopping.removeItem', { name: 'Banana' }),
      t('shopping.removeItem', { name: 'Quinoa' }),
      t('shopping.removeItem', { name: 'Paper towels' }),
    ]);
    fireEvent.click(toggle());

    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('heading', { name: t('shopping.category.produce') })).toBeNull();
    expect(removeLabels()).toEqual([
      t('shopping.removeItem', { name: 'Paper towels' }),
      t('shopping.removeItem', { name: 'Quinoa' }),
      t('shopping.removeItem', { name: 'Banana' }),
    ]);
    expect(localStorage.getItem(SHOPPING_GROUPED_STORAGE_KEY)).toBe('0');

    unmount();
    renderPage();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOPPING_GROUPED_STORAGE_KEY)).toBe('1');
    expect(screen.getByRole('heading', { name: t('shopping.category.produce') })).toBeTruthy();
  });

  it('marks products as bought, deduplicates overlapping refreshes and rolls back when saving fails', async () => {
    let finishFirst!: () => void;
    const toggleItem = vi.spyOn(api.shoppingList, 'toggleItem')
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = () => resolve(undefined as never); }))
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('offline'));
    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: /Quinoa/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Paper towels/ }));
    finishFirst();

    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalledTimes(1));
    expect(toggleItem).toHaveBeenNthCalledWith(1, 's2', true);
    expect(toggleItem).toHaveBeenNthCalledWith(2, 's1', true);

    fireEvent.click(screen.getByRole('checkbox', { name: /Banana/ }));
    await waitFor(() => expect((screen.getByRole('checkbox', { name: /Banana/ }) as HTMLInputElement).checked).toBe(true));
    expect(toggleItem).toHaveBeenLastCalledWith('s3', false);
    expect(mocks.refreshShoppingList).toHaveBeenCalledTimes(1);
  });

  it('removes a single product and puts it back on undo', async () => {
    const deleteItem = vi.spyOn(api.shoppingList, 'deleteItem').mockResolvedValue(undefined as never);
    const addItem = vi.spyOn(api.shoppingList, 'addItem').mockResolvedValue({} as never);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Banana' }) }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.itemRemoved')));
    expect(deleteItem).toHaveBeenCalledWith('s3');
    expect(screen.queryByRole('checkbox', { name: /Banana/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('plan.snackbar.undo') }));

    await waitFor(() => expect(addItem).toHaveBeenCalledWith({ ingredient_name: 'Banana', quantity: 1.255, unit: 'pcs', is_checked: true }));
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(mocks.refreshShoppingList).toHaveBeenCalledTimes(2));
  });

  it('restores the item when removal fails and explains when undo fails', async () => {
    const deleteItem = vi.spyOn(api.shoppingList, 'deleteItem').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined as never);
    vi.spyOn(api.shoppingList, 'addItem').mockRejectedValue(new Error('offline'));
    mocks.refreshShoppingList.mockRejectedValue(new Error('offline'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Paper towels' }) }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.removeFailed')));
    expect(screen.getByRole('checkbox', { name: /Paper towels/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('plan.snackbar.undo') })).toBeNull();
    expect(mocks.refreshShoppingList).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Paper towels' }) }));
    await waitFor(() => expect(deleteItem).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: t('plan.snackbar.undo') }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.addFailed')));
  });

  it('dismisses an open undo snackbar when clearing and restores the list when clearing fails', async () => {
    vi.spyOn(api.shoppingList, 'deleteItem').mockResolvedValue(undefined as never);
    vi.spyOn(api.shoppingList, 'clearAll').mockRejectedValue(new Error('offline'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.removeItem', { name: 'Banana' }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: t('plan.snackbar.undo') })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: t('shopping.clearConfirm') }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t('shopping.clearConfirm') }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.clearFailed')));
    expect(screen.queryByRole('button', { name: t('plan.snackbar.undo') })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Paper towels/ })).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith('Error clearing list:', expect.any(Error));
  });
});

describe('ShoppingList recipes view', () => {
  it('lists recipe ingredients, highlights calories in primary, ticks items on the list and opens the recipe', async () => {
    const toggleItem = vi.spyOn(api.shoppingList, 'toggleItem').mockResolvedValue(undefined as never);
    APP_DATA.shoppingList = ITEMS;
    APP_DATA.shoppingListRecipes = [
      { id: 'r1', name: 'Omelette', kcal: 610.4, portions: 2, ingredients: [{ name: 'quinoa', amount: 250, unit: 'g' }, { name: 'Salt', amount: 1, unit: 'g' }] },
      { recipe: { id: 'r2', name: 'Soup' }, portions: 1, ingredients: [] },
    ];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.viewRecipes') }));

    expect(screen.queryByRole('button', { name: t('shopping.groupByCategory') })).toBeNull();
    const kcalBadge = screen.getByText('610 kcal');
    expect(kcalBadge.className).toContain('text-primary');
    expect(kcalBadge.parentElement?.textContent).toBe(`${t('shopping.portions.few', { count: 2 })}, 610 kcal`);
    expect(screen.getByText('0 kcal').parentElement?.textContent).toBe(`${t('shopping.portions.one', { count: 1 })}, 0 kcal`);
    expect(screen.getByText(t('shopping.noRecipeIngredients'))).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Salt/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: t('shopping.removeItem', { name: 'quinoa' }) })).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /quinoa/ }));
    await waitFor(() => expect(toggleItem).toHaveBeenCalledWith('s2', true));

    fireEvent.click(screen.getByRole('button', { name: /Soup/ }));
    expect(screen.getByText('Recipe page')).toBeTruthy();
  });

  it('shows linked recipes or the empty recipes notice even when no products remain', () => {
    APP_DATA.shoppingList = [];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.viewRecipes') }));

    expect(screen.getByText(t('shopping.noSourceRecipes'))).toBeTruthy();
  });
});

describe('ShoppingList departments', () => {
  const PET = { id: 'd1', name: 'Pet food' };
  const groupNames = () => screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent);
  const openMove = (name: string) => fireEvent.click(screen.getByRole('button', { name: t('shopping.moveItem', { name }) }));
  const sheet = () => within(screen.getByRole('dialog'));

  beforeEach(() => {
    APP_DATA.shoppingList = ITEMS;
  });

  it('groups products by the remembered departments, including own ones', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'paper towels', department: 'd1' }, { product_name: 'banana', department: 'gone' }],
    });
    renderPage();

    await waitFor(() => expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.grains'), 'Pet food']));
  });

  it('moves a product to another department and remembers it', async () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment').mockResolvedValue({
      custom: [],
      assignments: [{ product_name: 'paper towels', department: 'bakery' }],
    });
    renderPage();

    openMove('Paper towels');
    expect(sheet().getByRole('button', { name: t('shopping.category.other') }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.bakery') }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.bakery'), t('shopping.category.grains')]);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.moved', { department: t('shopping.category.bakery') })));
    expect(assign).toHaveBeenCalledWith({ product_name: 'Paper towels', department: 'bakery' });
  });

  it('only closes the sheet when the current department is picked', () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment');
    renderPage();

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.other') }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('creates an own department or reuses one with the same name', async () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment').mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'paper towels', department: 'd1' }],
    });
    renderPage();

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartment') }));
    fireEvent.change(sheet().getByLabelText(t('shopping.newDepartmentName')), { target: { value: 'Pet food' } });
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartmentAdd') }));

    await waitFor(() => expect(groupNames()).toContain('Pet food'));
    expect(assign).toHaveBeenCalledWith({ product_name: 'Paper towels', new_department_name: 'Pet food' });

    openMove('Quinoa');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartment') }));
    fireEvent.change(sheet().getByLabelText(t('shopping.newDepartmentName')), { target: { value: ' pet FOOD ' } });
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartmentAdd') }));

    await waitFor(() => expect(assign).toHaveBeenLastCalledWith({ product_name: 'Quinoa', department: 'd1' }));
  });

  it('puts the product back when moving fails', async () => {
    vi.spyOn(api.shoppingList, 'assignDepartment').mockRejectedValue(new Error('offline'));
    renderPage();

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.dairy') }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(t('shopping.moveFailed')));
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.grains'), t('shopping.category.other')]);
  });

  it('keeps the guessed departments when loading the remembered ones fails', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockRejectedValue(new Error('offline'));
    renderPage();

    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error loading shopping departments:', expect.any(Error)));
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.grains'), t('shopping.category.other')]);
  });

  it('does not let the first load undo a move made before it answered', async () => {
    let answerLoad!: (value: { custom: never[]; assignments: never[] }) => void;
    vi.mocked(api.shoppingList.getDepartments).mockImplementation(() => new Promise(resolve => { answerLoad = resolve; }));
    vi.spyOn(api.shoppingList, 'assignDepartment').mockResolvedValue({
      custom: [],
      assignments: [{ product_name: 'paper towels', department: 'dairy' }],
    });
    renderPage();

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.dairy') }));
    await act(async () => answerLoad({ custom: [], assignments: [] }));

    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.dairy'), t('shopping.category.grains')]);
  });

  it('puts back only the product whose move failed and keeps the newer move', async () => {
    let failFirst!: (reason?: unknown) => void;
    let answerSecond!: (value: { custom: never[]; assignments: { product_name: string; department: string }[] }) => void;
    vi.spyOn(api.shoppingList, 'assignDepartment')
      .mockImplementationOnce(() => new Promise((_, reject) => { failFirst = reject; }))
      .mockImplementationOnce(() => new Promise(resolve => { answerSecond = resolve; }));
    renderPage();
    await act(async () => {});

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.dairy') }));
    openMove('Quinoa');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.bakery') }));

    await act(async () => failFirst(new Error('offline')));
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.bakery'), t('shopping.category.other')]);

    await act(async () => answerSecond({
      custom: [],
      assignments: [{ product_name: 'quinoa', department: 'bakery' }],
    }));
    expect(groupNames()).toEqual([t('shopping.category.produce'), t('shopping.category.bakery'), t('shopping.category.other')]);
  });

  it('only closes the sheet when a new department is named like the current one', () => {
    const assign = vi.spyOn(api.shoppingList, 'assignDepartment');
    renderPage();

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartment') }));
    fireEvent.change(sheet().getByLabelText(t('shopping.newDepartmentName')), { target: { value: t('shopping.category.other') } });
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.newDepartmentAdd') }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('deletes an own department after the undo time and puts its products back where they were guessed', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'paper towels', department: 'd1' }],
    });
    const remove = vi.spyOn(api.shoppingList, 'deleteDepartment').mockResolvedValue({ custom: [], assignments: [] });
    renderPage();
    await waitFor(() => expect(groupNames()).toContain('Pet food'));

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.deleteDepartment', { name: 'Pet food' }) }));

    expect(sheet().queryByRole('button', { name: 'Pet food' })).toBeNull();
    expect(sheet().getByRole('button', { name: t('shopping.category.other') }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain(t('shopping.departmentDeleted'));
    expect(remove).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(DEPARTMENT_DELETE_DELAY_MS));

    expect(remove).toHaveBeenCalledWith('d1');
    expect(groupNames()).not.toContain('Pet food');
  });

  it('brings an own department back on undo without deleting it', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'paper towels', department: 'd1' }],
    });
    const remove = vi.spyOn(api.shoppingList, 'deleteDepartment');
    renderPage();
    await waitFor(() => expect(groupNames()).toContain('Pet food'));

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.deleteDepartment', { name: 'Pet food' }) }));
    fireEvent.click(screen.getByRole('button', { name: t('plan.snackbar.undo') }));
    await act(async () => vi.advanceTimersByTime(DEPARTMENT_DELETE_DELAY_MS));

    expect(remove).not.toHaveBeenCalled();
    expect(sheet().getByRole('button', { name: 'Pet food' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the own department when deleting it fails', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({
      custom: [PET],
      assignments: [{ product_name: 'paper towels', department: 'd1' }],
    });
    vi.spyOn(api.shoppingList, 'deleteDepartment').mockRejectedValue(new Error('offline'));
    renderPage();
    await waitFor(() => expect(groupNames()).toContain('Pet food'));

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.deleteDepartment', { name: 'Pet food' }) }));
    await act(async () => vi.advanceTimersByTime(DEPARTMENT_DELETE_DELAY_MS));

    expect(screen.getByRole('status').textContent).toContain(t('shopping.deleteDepartmentFailed'));
    expect(sheet().getByRole('button', { name: 'Pet food' })).toBeTruthy();
  });

  it('finishes a pending department delete when leaving the page', async () => {
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({ custom: [PET], assignments: [] });
    const remove = vi.spyOn(api.shoppingList, 'deleteDepartment').mockRejectedValue(new Error('offline'));
    const { unmount } = renderPage();
    await act(async () => {});

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.deleteDepartment', { name: 'Pet food' }) }));
    unmount();

    expect(remove).toHaveBeenCalledWith('d1');
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error deleting department:', expect.any(Error)));
  });

  it('reloads the departments when an older answer comes after a newer one', async () => {
    let answerFirst!: (value: { custom: never[]; assignments: { product_name: string; department: string }[] }) => void;
    vi.spyOn(api.shoppingList, 'assignDepartment')
      .mockImplementationOnce(() => new Promise(resolve => { answerFirst = resolve; }))
      .mockResolvedValueOnce({ custom: [], assignments: [{ product_name: 'quinoa', department: 'bakery' }] });
    renderPage();
    await act(async () => {});
    vi.mocked(api.shoppingList.getDepartments).mockResolvedValue({
      custom: [],
      assignments: [{ product_name: 'paper towels', department: 'dairy' }, { product_name: 'quinoa', department: 'bakery' }],
    });

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.dairy') }));
    openMove('Quinoa');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.category.bakery') }));
    await act(async () => {});
    await act(async () => answerFirst({ custom: [], assignments: [{ product_name: 'paper towels', department: 'dairy' }] }));

    await waitFor(() => expect(groupNames()).toEqual([
      t('shopping.category.produce'),
      t('shopping.category.bakery'),
      t('shopping.category.dairy'),
    ]));
    expect(api.shoppingList.getDepartments).toHaveBeenCalledTimes(2);
  });

  it('closes the sheet from the close button', () => {
    renderPage();

    openMove('Paper towels');
    fireEvent.click(sheet().getByRole('button', { name: t('shopping.close') }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
