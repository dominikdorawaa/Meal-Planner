import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AddRecipe from './AddRecipe';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  getRecipe: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  searchProducts: vi.fn(),
  createProduct: vi.fn(),
  findProductByBarCode: vi.fn(),
  refreshRecipes: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    recipes: { getById: mocks.getRecipe, create: mocks.createRecipe, update: mocks.updateRecipe },
    products: { search: mocks.searchProducts, create: mocks.createProduct },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({ user: { userId: 'user-1' }, refreshRecipes: mocks.refreshRecipes }),
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

const SKYR = { id: 'p1', name: 'Skyr', brand: 'Piątnica', kcal: 65, protein: 12, fat: 0, carbs: 4, unit: '100g', package_weight: 450 };
const OATS = { id: 'p2', name: 'Płatki owsiane', kcal: 370, protein: 13, fat: 7, carbs: 60, unit: '100g' };
const alertMock = vi.fn();

function renderAddRecipe(path = '/add-recipe') {
  return render(
    <MemoryRouter initialEntries={['/recipes', path]} initialIndex={1}>
      <Routes>
        <Route path="/recipes" element={<p>recipes screen</p>} />
        <Route path="/add-recipe" element={<AddRecipe />} />
        <Route path="/edit-recipe/:id" element={<AddRecipe />} />
      </Routes>
    </MemoryRouter>
  );
}

function searchField() {
  return screen.getByPlaceholderText(t('recipeIngredients.searchPlaceholder')) as HTMLInputElement;
}

function openSearch() {
  fireEvent.click(screen.getByRole('button', { name: /Dodaj składnik/ }));
  return searchField();
}

async function pickSkyr() {
  fireEvent.change(openSearch(), { target: { value: 'sky' } });
  fireEvent.click(await screen.findByRole('button', { name: /Skyr/ }));
}

function ingredientRow(name: string) {
  return screen.getByRole('button', { name: new RegExp(t('recipeIngredients.edit', { name })) });
}

beforeEach(() => {
  vi.stubGlobal('alert', alertMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.searchProducts.mockImplementation(async ({ query }: { query: string }) => ({
    items: [SKYR, OATS].filter(product => product.name.toLowerCase().includes(query.toLowerCase())),
    page: 0,
    size: 20,
    has_next: false,
  }));
  mocks.createRecipe.mockResolvedValue({ id: 'r1' });
  mocks.updateRecipe.mockResolvedValue({ id: 'r1' });
  mocks.refreshRecipes.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AddRecipe ingredient search', () => {
  it('opens an empty search with the keyboard ready and searches only from three letters', async () => {
    renderAddRecipe();

    const field = openSearch();
    expect(field.value).toBe('');
    expect(document.activeElement).toBe(field);
    expect(screen.getByText(t('recipeIngredients.minChars'))).toBeTruthy();

    fireEvent.change(field, { target: { value: 'sk' } });
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(mocks.searchProducts).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'sky' } });
    expect(await screen.findByRole('button', { name: /Skyr/ })).toBeTruthy();
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ query: 'sky' }));
  });

  it('adds a product only after choosing its amount, in packages when the package weight is known', async () => {
    renderAddRecipe();
    await pickSkyr();

    const packages = screen.getByLabelText(t('amount.packages'));
    fireEvent.change(packages, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));

    const row = ingredientRow('Skyr');
    expect(within(row).getByText('2 opak. (900 g)')).toBeTruthy();
    expect(within(row).getByText('585 kcal')).toBeTruthy();
    expect(screen.queryByPlaceholderText(t('recipeIngredients.searchPlaceholder'))).toBeNull();
  });

  it('adds 100 g by default', async () => {
    renderAddRecipe();
    await pickSkyr();

    expect((screen.getByLabelText(t('amount.grams')) as HTMLInputElement).value).toBe('100');
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));

    expect(within(ingredientRow('Skyr')).getByText('100 g')).toBeTruthy();
  });

  it('changes the amount of an ingredient already on the list', async () => {
    renderAddRecipe();
    await pickSkyr();
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));

    fireEvent.click(ingredientRow('Skyr'));
    fireEvent.change(screen.getByLabelText(t('amount.grams')), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.save') }));

    expect(within(ingredientRow('Skyr')).getByText('250 g')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: new RegExp(t('recipeIngredients.edit', { name: 'Skyr' })) })).toHaveLength(1);
  });

  it('closes the search without adding anything', () => {
    renderAddRecipe();
    openSearch();

    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.close') }));

    expect(screen.queryByPlaceholderText(t('recipeIngredients.searchPlaceholder'))).toBeNull();
  });

  it('removes an ingredient after confirming', async () => {
    renderAddRecipe();
    await pickSkyr();
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));

    fireEvent.click(within(ingredientRow('Skyr').parentElement as HTMLElement).getAllByRole('button').at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Usuń' }));

    expect(screen.queryByRole('button', { name: new RegExp(t('recipeIngredients.edit', { name: 'Skyr' })) })).toBeNull();
  });

  it('goes back from the amount screen to the search without adding anything', async () => {
    renderAddRecipe();
    await pickSkyr();

    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.back') }));

    expect(searchField().value).toBe('sky');
    expect(screen.queryByRole('button', { name: new RegExp(t('recipeIngredients.edit', { name: 'Skyr' })) })).toBeNull();
  });

  it('offers adding or scanning a product when nothing matches', async () => {
    mocks.createProduct.mockResolvedValue({ ...OATS, id: 'p7', name: 'Kasza jaglana' });
    renderAddRecipe();
    fireEvent.change(openSearch(), { target: { value: 'kasza jaglana' } });

    expect(await screen.findByText(t('recipeIngredients.noResults'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('recipeIngredients.scan') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.addProduct') }));

    const sheet = within(screen.getByText('Nowy produkt').closest('[class*="rounded-t-"]') as HTMLElement);
    expect((sheet.getByPlaceholderText('np. Jogurt naturalny') as HTMLInputElement).value).toBe('kasza jaglana');
    fireEvent.change(sheet.getByPlaceholderText('np. Jogurt naturalny'), { target: { value: 'Kasza jaglana' } });
    for (const [index, value] of ['359', '11', '72', '3'].entries()) {
      fireEvent.change(sheet.getAllByPlaceholderText('0')[index], { target: { value } });
    }
    fireEvent.click(sheet.getByRole('button', { name: /Dodaj produkt/ }));

    await screen.findByRole('button', { name: t('recipeIngredients.add') });
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));
    expect(ingredientRow('Kasza jaglana')).toBeTruthy();
  });

  it('adds a scanned product through the amount screen', async () => {
    mocks.findProductByBarCode.mockResolvedValue({ product: SKYR, prefill: null });
    renderAddRecipe();
    openSearch();

    fireEvent.click(screen.getByRole('button', { name: t('scanner.title') }));
    fireEvent.click(screen.getByText('detect code'));

    fireEvent.click(await screen.findByRole('button', { name: t('recipeIngredients.add') }));
    expect(ingredientRow('Skyr')).toBeTruthy();
  });

  it('opens the new product form with the scanned code when the product is missing', async () => {
    mocks.findProductByBarCode.mockResolvedValue({ product: null, prefill: { name: 'Skyr', package_weight: 450 } });
    renderAddRecipe();
    openSearch();

    fireEvent.click(screen.getByRole('button', { name: t('scanner.title') }));
    fireEvent.click(screen.getByText('detect code'));

    await waitFor(() => expect((screen.getByLabelText(t('product.barCode')) as HTMLInputElement).value).toBe('5900820000318'));
    expect((screen.getByLabelText(t('product.packageWeight')) as HTMLInputElement).value).toBe('450');
  });
});

describe('AddRecipe saving', () => {
  it('saves ingredients with their unit and product and the recipe totals', async () => {
    renderAddRecipe();
    fireEvent.change(screen.getByPlaceholderText('np. Owsianka z malinami'), { target: { value: 'Miska skyru' } });
    await pickSkyr();
    fireEvent.focus(screen.getByLabelText(t('amount.packages')));
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    await screen.findByText('recipes screen');
    expect(mocks.createRecipe).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Miska skyru',
      kcal: 293,
      protein: 54,
      fat: 0,
      carbs: 18,
      ingredients: [{ name: 'Skyr', amount: 1, unit: 'opak', product: { id: 'p1' } }],
    }));
  });

  it('counts ingredients of an edited recipe from their products', async () => {
    mocks.getRecipe.mockResolvedValue({
      id: 'r1', name: 'Owsianka', kcal: 500, protein: 20, fat: 10, carbs: 80, portions: 1, instructions: [],
      ingredients: [
        { id: 'i1', name: 'Płatki owsiane', amount: 50, unit: 'g', product: OATS },
        { id: 'i2', name: 'Miód', amount: 1, unit: 'łyżka', product: null },
      ],
    });
    renderAddRecipe('/edit-recipe/r1');

    expect(within(await screen.findByRole('button', { name: new RegExp(t('recipeIngredients.edit', { name: 'Płatki owsiane' })) }))
      .getByText('185 kcal')).toBeTruthy();
    await pickSkyr();
    fireEvent.click(screen.getByRole('button', { name: t('recipeIngredients.add') }));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    await screen.findByText('recipes screen');
    expect(mocks.updateRecipe).toHaveBeenCalledWith('r1', expect.objectContaining({
      kcal: 250,
      ingredients: [
        { name: 'Płatki owsiane', amount: 50, unit: 'g', product: { id: 'p2' } },
        { name: 'Miód', amount: 1, unit: 'łyżka', product: null },
        { name: 'Skyr', amount: 100, unit: 'g', product: { id: 'p1' } },
      ],
    }));
  });
});

describe('AddRecipe leaving', () => {
  it('leaves at once when nothing was changed', () => {
    renderAddRecipe();

    fireEvent.click(screen.getByRole('button', { name: t('recipe.close') }));

    expect(screen.getByText('recipes screen')).toBeTruthy();
  });

  it('asks before discarding changes and stays when asked to', async () => {
    renderAddRecipe();
    fireEvent.change(screen.getByPlaceholderText('np. Owsianka z malinami'), { target: { value: 'Miska skyru' } });

    fireEvent.click(screen.getByRole('button', { name: t('recipe.close') }));
    expect(screen.getByText(t('recipe.leaveTitle'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipe.leaveStay') }));

    expect(screen.queryByText(t('recipe.leaveTitle'))).toBeNull();
    expect((screen.getByPlaceholderText('np. Owsianka z malinami') as HTMLInputElement).value).toBe('Miska skyru');

    fireEvent.click(screen.getByRole('button', { name: t('recipe.close') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipe.leaveDiscard') }));
    expect(await screen.findByText('recipes screen')).toBeTruthy();
    expect(mocks.createRecipe).not.toHaveBeenCalled();
  });

  it('asks after a step was written and keeps the recipe when the dialog is dismissed', () => {
    renderAddRecipe();
    fireEvent.click(screen.getByRole('button', { name: /Dodaj krok/ }));
    fireEvent.change(screen.getByPlaceholderText('Krok 1...'), { target: { value: 'Wymieszaj' } });

    fireEvent.click(screen.getByRole('button', { name: t('recipe.close') }));
    fireEvent.click(screen.getByRole('alertdialog').parentElement!);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByDisplayValue('Wymieszaj')).toBeTruthy();
  });

  it('does not ask after the recipe was loaded for editing without changes', async () => {
    mocks.getRecipe.mockResolvedValue({ id: 'r1', name: 'Owsianka', kcal: 500, protein: 20, fat: 10, carbs: 80, portions: 1, ingredients: [] });
    renderAddRecipe('/edit-recipe/r1');
    await screen.findByDisplayValue('Owsianka');

    fireEvent.click(screen.getByRole('button', { name: t('recipe.close') }));

    expect(screen.getByText('recipes screen')).toBeTruthy();
  });
});
