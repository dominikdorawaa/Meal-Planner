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
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    meals: { add: mocks.addMeal, update: mocks.updateMeal, getAll: mocks.getAllMeals },
    products: { create: mocks.createProduct, getByBarCode: vi.fn(), getById: mocks.getProduct, delete: vi.fn() },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    recipes: [
      { id: 'r1', name: 'Owsianka', kcal: 350 },
      { id: 'r2', name: 'Omlet', kcal: 420 },
    ],
    userMeals: [],
    profile: null,
    loading: false,
    refreshMeals: mocks.refreshMeals,
    user: { userId: 'user-1' },
    getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
  }),
}));

vi.mock('../lib/useProductSearch', () => ({
  useProductSearch: () => ({
    items: [{ id: 'p1', name: 'Jogurt', kcal: 60 }],
    hasNext: false,
    loading: false,
    error: null,
    loadMore: vi.fn(),
    reload: vi.fn(),
  }),
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
    fireEvent.click(screen.getByText('Zapisane'));

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
    fireEvent.click(screen.getByText('Zapisane'));
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
    fireEvent.click(screen.getByText('Zapisane'));
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
    fireEvent.click(screen.getByRole('button', { name: /Aktualizuj wpis/ }));

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', expect.objectContaining({ manual_name: 'Pizza' }));
    expect(mocks.addMeal).not.toHaveBeenCalled();
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
