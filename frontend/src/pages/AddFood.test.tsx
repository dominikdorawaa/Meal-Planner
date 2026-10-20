import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AddFood } from './AddFood';
import { ProductDetails } from './ProductDetails';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  addMeal: vi.fn(),
  updateMeal: vi.fn(),
  getAllMeals: vi.fn(),
  refreshMeals: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  findProductByBarCode: vi.fn(),
  savedProducts: vi.fn(),
  ownProducts: vi.fn(),
  saveProduct: vi.fn(),
  unsaveProduct: vi.fn(),
  savedRecipes: vi.fn(),
  saveRecipe: vi.fn(),
  unsaveRecipe: vi.fn(),
  searchArgs: [] as { query: string; enabled: boolean }[],
  searchItems: [] as object[],
  recipes: [] as object[],
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    meals: { add: mocks.addMeal, update: mocks.updateMeal, getAll: mocks.getAllMeals },
    products: {
      create: mocks.createProduct,
      getByBarCode: vi.fn(),
      getById: mocks.getProduct,
      delete: vi.fn(),
      saved: mocks.savedProducts,
      own: mocks.ownProducts,
      save: mocks.saveProduct,
      unsave: mocks.unsaveProduct,
    },
    recipes: { saved: mocks.savedRecipes, save: mocks.saveRecipe, unsave: mocks.unsaveRecipe },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    recipes: mocks.recipes,
    userMeals: [
      { recipe: { id: 'r1' }, created_at: '2026-10-16T10:00:00Z' },
      { product: { id: 'p1', name: 'Jogurt', kcal: 60 }, created_at: '2026-10-15T10:00:00Z' },
      { recipe: { id: 'r2' }, created_at: '2026-10-14T10:00:00Z' },
    ],
    profile: null,
    loading: false,
    refreshMeals: mocks.refreshMeals,
    user: { userId: 'user-1' },
    getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
  }),
}));

vi.mock('../lib/useProductSearch', () => ({
  useProductSearch: (args: { query: string; enabled: boolean }) => {
    mocks.searchArgs.push(args);
    return {
    items: mocks.searchItems,
    hasNext: false,
    loading: false,
    error: null,
    loadMore: vi.fn(),
    reload: vi.fn(),
    };
  },
}));

vi.mock('../lib/barcodeLookup', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/barcodeLookup')>()),
  findProductByBarCode: mocks.findProductByBarCode,
}));

vi.mock('../lib/useExistingBarCodeProduct', () => ({
  useExistingBarCodeProduct: () => ({ checking: false, product: null }),
}));

vi.mock('../components/LazyBarcodeScanner', () => ({
  LazyBarcodeScanner: ({ onDetected }: { onDetected: (code: string) => void }) => (
    <button onClick={() => onDetected('5900820000318')}>detect code</button>
  ),
}));

const alertMock = vi.fn();
const ADD_FOOD_URL = '/add-food?selectDate=2026-10-17&selectType=lunch';

function DetailsStub() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <p>details {location.pathname + location.search}</p>
      <p data-testid="details-state">{JSON.stringify(location.state)}</p>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
}

function PlanStub() {
  const navigate = useNavigate();
  return (
    <div>
      <p>plan screen</p>
      <button onClick={() => navigate(-2)}>history back twice</button>
    </div>
  );
}

function renderAddFood(url = ADD_FOOD_URL) {
  return render(
    <MemoryRouter initialEntries={['/', url]} initialIndex={1}>
      <Routes>
        <Route path="/" element={<PlanStub />} />
        <Route path="/add-food" element={<AddFood />} />
        <Route path="/recipe/:id" element={<DetailsStub />} />
        <Route path="/product/:id" element={<ProductDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

function checkbox(name: string) {
  return screen.getByRole('checkbox', { name: t('addFood.selectItem', { name }) });
}

function tab(name: string) {
  return screen.getByRole('tab', { name: new RegExp(name) });
}

async function openSavedTab() {
  fireEvent.click(tab('Zapisane'));
  await screen.findByRole('checkbox', { name: t('addFood.selectItem', { name: 'Jogurt' }) });
}

function addSelectedButton(count: number) {
  return screen.queryByRole('button', { name: new RegExp(`Dodaj \\(${count}\\)`) });
}

beforeEach(() => {
  vi.stubGlobal('alert', alertMock);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.addMeal.mockResolvedValue({});
  mocks.updateMeal.mockResolvedValue({});
  mocks.getAllMeals.mockResolvedValue([]);
  mocks.refreshMeals.mockResolvedValue(undefined);
  mocks.getProduct.mockResolvedValue({ id: 'p1', name: 'Jogurt', kcal: 60, protein: 4, fat: 3, carbs: 5 });
  mocks.recipes = [
    { id: 'r1', name: 'Owsianka', kcal: 350, protein: 12, fat: 6, carbs: 60 },
    { id: 'r2', name: 'Omlet', kcal: 420, protein: 25, fat: 30, carbs: 4 },
    { id: 'r3', name: 'Moja sałatka', kcal: 210, protein: 5, fat: 15, carbs: 12, created_by: 'user-1' },
  ];
  mocks.searchArgs = [];
  mocks.searchItems = [
    { id: 'p1', name: 'Jogurt', kcal: 60 },
    { id: 'p4', name: 'Kefir', kcal: 50, status: 'VERIFIED' },
  ];
  mocks.savedProducts.mockResolvedValue([{ id: 'p1', name: 'Jogurt', kcal: 60 }]);
  mocks.ownProducts.mockResolvedValue([{ id: 'p3', name: 'Mój baton', kcal: 200, status: 'PENDING', created_by: 'user-1' }]);
  mocks.saveProduct.mockResolvedValue(undefined);
  mocks.unsaveProduct.mockResolvedValue(undefined);
  mocks.savedRecipes.mockResolvedValue([{ id: 'r1', name: 'Owsianka', kcal: 350 }]);
  mocks.saveRecipe.mockResolvedValue(undefined);
  mocks.unsaveRecipe.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('AddFood selection', () => {
  it('adds all checked items with default portions and returns to the plan', async () => {
    renderAddFood();
    await openSavedTab();

    expect(addSelectedButton(1)).toBeNull();
    fireEvent.click(checkbox('Owsianka'));
    fireEvent.click(checkbox('Jogurt'));
    fireEvent.click(addSelectedButton(2)!);

    await screen.findByText('plan screen');
    expect(mocks.addMeal.mock.calls.map(call => call[0])).toEqual([
      { recipe: { id: 'r1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 1 },
      { product: { id: 'p1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 100 },
    ]);
    expect(mocks.refreshMeals).toHaveBeenCalled();
  });

  it('unchecks an item and hides the button when nothing is checked', () => {
    renderAddFood();

    fireEvent.click(checkbox('Owsianka'));
    expect(addSelectedButton(1)).not.toBeNull();
    fireEvent.click(checkbox('Owsianka'));

    expect(addSelectedButton(1)).toBeNull();
    expect(checkbox('Owsianka')).toHaveProperty('ariaChecked', 'false');
  });

  it('stays on the list and keeps only unsaved items checked when adding fails', async () => {
    mocks.addMeal.mockResolvedValueOnce({}).mockRejectedValue(new Error('Server error (500)'));
    renderAddFood();

    fireEvent.click(checkbox('Owsianka'));
    fireEvent.click(checkbox('Omlet'));
    fireEvent.click(addSelectedButton(2)!);

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(t('addFood.addSelectedFailed')));
    expect(screen.queryByText('plan screen')).toBeNull();
    expect(mocks.refreshMeals).toHaveBeenCalled();
    expect(checkbox('Owsianka')).toHaveProperty('ariaChecked', 'false');
    expect(checkbox('Omlet')).toHaveProperty('ariaChecked', 'true');
    expect(addSelectedButton(1)).toHaveProperty('disabled', false);
  });

  it('passes the selection to item details and keeps it after going back', async () => {
    renderAddFood();
    fireEvent.click(checkbox('Owsianka'));

    fireEvent.click(screen.getByText('Omlet'));

    await screen.findByText('details /recipe/r2?selectDate=2026-10-17&selectType=lunch');
    expect(JSON.parse(screen.getByTestId('details-state').textContent!).planSelection.items).toEqual([
      { kind: 'recipe', id: 'r1' },
    ]);

    fireEvent.click(screen.getByText('back'));

    expect(await screen.findByRole('checkbox', { name: t('addFood.selectItem', { name: 'Owsianka' }) })).toHaveProperty(
      'ariaChecked',
      'true'
    );
    expect(checkbox('Omlet')).toHaveProperty('ariaChecked', 'false');
    expect(addSelectedButton(1)).not.toBeNull();
    expect(mocks.addMeal).not.toHaveBeenCalled();
  });

  it('keeps the selection after the back arrow on the product details screen', async () => {
    renderAddFood();
    await openSavedTab();
    fireEvent.click(checkbox('Owsianka'));

    fireEvent.click(screen.getByText('Jogurt'));
    await screen.findByDisplayValue('100');
    fireEvent.click(screen.getByText('arrow_back'));

    expect(await screen.findByRole('checkbox', { name: t('addFood.selectItem', { name: 'Owsianka' }) })).toHaveProperty(
      'ariaChecked',
      'true'
    );
    expect(mocks.addMeal).not.toHaveBeenCalled();
  });

  it('keeps the meal picked in the header after coming back from details', async () => {
    renderAddFood();
    fireEvent.click(screen.getByText(/Dodaj do:/));
    fireEvent.click(screen.getByRole('button', { name: 'Obiad' }));
    fireEvent.click(checkbox('Owsianka'));

    fireEvent.click(screen.getByText('Omlet'));
    await screen.findByText('details /recipe/r2?selectDate=2026-10-17&selectType=dinner');
    fireEvent.click(screen.getByText('back'));

    expect(await screen.findByText('Dodaj do: Obiad')).toBeTruthy();
    expect(checkbox('Owsianka')).toHaveProperty('ariaChecked', 'true');
  });

  it('does not bring back saved selections when going back in history', async () => {
    renderAddFood();
    await openSavedTab();
    fireEvent.click(checkbox('Owsianka'));
    fireEvent.click(screen.getByText('Jogurt'));
    await screen.findByDisplayValue('100');

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));
    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('history back twice'));

    expect(await screen.findByRole('checkbox', { name: t('addFood.selectItem', { name: 'Owsianka' }) })).toHaveProperty(
      'ariaChecked',
      'false'
    );
    expect(addSelectedButton(1)).toBeNull();
  });

  it('saves the quick add entry together with all checked items', async () => {
    renderAddFood();
    fireEvent.click(checkbox('Owsianka'));

    fireEvent.click(screen.getByText('Szybkie'));
    expect(addSelectedButton(1)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('np. Szybki obiad z zewnątrz'), { target: { value: 'Pizza' } });
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz/ }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({ manual_name: 'Pizza', manual_kcal: 800, meal_date: '2026-10-17', meal_type: 'lunch' }),
      { recipe: { id: 'r1' }, meal_date: '2026-10-17', meal_type: 'lunch', portions_consumed: 1 },
    ]);
  });

  it('does not add checked items when updating a quick entry', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', manual_name: 'Pizza', manual_kcal: 800 }]);
    renderAddFood(`${ADD_FOOD_URL}&mealId=m1`);

    await waitFor(() => expect(screen.getByDisplayValue('Pizza')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Pizza z pieca' } });
    fireEvent.click(screen.getByRole('button', { name: /Aktualizuj wpis/ }));

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', expect.objectContaining({ manual_name: 'Pizza z pieca' }));
    expect(mocks.addMeal).not.toHaveBeenCalled();
  });
});

describe('AddFood quick entry editing', () => {
  function updateButton() {
    return screen.getByRole('button', { name: /Aktualizuj wpis/ }) as HTMLButtonElement;
  }

  it('keeps the update button disabled until something changes', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', manual_name: 'Pizza', manual_kcal: 800, manual_protein: 30 }]);
    renderAddFood(`${ADD_FOOD_URL}&mealId=m1`);

    await waitFor(() => expect(screen.getByDisplayValue('Pizza')).toBeTruthy());
    expect(updateButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Białko'), { target: { value: '31' } });
    expect(updateButton().disabled).toBe(false);

    fireEvent.change(screen.getByLabelText('Białko'), { target: { value: '30' } });
    expect(updateButton().disabled).toBe(true);
  });

  it('blocks saving when calories are zero or empty', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', manual_name: 'Pizza', manual_kcal: 800 }]);
    renderAddFood(`${ADD_FOOD_URL}&mealId=m1`);
    await waitFor(() => expect(screen.getByDisplayValue('Pizza')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Wartość energetyczna'), { target: { value: '0' } });
    expect(updateButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Wartość energetyczna'), { target: { value: '' } });
    expect(updateButton().disabled).toBe(true);
  });

  it('does not accept values above the meal limits', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', manual_name: 'Pizza', manual_kcal: 800 }]);
    renderAddFood(`${ADD_FOOD_URL}&mealId=m1`);
    await waitFor(() => expect(screen.getByDisplayValue('Pizza')).toBeTruthy());

    const kcal = screen.getByLabelText('Wartość energetyczna') as HTMLInputElement;
    fireEvent.change(kcal, { target: { value: '10000' } });
    expect(kcal.value).toBe('10000');
    fireEvent.change(kcal, { target: { value: '10001' } });
    expect(kcal.value).toBe('10000');

    const fat = screen.getByLabelText('Tłuszcz') as HTMLInputElement;
    fireEvent.change(fat, { target: { value: '1000.5' } });
    expect(fat.value).toBe('');
  });

  it('turns off autofill suggestions in the quick entry fields', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', manual_name: 'Pizza', manual_kcal: 800 }]);
    renderAddFood(`${ADD_FOOD_URL}&mealId=m1`);
    await waitFor(() => expect(screen.getByDisplayValue('Pizza')).toBeTruthy());

    for (const label of ['Nazwa', 'Wartość energetyczna', 'Węgle', 'Białko', 'Tłuszcz']) {
      expect(screen.getByLabelText(label).getAttribute('autocomplete')).toBe('off');
    }
    expect(screen.getByLabelText('Wartość energetyczna').getAttribute('inputmode')).toBe('numeric');
    expect(screen.getByLabelText('Białko').getAttribute('inputmode')).toBe('decimal');
  });
});

describe('AddFood item cards', () => {
  it('toggles the checkbox when the right part of the card is tapped', () => {
    renderAddFood();

    const areas = screen.getAllByTestId('food-row-select-area');
    fireEvent.click(areas[0]);

    expect(checkbox('Owsianka').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(/^details/)).toBeNull();
    fireEvent.click(areas[0]);
    expect(checkbox('Owsianka').getAttribute('aria-checked')).toBe('false');
  });

  it('opens details when the left part of the card is tapped', async () => {
    renderAddFood();

    fireEvent.click(screen.getByText('Owsianka'));

    expect(await screen.findByText(/^details \/recipe\/r1/)).toBeTruthy();
  });

  it('gives every checked checkbox the same grey colour', () => {
    renderAddFood();

    fireEvent.click(checkbox('Owsianka'));
    fireEvent.click(checkbox('Omlet'));

    const boxes = [checkbox('Owsianka'), checkbox('Omlet')].map(item => item.firstElementChild!.className);
    expect(boxes[0]).toBe(boxes[1]);
    expect(boxes[0]).toContain('bg-on-surface-variant');
  });

  it('shortens very large calorie values on the card', () => {
    mocks.recipes = [{ id: 'r1', name: 'Owsianka', kcal: 123456, protein: 12, fat: 6, carbs: 60 }];
    renderAddFood();

    expect(screen.getByText('123,5 tys. kcal')).toBeTruthy();
  });

  it('turns off autofill suggestions in the search field', () => {
    renderAddFood();

    const search = screen.getByPlaceholderText(t('food.searchPlaceholder'));
    expect(search.getAttribute('autocomplete')).toBe('off');
    expect(search.getAttribute('inputmode')).toBe('search');
  });

  it('does not accept filter values above the limit', () => {
    renderAddFood();
    fireEvent.click(screen.getByTitle('Filtruj wyniki'));

    const maxKcal = screen.getByPlaceholderText('np. 500') as HTMLInputElement;
    fireEvent.change(maxKcal, { target: { value: '10001' } });
    expect(maxKcal.value).toBe('');
  });
});

describe('AddFood tabs', () => {
  it('shows only Ostatnie, Zapisane and Własne tabs', () => {
    renderAddFood();

    expect(screen.getAllByRole('tab').map(item => item.textContent)).toEqual(['historyOstatnie', 'favoriteZapisane', 'personWłasne']);
  });

  it('lists what was added to the plan, newest first, in Ostatnie', () => {
    renderAddFood();

    const names = screen.getAllByRole('checkbox').map(item => item.getAttribute('aria-label'));
    expect(names).toEqual(['Owsianka', 'Jogurt', 'Omlet'].map(name => t('addFood.selectItem', { name })));
    expect(mocks.searchArgs.at(-1)?.enabled).toBe(false);
  });

  it('shows saved recipes and products in Zapisane', async () => {
    renderAddFood();
    await openSavedTab();

    expect(screen.getByText('Owsianka')).toBeTruthy();
    expect(screen.queryByText('Omlet')).toBeNull();
  });

  it('hides the empty section when only recipes are saved', async () => {
    mocks.savedProducts.mockResolvedValue([]);
    renderAddFood();
    fireEvent.click(tab('Zapisane'));

    expect(await screen.findByText('Owsianka')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Przepisy' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Produkty' })).toBeNull();
  });

  it('explains how to save items when nothing is saved', async () => {
    mocks.savedProducts.mockResolvedValue([]);
    mocks.savedRecipes.mockResolvedValue([]);
    renderAddFood();
    fireEvent.click(tab('Zapisane'));

    expect(await screen.findByText(t('food.savedEmpty'))).toBeTruthy();
  });

  it('shows own products and own recipes with their labels in Własne', async () => {
    renderAddFood();
    fireEvent.click(tab('Własne'));

    expect(await screen.findByText('Mój baton')).toBeTruthy();
    expect(screen.getByText('Moja sałatka')).toBeTruthy();
    expect(screen.queryByText('Owsianka')).toBeNull();
    expect(screen.getAllByText('Twój')).toHaveLength(2);
    expect(screen.getAllByText('niezweryfikowany')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: t('food.save', { name: 'Mój baton' }) })).toBeNull();
  });

  it('shows empty own sections when the user has nothing of their own', async () => {
    mocks.ownProducts.mockResolvedValue([]);
    mocks.recipes = [{ id: 'r1', name: 'Owsianka', kcal: 350, own: false, created_by: 'user-1' }];
    renderAddFood();
    fireEvent.click(tab('Własne'));

    expect(await screen.findByText(t('food.ownProductsEmpty'))).toBeTruthy();
    expect(screen.getByText(t('food.ownRecipesEmpty'))).toBeTruthy();
  });

  it('searches the whole product base and visible recipes whatever tab is open', () => {
    renderAddFood();
    fireEvent.click(tab('Własne'));
    fireEvent.change(screen.getByPlaceholderText('Szukaj przepisów, produktów...'), { target: { value: 'om' } });

    expect(mocks.searchArgs.at(-1)).toEqual(expect.objectContaining({ query: 'om', enabled: true }));
    expect(screen.getByText('Omlet')).toBeTruthy();
    expect(screen.queryByText('Owsianka')).toBeNull();
    expect(screen.getByText('Kefir')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Własne/ }).getAttribute('aria-selected')).toBe('false');
  });

  it('filters recipes by nutrition in search results', () => {
    renderAddFood();
    fireEvent.click(screen.getByTitle('Filtruj wyniki'));
    fireEvent.change(screen.getByPlaceholderText('np. 500'), { target: { value: '400' } });

    expect(screen.getByText('Owsianka')).toBeTruthy();
    expect(screen.queryByText('Omlet')).toBeNull();
  });

  it('applies every nutrition filter to recipes', () => {
    renderAddFood();
    fireEvent.click(screen.getByTitle('Filtruj wyniki'));
    const field = (placeholder: string) => screen.getByPlaceholderText(placeholder);

    fireEvent.change(field('np. 20'), { target: { value: '10' } });
    expect(screen.queryByText('Moja sałatka')).toBeNull();
    expect(screen.getByText('Owsianka')).toBeTruthy();

    fireEvent.change(field('np. 15'), { target: { value: '20' } });
    expect(screen.queryByText('Omlet')).toBeNull();

    fireEvent.change(field('np. 50'), { target: { value: '50' } });
    expect(screen.queryByText('Owsianka')).toBeNull();
    expect(screen.getByText(t('food.noRecipes'))).toBeTruthy();
  });

  it('tells when the search finds nothing', () => {
    mocks.searchItems = [];
    renderAddFood();
    fireEvent.change(screen.getByPlaceholderText('Szukaj przepisów, produktów...'), { target: { value: 'zzz' } });

    expect(screen.getByText(t('food.noRecipes'))).toBeTruthy();
    expect(screen.getByText(t('food.noProducts'))).toBeTruthy();
  });

  it('saves and unsaves a product with the heart', async () => {
    renderAddFood();
    await openSavedTab();
    fireEvent.change(screen.getByPlaceholderText('Szukaj przepisów, produktów...'), { target: { value: 'kef' } });

    fireEvent.click(screen.getByRole('button', { name: t('food.save', { name: 'Kefir' }) }));
    await waitFor(() => expect(mocks.saveProduct).toHaveBeenCalledWith('p4'));
    expect(screen.getByRole('button', { name: t('food.unsave', { name: 'Kefir' }) }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: t('food.unsave', { name: 'Kefir' }) }));
    await waitFor(() => expect(mocks.unsaveProduct).toHaveBeenCalledWith('p4'));
    expect(mocks.addMeal).not.toHaveBeenCalled();
  });

  it('brings the heart back when saving fails', async () => {
    mocks.unsaveProduct.mockRejectedValue(new Error('offline'));
    renderAddFood();
    await openSavedTab();

    fireEvent.click(screen.getByRole('button', { name: t('food.unsave', { name: 'Jogurt' }) }));

    expect(await screen.findByRole('button', { name: t('food.unsave', { name: 'Jogurt' }) })).toBeTruthy();
  });

  it('saves and unsaves a recipe with the heart', async () => {
    renderAddFood();
    await openSavedTab();

    fireEvent.click(screen.getByRole('button', { name: t('food.unsave', { name: 'Owsianka' }) }));
    await waitFor(() => expect(mocks.unsaveRecipe).toHaveBeenCalledWith('r1'));
    expect(screen.queryByText('Owsianka')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Szukaj przepisów, produktów...'), { target: { value: 'owsi' } });
    fireEvent.click(screen.getByRole('button', { name: t('food.save', { name: 'Owsianka' }) }));
    await waitFor(() => expect(mocks.saveRecipe).toHaveBeenCalledWith('r1'));
  });

  it('restores the recipe heart when the server rejects the change', async () => {
    mocks.saveRecipe.mockRejectedValue(new Error('offline'));
    mocks.unsaveRecipe.mockRejectedValue(new Error('offline'));
    renderAddFood();
    await openSavedTab();
    fireEvent.change(screen.getByPlaceholderText('Szukaj przepisów, produktów...'), { target: { value: 'o' } });

    fireEvent.click(screen.getByRole('button', { name: t('food.save', { name: 'Omlet' }) }));
    expect(await screen.findByRole('button', { name: t('food.save', { name: 'Omlet' }) })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('food.unsave', { name: 'Owsianka' }) }));
    expect(await screen.findByRole('button', { name: t('food.unsave', { name: 'Owsianka' }) })).toBeTruthy();
  });

  it('hides recipe hearts and uses saved flags when the saved recipes service is not available yet', async () => {
    mocks.savedRecipes.mockRejectedValue(new Error('Not found'));
    mocks.recipes = [
      { id: 'r1', name: 'Owsianka', kcal: 350, saved: true },
      { id: 'r2', name: 'Omlet', kcal: 420 },
    ];
    renderAddFood();
    await openSavedTab();

    expect(screen.getByText('Owsianka')).toBeTruthy();
    expect(screen.queryByText('Omlet')).toBeNull();
    expect(screen.queryByRole('button', { name: t('food.unsave', { name: 'Owsianka' }) })).toBeNull();
  });
});

describe('AddFood search field', () => {
  it('does not focus the search field when the screen opens', () => {
    renderAddFood();

    expect(document.activeElement).not.toBe(screen.getByPlaceholderText('Szukaj przepisów, produktów...'));
  });
});

describe('AddFood new product form', () => {
  const SKYR_PREFILL = { name: 'Skyr', brand: 'Piątnica', kcal: 65, protein: 12, fat: 0, carbs: 4.2 };

  function packageWeightField() {
    return screen.getByLabelText(t('product.packageWeight')) as HTMLInputElement;
  }

  function addProductButton() {
    return screen.getByRole('button', { name: /Dodaj produkt/ });
  }

  beforeEach(() => {
    mocks.createProduct.mockResolvedValue({ id: 'p2' });
  });

  it('fills the package weight from Open Food Facts and sends it with the product', async () => {
    mocks.findProductByBarCode.mockResolvedValue({ product: null, prefill: { ...SKYR_PREFILL, package_weight: 450 } });
    renderAddFood();

    fireEvent.click(screen.getByTitle('Skanuj kod'));
    fireEvent.click(screen.getByText('detect code'));

    await waitFor(() => expect(packageWeightField().value).toBe('450'));
    fireEvent.click(addProductButton());

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Skyr', bar_code: '5900820000318', package_weight: 450 })
    ));
  });

  it('saves a product without a package weight when the field is empty', async () => {
    mocks.findProductByBarCode.mockResolvedValue({ product: null, prefill: SKYR_PREFILL });
    renderAddFood();

    fireEvent.click(screen.getByTitle('Skanuj kod'));
    fireEvent.click(screen.getByText('detect code'));

    await waitFor(() => expect(packageWeightField().value).toBe(''));
    fireEvent.click(addProductButton());

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ package_weight: null })
    ));
  });

  it('blocks saving an impossible package weight', async () => {
    mocks.findProductByBarCode.mockResolvedValue({ product: null, prefill: SKYR_PREFILL });
    renderAddFood();

    fireEvent.click(screen.getByTitle('Skanuj kod'));
    fireEvent.click(screen.getByText('detect code'));
    await waitFor(() => expect(packageWeightField()).toBeTruthy());

    for (const weight of ['0', '50001']) {
      fireEvent.change(packageWeightField(), { target: { value: weight } });
      expect(screen.getByText(t('product.packageWeightInvalid'))).toBeTruthy();
      expect((addProductButton() as HTMLButtonElement).disabled).toBe(true);
    }

    fireEvent.change(packageWeightField(), { target: { value: '450' } });
    expect(screen.queryByText(t('product.packageWeightInvalid'))).toBeNull();
    expect((addProductButton() as HTMLButtonElement).disabled).toBe(false);
  });
});
