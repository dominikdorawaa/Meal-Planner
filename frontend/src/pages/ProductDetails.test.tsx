import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetails } from './ProductDetails';
import { t } from '../i18n';
import { MEASURE_KINDS, measure, withGenericMeasures, withMeasures } from '../lib/measureFixtures';

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
  profile: null as unknown,
  getConsumedForDay: vi.fn(),
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
    profile: mocks.profile,
    refreshMeals: vi.fn().mockResolvedValue(undefined),
    getConsumedForDay: mocks.getConsumedForDay,
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

function tapOutside() {
  fireEvent.click(document.querySelector('[data-outside-press-layer]')!);
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: t('product.menu') }));
}

beforeEach(() => {
  mocks.profile = null;
  mocks.getConsumedForDay.mockImplementation(() => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }));
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
const ADD = t('planTarget.addTo.lunch');

function chooseUnit(code: string) {
  fireEvent.change(screen.getByLabelText(t('amount.unit')), { target: { value: code } });
}

function unitOptions() {
  return Array.from((screen.getByLabelText(t('amount.unit')) as HTMLSelectElement).options).map(option => option.textContent);
}

describe('ProductDetails package amount', () => {
  it('offers a whole package with its weight and calories when the package weight is known', async () => {
    mocks.getProduct.mockResolvedValue(withMeasures(SKYR, measure('package', 450)));
    renderDetails();

    await screen.findByDisplayValue('100');
    expect(unitOptions()).toEqual(['g', t('amount.measureOf', { name: 'opakowanie', amount: '450 g' })]);
    fireEvent.change(screen.getByLabelText(t('amount.grams')), { target: { value: '450' } });
    chooseUnit('package');
    const packages = screen.getByLabelText(PACKAGES) as HTMLInputElement;
    expect(packages.value).toBe('1');
    expect(screen.getByTestId('amount-kcal').textContent).toBe('270');
    expect(screen.getByText('450 g')).toBeTruthy();

    fireEvent.change(packages, { target: { value: '2' } });
    expect(screen.getByTestId('amount-kcal').textContent).toBe('540');
    expect(screen.getByText('opakowania')).toBeTruthy();
    expect(screen.getByText('900 g')).toBeTruthy();
    expect(screen.getByText('2 opakowania (900 g)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: ADD }));
    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 900, measure_code: 'package', measure_amount: 2,
    }));
  });

  it('shows the package in millilitres for drinks', async () => {
    mocks.getProduct.mockResolvedValue(withMeasures({ ...SKYR, unit: '100ml' }, measure('package', 330)));
    renderDetails();

    await screen.findByDisplayValue('100');
    expect(unitOptions()).toContain(t('amount.measureOf', { name: 'opakowanie', amount: '330 ml' }));
    expect(screen.getByText(t('product.kcalPer100', { kcal: 60, unit: 'ml' }))).toBeTruthy();
  });

  it('does not offer packages when the package weight is unknown', async () => {
    mocks.getProduct.mockResolvedValue(SKYR);
    renderDetails();

    await screen.findByDisplayValue('100');
    expect(screen.queryByLabelText(t('amount.unit'))).toBeNull();
    expect(screen.queryByLabelText(PACKAGES)).toBeNull();
    expect(screen.getByText(t('product.kcalPer100', { kcal: 60, unit: 'g' }))).toBeTruthy();
  });
});

describe('ProductDetails kitchen measures', () => {
  const MILK = withGenericMeasures(withMeasures({ ...SKYR, name: 'Mleko', kcal: 60, unit: '100ml' }, measure('cup', 250)));

  it('adds a product in a kitchen measure it does not have in the database', async () => {
    mocks.getProduct.mockResolvedValue(MILK);
    renderDetails();

    await screen.findByDisplayValue('100');
    expect(unitOptions()).toEqual(['ml', 'szklanka (250 ml)', 'łyżka (15 ml)', 'łyżeczka (5 ml)', 'szczypta (0.5 ml)']);
    chooseUnit('tbsp');
    expect(screen.getByLabelText(t('amount.countOf', { name: 'łyżki' }))).toHaveProperty('value', '6.7');
    expect(screen.getByTestId('amount-kcal').textContent).toBe('60');

    fireEvent.change(screen.getByLabelText(t('amount.countOf', { name: 'łyżki' })), { target: { value: '2' } });
    expect(screen.getByTestId('kcal-value').textContent).toBe('18');
    expect(screen.getByText('2 łyżki (30 ml)')).toBeTruthy();

    chooseUnit('tsp');
    expect(screen.getByLabelText(t('amount.countOf', { name: 'łyżeczki' }))).toHaveProperty('value', '6');
    fireEvent.change(screen.getByLabelText(t('amount.countOf', { name: 'łyżeczki' })), { target: { value: '2' } });
    expect(screen.getByTestId('kcal-value').textContent).toBe('6');
    fireEvent.click(screen.getByRole('button', { name: ADD }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 10, measure_code: 'tsp', measure_amount: 2,
    }));
  });

  it('opens a plan item saved in a kitchen measure in that measure', async () => {
    mocks.getProduct.mockResolvedValue(MILK);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 1.5, measure_code: 'pinch', measure_amount: 3 }]);
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(t('amount.unit')) as HTMLSelectElement).value).toBe('pinch'));
    expect(screen.getByLabelText(t('amount.countOf', { name: 'szczypty' }))).toHaveProperty('value', '3');
    expect((screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('3 szczypty (1.5 ml)')).toBeTruthy();
  });

  it('keeps the amount within the limit of the newly chosen kitchen measure', async () => {
    mocks.getProduct.mockResolvedValue(withGenericMeasures(withMeasures({ ...SKYR, unit: '100ml' })));
    renderDetails();

    await screen.findByDisplayValue('100');
    chooseUnit('cup');
    const cups = () => screen.getByLabelText(t('amount.countOf', { name: 'szklanki' })) as HTMLInputElement;
    expect(cups().value).toBe('0.4');
    fireEvent.change(cups(), { target: { value: '80' } });
    expect(cups().value).toBe('0.4');
    fireEvent.change(cups(), { target: { value: '20' } });
    chooseUnit('tbsp');
    expect(screen.getByLabelText(t('amount.countOf', { name: 'łyżki' }))).toHaveProperty('value', '100');
    chooseUnit('cup');

    expect(cups().value).toBe('6');
    expect((screen.getByRole('button', { name: ADD }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('offers no kitchen measures for products counted in pieces', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, unit: 'pc', generic_measures: [measure('tbsp', 15)] });
    renderDetails();
    await screen.findByLabelText(t('amount.pieces'));
    expect(screen.queryByLabelText(t('amount.unit'))).toBeNull();
    expect(screen.getByText(t('product.kcalPerPiece', { kcal: 60 }))).toBeTruthy();
  });
});

describe('ProductDetails measures', () => {
  const BANANA = withMeasures({ ...SKYR, name: 'Banan', kcal: 90 }, measure('piece', 120, true), measure('slice', 10));

  it('starts with the default measure and adds another one to the plan with its weight', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    renderDetails();

    const pieces = await screen.findByLabelText(PIECES) as HTMLInputElement;
    expect(pieces.value).toBe('1');
    expect(screen.getByTestId('kcal-value').textContent).toBe('108');

    chooseUnit('slice');
    fireEvent.change(screen.getByLabelText(t('amount.countOf', { name: 'plasterki' })), { target: { value: '3' } });
    expect(screen.getByTestId('kcal-value').textContent).toBe('27');
    fireEvent.click(screen.getByRole('button', { name: ADD }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 30, measure_code: 'slice', measure_amount: 3,
    }));
  });

  it('adds grams without a measure', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    renderDetails();

    await screen.findByLabelText(PIECES);
    chooseUnit('g');
    fireEvent.change(screen.getByLabelText(t('amount.grams')), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: ADD }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 150, measure_code: null, measure_amount: null,
    }));
  });

  it('opens a plan item in the measure it was saved in and saves a switch to grams', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 240, measure_code: 'piece', measure_amount: 2 }]);
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(PIECES) as HTMLInputElement).value).toBe('2'));
    const update = screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);

    chooseUnit('g');
    fireEvent.change(screen.getByLabelText(t('amount.grams')), { target: { value: '240' } });
    expect(update.disabled).toBe(false);
    fireEvent.click(update);

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 240, measure_code: null, measure_amount: null });
  });

  it('opens a plan item in its saved grams when the measure weight has changed since', async () => {
    mocks.getProduct.mockResolvedValue(withMeasures(SKYR, measure('piece', 150, true)));
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 240, measure_code: 'piece', measure_amount: 2 }]);
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(t('amount.grams')) as HTMLInputElement).value).toBe('240'));
    expect((screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement).disabled).toBe(true);
    chooseUnit('piece');
    expect((screen.getByLabelText(PIECES) as HTMLInputElement).value).toBe('1.6');
  });

  it('opens a plan item in grams when its measure is no longer offered', async () => {
    mocks.getProduct.mockResolvedValue(BANANA);
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 60, measure_code: 'tbsp', measure_amount: 4 }]);
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(t('amount.grams')) as HTMLInputElement).value).toBe('60'));
    expect(screen.getByTestId('kcal-value').textContent).toBe('54');
  });

  it('counts products sold per piece in pieces', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, name: 'Jajko', kcal: 75, unit: 'pc' });
    renderDetails();

    const pieces = await screen.findByLabelText(t('amount.pieces')) as HTMLInputElement;
    expect(pieces.value).toBe('1');
    expect(screen.getByTestId('kcal-value').textContent).toBe('75');
    fireEvent.change(pieces, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: ADD }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({
      portions_consumed: 2, measure_code: null, measure_amount: null,
    }));
  });
});

describe('ProductDetails nutrition table', () => {
  it('opens one table per 100 g from the arrow next to the rings', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, saturated_fat: 0.1, sugars: 2.5, fiber: 0, salt: 0.12 });
    renderDetails();

    const toggle = await screen.findByRole('button', { name: t('nutrients.showTable') });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe(t('nutrients.hideTable'));
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual([t('nutrients.name'), '100 g']);
    expect(screen.getAllByRole('rowheader').map(header => header.textContent)).toEqual([
      'Wartość energetyczna', 'Białko', 'Tłuszcz', 'Kwasy tłuszczowe nasycone', 'Węglowodany', 'Cukry', 'Błonnik', 'Sól',
    ]);
    expect(within(screen.getByRole('row', { name: /Cukry/ })).getByRole('cell').textContent).toBe('2.5 g');
    expect(within(screen.getByRole('row', { name: /Sól/ })).getByRole('cell').textContent).toBe('0.12 g');

    fireEvent.click(toggle);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a dash for missing values and per 100 ml for liquids', async () => {
    mocks.getProduct.mockResolvedValue({ ...SKYR, unit: '100ml', fat: null });
    renderDetails();

    fireEvent.click(await screen.findByRole('button', { name: t('nutrients.showTable') }));
    expect(screen.getByRole('columnheader', { name: '100 ml' })).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /^Tłuszcz/ })).getByRole('cell').textContent).toBe('-');
    expect(screen.getAllByText('-')).toHaveLength(5);
  });
});

describe('ProductDetails saving and ownership', () => {
  const BASE = { ...SKYR, status: 'VERIFIED', source: 'OPEN_FOOD_FACTS', created_by: null, bar_code: '5900820000318' };
  const OWN = { ...SKYR, status: 'PENDING', source: 'USER', created_by: 'user-1' };

  it('closes the menu and the header pickers when tapping outside them', async () => {
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();
    await screen.findByRole('button', { name: t('product.menu') });

    openMenu();
    expect(screen.getByRole('menu')).toBeTruthy();
    tapOutside();
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /II śniadanie, Sobota, 17\.10\. Zmień porę lub dzień/ }));
    expect(screen.getByRole('button', { name: 'Kolacja' })).toBeTruthy();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('button', { name: 'Kolacja' })).toBeNull();
  });

  it('saves and unsaves a base product from the first menu item', async () => {
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();
    await screen.findByRole('button', { name: t('product.menu') });

    expect(screen.queryByRole('button', { name: t('food.save', { name: 'Skyr' }) })).toBeNull();
    openMenu();
    expect(screen.getAllByRole('menuitem')[0].textContent).toContain(t('product.save'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Zapisz produkt/ }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('p1'));
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu();
    expect(screen.getAllByRole('menuitem')[0].textContent).toContain(t('product.unsave'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Usuń z zapisanych/ }));
    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith('p1'));
  });

  it('shows saving again in the menu when saving fails', async () => {
    mocks.save.mockRejectedValue(new Error('offline'));
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();
    await screen.findByRole('button', { name: t('product.menu') });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Zapisz produkt/ }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());

    openMenu();
    expect(await screen.findByRole('menuitem', { name: /Zapisz produkt/ })).toBeTruthy();
  });

  it('offers removing from saved once, then an own version instead of edit and delete on a base product', async () => {
    mocks.saved.mockResolvedValue([{ id: 'p1' }]);
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();
    await screen.findByRole('button', { name: t('product.menu') });

    openMenu();
    await screen.findByRole('menuitem', { name: /Usuń z zapisanych/ });
    expect(screen.getAllByRole('menuitem')[0].textContent).toContain(t('product.unsave'));
    expect(screen.queryByRole('menuitem', { name: /Edytuj/ })).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getAllByRole('menuitem', { name: /Usuń z zapisanych/ })).toHaveLength(1);
    expect(screen.getAllByRole('menuitem')[1].textContent).toContain(t('product.makeOwnVersion'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Usuń z zapisanych/ }));

    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith('p1'));
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /Usuń z zapisanych/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Zapisz produkt/ })).toBeTruthy();
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

  it('marks Calendories base products', async () => {
    mocks.getProduct.mockResolvedValue({ ...BASE, source: 'BASIC', bar_code: null });
    renderDetails();

    expect(await screen.findByText('Calendories')).toBeTruthy();
    expect(screen.queryByText('niezweryfikowany')).toBeNull();
  });

  it('does not mark Open Food Facts products as Calendories products', async () => {
    mocks.getProduct.mockResolvedValue(BASE);
    renderDetails();

    await screen.findByRole('button', { name: t('product.menu') });
    expect(screen.queryByText('Calendories')).toBeNull();
  });

  it('lets the author edit and delete their own product and shows its labels', async () => {
    mocks.getProduct.mockResolvedValue(OWN);
    mocks.update.mockResolvedValue({ ...OWN, name: 'Skyr waniliowy' });
    renderDetails();

    expect(await screen.findByText('Twój')).toBeTruthy();
    expect(screen.getByText('niezweryfikowany')).toBeTruthy();

    openMenu();
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      expect.stringContaining(t('product.save')),
      expect.stringContaining(t('product.edit')),
      expect.stringContaining(t('product.delete')),
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Edytuj/ }));
    fireEvent.change(screen.getByLabelText(t('productForm.name')), { target: { value: 'Skyr waniliowy' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz zmiany/ }));

    expect(await screen.findByRole('heading', { name: 'Skyr waniliowy' })).toBeTruthy();
    expect(mocks.update).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Skyr waniliowy' }));

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Usuń/ }));
    expect(screen.getByRole('alertdialog', { name: `${t('product.deleteTitle')} Skyr waniliowy` })).toBeTruthy();
    expect(screen.getByText(t('product.deleteText'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('product.cancel') }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

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
    return screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;
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

    await screen.findByDisplayValue('100');
    chooseUnit('piece');
    const pieces = screen.getByLabelText(PIECES) as HTMLInputElement;
    expect(pieces.value).toBe('2');
    fireEvent.change(pieces, { target: { value: '101' } });
    expect(pieces.value).toBe('2');
    chooseUnit('cup');
    const cups = screen.getByLabelText(t('amount.countOf', { name: 'szklanki' })) as HTMLInputElement;
    fireEvent.change(cups, { target: { value: '51' } });
    expect(cups.value).toBe('0.4');
    chooseUnit('package');
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
    expect(screen.getByTestId('amount-kcal').textContent).toBe('45 tys.');
  });
});

describe('ProductDetails day balance preview', () => {
  const TARGETS = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };

  beforeEach(() => {
    mocks.profile = TARGETS;
    mocks.getProduct.mockResolvedValue(SKYR);
  });

  it('counts the day picked in the header sheet', async () => {
    mocks.getConsumedForDay.mockImplementation((date: string) =>
      date === '2026-10-18' ? { kcal: 1400, protein: 70, fat: 40, carbs: 150 } : { kcal: 500, protein: 20, fat: 10, carbs: 60 });
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: /Zmień porę lub dzień/ }));
    const sheet = within(screen.getByRole('dialog', { name: t('planTarget.whereTitle') }));
    fireEvent.click(sheet.getByRole('button', { name: 'Niedziela, 18.10' }));
    fireEvent.click(sheet.getByRole('button', { name: t('dayBalance.title') }));
    expect(sheet.getByTestId('balance-kcal').textContent).toBe('1460');
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.set', { meal: 'II śniadanie', day: 'nd 18.10' }) }));

    expect(screen.getByRole('button', { name: /II śniadanie, Niedziela, 18\.10/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.title') }));
    expect(screen.getByTestId('balance-kcal').textContent).toBe('1460');
    expect(screen.getByTestId('balance-kcal-added').style.width).not.toBe('0%');
    expect(mocks.getConsumedForDay).toHaveBeenLastCalledWith('2026-10-18', null);
  });

  it('shows the current day as the balance after opening a plan item without changes', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 200 }]);
    mocks.getConsumedForDay.mockImplementation((_date: string, excludedMealId: string | null) =>
      excludedMealId === 'm1' ? { kcal: 880, protein: 26, fat: 30, carbs: 94 } : { kcal: 1000, protein: 50, fat: 30, carbs: 100 });
    renderDetails('?selectDate=2026-10-17&selectType=lunch&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('amount.grams')) as HTMLInputElement).value).toBe('200'));

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.title') }));
    expect(screen.getByTestId('balance-kcal').textContent).toBe('1000');

    expect(screen.getByTestId('balance-kcal-change').textContent).toBe('');

    fireEvent.change(screen.getByLabelText(t('amount.grams')), { target: { value: '300' } });
    expect(screen.getByTestId('balance-kcal').textContent).toBe('1060');
    expect(screen.getByTestId('balance-kcal-change').textContent).toBe('+60');
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }));
    expect(screen.getByTestId('balance-kcal').textContent).toBe('1000');
    expect(screen.getByTestId('balance-kcal-added').style.width).toBe('0%');
  });
});
