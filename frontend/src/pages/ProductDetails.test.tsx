import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetails } from './ProductDetails';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  addMeal: vi.fn(),
  getProduct: vi.fn(),
  saved: vi.fn(),
  save: vi.fn(),
  unsave: vi.fn(),
  update: vi.fn(),
  createOwnVersion: vi.fn(),
  deleteProduct: vi.fn(),
  user: { userId: 'user-1' } as { userId: string; role?: string } | null,
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    meals: { add: mocks.addMeal, update: vi.fn(), getAll: vi.fn().mockResolvedValue([]) },
    products: {
      getById: mocks.getProduct,
      delete: mocks.deleteProduct,
      saved: mocks.saved,
      save: mocks.save,
      unsave: mocks.unsave,
      update: mocks.update,
      createOwnVersion: mocks.createOwnVersion,
    },
  },
}));

vi.mock('../lib/useExistingBarCodeProduct', () => ({
  useExistingBarCodeProduct: () => ({ checking: false, product: null }),
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    user: mocks.user,
    profile: null,
    refreshMeals: vi.fn().mockResolvedValue(undefined),
    getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
  }),
}));

const SKYR = { id: 'p1', name: 'Skyr', kcal: 60, protein: 12, fat: 0, carbs: 3, unit: '100g' };

function renderDetails() {
  return render(
    <MemoryRouter initialEntries={['/product/p1?selectDate=2026-10-17&selectType=lunch']}>
      <Routes>
        <Route path="/" element={<p>plan screen</p>} />
        <Route path="/product/p2" element={<p>own version screen</p>} />
        <Route path="/product/:id" element={<ProductDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: t('product.menu') }));
}

beforeEach(() => {
  mocks.addMeal.mockResolvedValue({});
  mocks.user = { userId: 'user-1' };
  mocks.saved.mockResolvedValue([]);
  mocks.save.mockResolvedValue(undefined);
  mocks.unsave.mockResolvedValue(undefined);
  mocks.deleteProduct.mockResolvedValue(undefined);
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ProductDetails package amount', () => {
  it('offers a whole package with its weight and calories when the package weight is known', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, package_weight: 450 });
    renderDetails();

    const packages = await screen.findByLabelText(t('amount.packages'));
    const packageRow = packages.closest('[data-amount-row]') as HTMLElement;
    expect(within(packageRow).getByText(t('amount.packageOf', { amount: '450 g' }))).toBeTruthy();
    expect(within(packageRow).getByText('270')).toBeTruthy();

    fireEvent.change(packages, { target: { value: '2' } });
    expect(within(packageRow).getByText('540')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));
    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({ portions_consumed: 900 }));
  });

  it('shows the package in millilitres for drinks', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, unit: '100ml', package_weight: 330 });
    renderDetails();

    expect(await screen.findByText(t('amount.packageOf', { amount: '330 ml' }))).toBeTruthy();
  });

  it('does not offer packages when the package weight is unknown', async () => {
    mocks.getProduct.mockResolvedValue(SKYR);
    renderDetails();

    await screen.findByDisplayValue('100');
    expect(screen.queryByLabelText(t('amount.packages'))).toBeNull();
  });
});

describe('ProductDetails nutrition table', () => {
  it('keeps extra nutrients folded under carbs and shows them per 100 g', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, saturated_fat: 0.1, sugars: 2.5, fiber: 0, salt: 0.12 });
    renderDetails();

    const toggle = await screen.findByRole('button', { name: t('nutrients.showMore', { unit: 'g' }) });
    expect(screen.queryByText(t('nutrients.sugars'))).toBeNull();
    expect(screen.queryByText(t('nutrients.someMissing'))).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(t('nutrients.sugars'))).toBeTruthy();
    expect(screen.getByText('2.5 g')).toBeTruthy();
    expect(screen.getByText('0.12 g')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('nutrients.showLess') }));
    expect(screen.queryByText(t('nutrients.sugars'))).toBeNull();
  });

  it('marks missing values and adds one quiet note under the table', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, fat: null });
    renderDetails();

    await screen.findByText(t('nutrients.someMissing'));
    expect(screen.getAllByText(t('nutrients.noData'))).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: t('nutrients.showMore', { unit: 'g' }) }));
    expect(screen.getAllByText(t('nutrients.noData'))).toHaveLength(6);
  });
});

describe('ProductDetails saving and ownership', () => {
  const BASE = { ...SKYR, status: 'VERIFIED', source: 'OPEN_FOOD_FACTS', created_by: null, bar_code: '5900820000318' };
  const OWN = { ...SKYR, status: 'PENDING', source: 'USER', created_by: 'user-1' };

  it('saves and unsaves a base product with the heart', async () => {
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();

    fireEvent.click(await screen.findByRole('button', { name: t('food.save', { name: 'Skyr' }) }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('p1'));

    fireEvent.click(screen.getByRole('button', { name: t('food.unsave', { name: 'Skyr' }) }));
    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith('p1'));
  });

  it('restores the heart when saving fails', async () => {
    mocks.save.mockRejectedValue(new Error('offline'));
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();

    fireEvent.click(await screen.findByRole('button', { name: t('food.save', { name: 'Skyr' }) }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: t('food.save', { name: 'Skyr' }) })).toBeTruthy();
  });

  it('offers an own version and removing from saved instead of edit and delete on a base product', async () => {
    mocks.saved.mockResolvedValue([{ id: 'p1' }]);
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();
    await screen.findByRole('button', { name: t('food.unsave', { name: 'Skyr' }) });

    openMenu();
    expect(screen.queryByRole('menuitem', { name: /Edytuj/ })).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('menuitem', { name: /Usuń z zapisanych/ }));

    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith('p1'));
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /Usuń z zapisanych/ })).toBeNull();
  });

  it('creates an own version from the prefilled form and opens it', async () => {
    mocks.getProduct.mockResolvedValue(BASE);
    mocks.createOwnVersion.mockResolvedValue({ ...BASE, id: 'p2', status: 'PENDING', created_by: 'user-1' });
    renderDetails();
    await screen.findByRole('heading', { name: 'Skyr' });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Zrób własną wersję/ }));
    expect(screen.getByText(t('productForm.ownVersionHint'))).toBeTruthy();
    const name = screen.getByLabelText(t('productForm.name')) as HTMLInputElement;
    expect(name.value).toBe('Skyr');
    expect((screen.getByLabelText(t('product.barCode')) as HTMLInputElement).value).toBe('5900820000318');
    fireEvent.change(name, { target: { value: 'Mój skyr' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz moją wersję/ }));

    await screen.findByText('own version screen');
    expect(mocks.createOwnVersion).toHaveBeenCalledWith('p1', expect.objectContaining({
      name: 'Mój skyr', kcal: 60, bar_code: '5900820000318', unit: '100g',
    }));
  });

  it('lets the author edit and delete their own product and shows its labels', async () => {
    mocks.getProduct.mockResolvedValue(OWN);
    mocks.update.mockResolvedValue({ ...OWN, name: 'Skyr waniliowy' });
    renderDetails();

    expect(await screen.findByText('Twój')).toBeTruthy();
    expect(screen.getByText('niezweryfikowany')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('food.save', { name: 'Skyr' }) })).toBeNull();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Edytuj/ }));
    fireEvent.change(screen.getByLabelText(t('productForm.name')), { target: { value: 'Skyr waniliowy' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz zmiany/ }));

    expect(await screen.findByRole('heading', { name: 'Skyr waniliowy' })).toBeTruthy();
    expect(mocks.update).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Skyr waniliowy' }));

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Usuń/ }));
    fireEvent.click(screen.getByRole('button', { name: t('product.deleteConfirm') }));
    await screen.findByText('plan screen');
    expect(mocks.deleteProduct).toHaveBeenCalledWith('p1');
  });

  it('reports a failed delete', async () => {
    mocks.deleteProduct.mockRejectedValue(new Error('offline'));
    mocks.getProduct.mockResolvedValue(OWN);
    renderDetails();
    await screen.findByText('Twój');

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Usuń/ }));
    fireEvent.click(screen.getByRole('button', { name: t('product.deleteConfirm') }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith(t('product.deleteFailed', { message: 'offline' })));
  });

  it('closes the form without saving', async () => {
    mocks.getProduct.mockResolvedValue(OWN);
    renderDetails();
    await screen.findByText('Twój');

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Edytuj/ }));
    fireEvent.click(screen.getByRole('button', { name: t('productForm.close') }));

    expect(screen.queryByLabelText(t('productForm.name'))).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('hides the heart and the menu without a signed in user', async () => {
    mocks.user = null;
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();
    await screen.findByRole('heading', { name: 'Skyr' });

    expect(screen.queryByRole('button', { name: t('product.menu') })).toBeNull();
    expect(mocks.saved).not.toHaveBeenCalled();
  });
});
