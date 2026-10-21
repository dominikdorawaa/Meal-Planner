import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetails } from './ProductDetails';
import { t } from '../i18n';
import { MEASURE_KINDS, measure, withMeasures } from '../lib/measureFixtures';

const mocks = vi.hoisted(() => ({
  addMeal: vi.fn(),
  updateMeal: vi.fn(),
  getAllMeals: vi.fn(),
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
    meals: { add: mocks.addMeal, update: mocks.updateMeal, getAll: mocks.getAllMeals },
    products: {
      getById: mocks.getProduct,
      delete: mocks.deleteProduct,
      saved: mocks.saved,
      save: mocks.save,
      unsave: mocks.unsave,
      update: mocks.update,
      createOwnVersion: mocks.createOwnVersion,
    },
    measureKinds: { list: () => Promise.resolve(MEASURE_KINDS) },
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

function renderDetails(query = '?selectDate=2026-10-17&selectType=lunch') {
  return render(
    <MemoryRouter initialEntries={[`/product/p1${query}`]}>
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
  mocks.updateMeal.mockResolvedValue({});
  mocks.getAllMeals.mockResolvedValue([]);
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

const PACKAGES = t('amount.countOf', { name: 'opakowania' });
const PIECES = t('amount.countOf', { name: 'sztuki' });

describe('ProductDetails package amount', () => {
  it('offers a whole package with its weight and calories when the package weight is known', async () => {
    mocks.getProduct.mockResolvedValue(withMeasures(SKYR, measure('package', 450)));
    renderDetails();

    const packages = await screen.findByLabelText(PACKAGES);
    const packageRow = packages.closest('[data-amount-row]') as HTMLElement;
    expect(within(packageRow).getByText(t('amount.measureOf', { name: 'opakowanie', amount: '450 g' }))).toBeTruthy();
    expect(within(packageRow).getByText('270')).toBeTruthy();

    fireEvent.change(packages, { target: { value: '2' } });
    expect(within(packageRow).getByText('540')).toBeTruthy();
    expect(within(packageRow).getByText(t('amount.measureOf', { name: 'opakowania', amount: '450 g' }))).toBeTruthy();
    expect(screen.getByText(t('product.nutritionFor', { amount: '2 opakowania (900 g)' }))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));
    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 900, measure_code: 'package', measure_amount: 2,
    }));
  });

  it('shows the package in millilitres for drinks', async () => {
    mocks.getProduct.mockResolvedValue(withMeasures({ ...SKYR, unit: '100ml' }, measure('package', 330)));
    renderDetails();

    expect(await screen.findByText(t('amount.measureOf', { name: 'opakowanie', amount: '330 ml' }))).toBeTruthy();
  });

  it('does not offer packages when the package weight is unknown', async () => {
    mocks.getProduct.mockResolvedValue(SKYR);
    renderDetails();

    await screen.findByDisplayValue('100');
    expect(screen.queryByLabelText(PACKAGES)).toBeNull();
  });
});

describe('ProductDetails measures', () => {
  const BANANA = withMeasures({ ...SKYR, name: 'Banan', kcal: 90 }, measure('piece', 120, true), measure('slice', 10));

  it('starts with one default measure and adds it to the plan with its weight', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    renderDetails();

    const pieces = await screen.findByLabelText(PIECES) as HTMLInputElement;
    expect(pieces.value).toBe('1');
    expect(pieces.closest('[data-amount-row]')?.className).toContain('bg-primary/5');
    expect(screen.getByTestId('kcal-value').textContent).toBe('108');

    fireEvent.change(screen.getByLabelText(t('amount.countOf', { name: 'plasterki' })), { target: { value: '3' } });
    expect(screen.getByTestId('kcal-value').textContent).toBe('27');
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 30, measure_code: 'slice', measure_amount: 3,
    }));
  });

  it('adds grams without a measure', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    renderDetails();

    fireEvent.change(await screen.findByLabelText(t('amount.grams')), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 150, measure_code: null, measure_amount: null,
    }));
  });

  it('opens a plan item in the measure it was saved in and saves a switch to grams', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 240, measure_code: 'piece', measure_amount: 2 }]);
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');

    const pieces = await screen.findByLabelText(PIECES) as HTMLInputElement;
    await waitFor(() => expect(pieces.value).toBe('2'));
    const update = screen.getByRole('button', { name: 'Zaktualizuj' }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(t('amount.grams')), { target: { value: '240' } });
    expect(update.disabled).toBe(false);
    fireEvent.click(update);

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 240, measure_code: null, measure_amount: null });
  });

  it('opens a plan item in grams when its measure is no longer offered', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 60, measure_code: 'tbsp', measure_amount: 4 }]);
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');

    const grams = await screen.findByLabelText(t('amount.grams')) as HTMLInputElement;
    await waitFor(() => expect(grams.value).toBe('60'));
    expect(screen.getByTestId('kcal-value').textContent).toBe('54');
  });

  it('counts products sold per piece in pieces', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, name: 'Jajko', kcal: 75, unit: 'pc' });
    renderDetails();

    const pieces = await screen.findByLabelText(t('amount.pieces')) as HTMLInputElement;
    expect(pieces.value).toBe('1');
    expect(screen.getByTestId('kcal-value').textContent).toBe('75');
    fireEvent.change(pieces, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 2, measure_code: null, measure_amount: null,
    }));
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

describe('ProductDetails plan item editing', () => {
  const EDIT_QUERY = '?selectDate=2026-10-17&selectType=lunch&mealId=m1';

  function updateButton() {
    return screen.getByRole('button', { name: 'Zaktualizuj' }) as HTMLButtonElement;
  }

  it('keeps the update button disabled until the amount changes', async () => {
    mocks.getProduct.mockResolvedValue(SKYR);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 150 }]);
    renderDetails(EDIT_QUERY);

    const grams = await screen.findByLabelText(t('amount.grams'));
    await waitFor(() => expect((grams as HTMLInputElement).value).toBe('150'));
    expect(updateButton().disabled).toBe(true);

    fireEvent.change(grams, { target: { value: '200' } });
    expect(updateButton().disabled).toBe(false);
    fireEvent.click(updateButton());

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 200, measure_code: null, measure_amount: null });
  });

  it('blocks saving when the amount is zero or empty', async () => {
    mocks.getProduct.mockResolvedValue(SKYR);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 150 }]);
    renderDetails(EDIT_QUERY);

    const grams = await screen.findByLabelText(t('amount.grams'));
    await waitFor(() => expect((grams as HTMLInputElement).value).toBe('150'));
    fireEvent.change(grams, { target: { value: '0' } });
    expect(updateButton().disabled).toBe(true);
    fireEvent.change(grams, { target: { value: '' } });
    expect(updateButton().disabled).toBe(true);
  });
});

describe('ProductDetails amount limits', () => {
  it('does not accept grams above 5000 or more than one decimal place', async () => {
    mocks.getProduct.mockResolvedValue(SKYR);
    renderDetails();

    const grams = await screen.findByLabelText(t('amount.grams')) as HTMLInputElement;
    fireEvent.change(grams, { target: { value: '5000' } });
    expect(grams.value).toBe('5000');
    fireEvent.change(grams, { target: { value: '5001' } });
    expect(grams.value).toBe('5000');
    fireEvent.change(grams, { target: { value: '12.25' } });
    expect(grams.value).toBe('5000');
    expect(grams.getAttribute('autocomplete')).toBe('off');
    expect(grams.getAttribute('inputmode')).toBe('decimal');
  });

  it('does not accept more than 100 pieces or packages', async () => {
    mocks.getProduct.mockResolvedValue(withMeasures(SKYR, measure('piece', 50), measure('package', 450), measure('cup', 250)));
    renderDetails();

    const pieces = await screen.findByLabelText(PIECES) as HTMLInputElement;
    fireEvent.change(pieces, { target: { value: '101' } });
    expect(pieces.value).toBe('1');
    const cups = screen.getByLabelText(t('amount.countOf', { name: 'szklanki' })) as HTMLInputElement;
    fireEvent.change(cups, { target: { value: '51' } });
    expect(cups.value).toBe('1');
    const packages = screen.getByLabelText(PACKAGES) as HTMLInputElement;
    fireEvent.change(packages, { target: { value: '100' } });
    expect(packages.value).toBe('100');
  });

  it('keeps the largest values inside the summary circles', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, kcal: 900, protein: 100, fat: 100, carbs: 100 });
    renderDetails();

    const grams = await screen.findByLabelText(t('amount.grams'));
    fireEvent.change(grams, { target: { value: '5000' } });

    const kcal = screen.getByTestId('kcal-value');
    expect(kcal.textContent).toBe('45 tys.');
    expect(kcal.className).not.toContain('text-3xl');
    const protein = screen.getByTestId('protein-value');
    expect(protein.textContent).toBe('5000g');
    expect(protein.className).toContain('text-sm');
    const gramsRow = grams.closest('[data-amount-row]') as HTMLElement;
    expect(within(gramsRow).getByText('45 tys.')).toBeTruthy();
  });
});
