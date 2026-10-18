import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetails } from './ProductDetails';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  addMeal: vi.fn(),
  getProduct: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    meals: { add: mocks.addMeal, update: vi.fn(), getAll: vi.fn().mockResolvedValue([]) },
    products: { getById: mocks.getProduct, delete: vi.fn() },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    user: { userId: 'user-1' },
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
        <Route path="/product/:id" element={<ProductDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.addMeal.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
