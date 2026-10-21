import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NewProductSheet, type NewProductDraft } from './NewProductSheet';
import { draftFromProduct } from '../lib/productDraft';
import { t } from '../i18n';
import { MEASURE_KINDS, measure, withMeasures } from '../lib/measureFixtures';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  createOwnVersion: vi.fn(),
  listMeasureKinds: vi.fn(),
  existing: { checking: false, product: null as null | { id: string; name: string } },
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    products: { create: mocks.createProduct, update: mocks.updateProduct, createOwnVersion: mocks.createOwnVersion },
    measureKinds: { list: mocks.listMeasureKinds },
  },
}));

vi.mock('../lib/useExistingBarCodeProduct', () => ({
  useExistingBarCodeProduct: () => mocks.existing,
}));

const SKYR = { name: 'Skyr', kcal: 65, protein: 12, fat: 0, carbs: 4 };
const alertMock = vi.fn();

function renderSheet(draft: NewProductDraft, props: Partial<Parameters<typeof NewProductSheet>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onCreated: vi.fn(), onOpenProduct: vi.fn() };
  render(
    <MemoryRouter>
      <NewProductSheet
        draft={draft}
        onClose={handlers.onClose}
        onCreated={handlers.onCreated}
        existingProductAction={{ onOpen: handlers.onOpenProduct }}
        {...props}
      />
    </MemoryRouter>
  );
  return handlers;
}

function saveButton() {
  return screen.getByRole('button', { name: /Dodaj produkt/ }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.stubGlobal('alert', alertMock);
  mocks.existing = { checking: false, product: null };
  mocks.listMeasureKinds.mockResolvedValue(MEASURE_KINDS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('NewProductSheet', () => {
  it('creates the product with every filled value and hands it back', async () => {
    mocks.createProduct.mockResolvedValue({ id: 'p1', ...SKYR });
    const { onCreated } = renderSheet({ barCode: '5900820000318', prefill: { ...SKYR, sugars: 4 }, message: 'Sprawdź dane' });

    expect(screen.getByText('Sprawdź dane')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('np. Piątnica'), { target: { value: ' Piątnica ' } });
    fireEvent.change(screen.getByLabelText(t('nutrients.salt')), { target: { value: '0.1' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'p1', ...SKYR }));
    expect(mocks.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Skyr', brand: 'Piątnica', bar_code: '5900820000318', sugars: 4, salt: 0.1, measures: [], unit: '100g',
    }));
  });

  it('hides the scan message once the code is changed', () => {
    renderSheet({ barCode: '5900820000318', prefill: SKYR, message: 'Sprawdź dane' });

    fireEvent.change(screen.getByLabelText(t('product.barCode')), { target: { value: '5900820000325' } });

    expect(screen.queryByText('Sprawdź dane')).toBeNull();
  });

  it('keeps the form open and lets the user try again when saving fails', async () => {
    mocks.createProduct.mockRejectedValueOnce(new Error('offline'));
    const { onCreated } = renderSheet({ prefill: SKYR });

    fireEvent.click(saveButton());

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(t('productForm.saveFailed', { message: 'offline' })));
    expect(onCreated).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBe(false);
  });

  it('starts with the searched name and does not save incomplete data', () => {
    renderSheet({ name: 'kasza jaglana' });

    expect((screen.getByPlaceholderText('np. Jogurt naturalny') as HTMLInputElement).value).toBe('kasza jaglana');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it('opens the product that already has this code instead of saving a copy', () => {
    mocks.existing = { checking: false, product: { id: 'p9', name: 'Skyr naturalny' } };
    const { onOpenProduct } = renderSheet({ barCode: '5900820000318', prefill: SKYR });

    expect(saveButton().disabled).toBe(true);
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Skyr naturalny' }));

    expect(onOpenProduct).toHaveBeenCalledWith(mocks.existing.product);
  });

  it('links to the product that already has this code when no handler is given', () => {
    mocks.existing = { checking: false, product: { id: 'p9', name: 'Skyr naturalny' } };
    renderSheet({ barCode: '5900820000318', prefill: SKYR }, { existingProductAction: { href: product => `/product/${product.id}?x=1` } });

    expect(within(screen.getByRole('alert')).getByRole('link').getAttribute('href')).toBe('/product/p9?x=1');
  });

  it('closes from the close button and the backdrop', () => {
    const { onClose } = renderSheet({});

    fireEvent.click(screen.getByText('close').closest('button')!);
    fireEvent.click(screen.getByText('Nowy produkt').closest('.fixed')!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores letters and signs in number fields', async () => {
    renderSheet({});
    fireEvent.click(await screen.findByRole('button', { name: /Dodaj miarę/ }));

    const kcal = screen.getAllByPlaceholderText('0')[0];
    expect(fireEvent.keyDown(kcal, { key: 'e' })).toBe(false);
    expect(fireEvent.keyDown(kcal, { key: '5' })).toBe(true);
    expect(fireEvent.keyDown(screen.getAllByPlaceholderText('0')[1], { key: '-' })).toBe(false);
    expect(fireEvent.keyDown(screen.getByLabelText(t('productForm.measureAmount', { name: 'sztuka', unit: 'g' })), { key: '+' })).toBe(false);
  });
});

describe('NewProductSheet layout and modes', () => {
  const SOURCE = { id: 'p1', name: 'Skyr', kcal: 65, protein: 12, fat: 0, carbs: 4, bar_code: '5900820000318', unit: '100ml' };

  it('puts the bar code at the very bottom under more nutrients', () => {
    renderSheet({});

    const moreNutrients = screen.getByRole('button', { name: t('nutrients.more') });
    const barCode = screen.getByLabelText(t('product.barCode'));
    expect(moreNutrients.compareDocumentPosition(barCode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(t('productForm.newTitle'))).toBeTruthy();
  });

  it('saves changes to an own product without treating its bar code as taken', async () => {
    mocks.existing = { checking: false, product: { id: 'p1', name: 'Skyr' } };
    mocks.updateProduct.mockResolvedValue({ ...SOURCE, name: 'Skyr naturalny' });
    const { onCreated } = renderSheet(draftFromProduct(SOURCE), { mode: 'edit', source: SOURCE });

    expect(screen.getByText(t('productForm.editTitle'))).toBeTruthy();
    expect(screen.queryByText(t('product.alreadyExists'))).toBeNull();
    fireEvent.change(screen.getByLabelText(t('productForm.name')), { target: { value: 'Skyr naturalny' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz zmiany/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: 'Skyr naturalny' })));
    expect(mocks.updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Skyr naturalny', unit: '100ml', bar_code: '5900820000318' }));
  });

  it('blocks an own version that takes the bar code of another product', () => {
    mocks.existing = { checking: false, product: { id: 'p9', name: 'Kefir' } };
    renderSheet(draftFromProduct(SOURCE), { mode: 'ownVersion', source: SOURCE });

    fireEvent.change(screen.getByLabelText(t('product.barCode')), { target: { value: '5901234123457' } });

    expect(screen.getByText(t('product.alreadyExists'))).toBeTruthy();
    expect((screen.getByRole('button', { name: /Zapisz moją wersję/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets an own version keep an older bar code of the base product', () => {
    const legacy = { ...SOURCE, bar_code: '5901234567894' };
    renderSheet(draftFromProduct(legacy), { mode: 'ownVersion', source: legacy });

    expect(screen.queryByText(t('nutrition.invalid-bar-code'))).toBeNull();
    expect((screen.getByRole('button', { name: /Zapisz moją wersję/ }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText(t('product.barCode')), { target: { value: '5901234567895' } });
    expect((screen.getByRole('button', { name: /Zapisz moją wersję/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves an own version through its own endpoint', async () => {
    mocks.createOwnVersion.mockResolvedValue({ ...SOURCE, id: 'p2' });
    const { onCreated } = renderSheet(draftFromProduct({ ...SOURCE, bar_code: null }), { mode: 'ownVersion', source: { ...SOURCE, bar_code: null } });

    fireEvent.click(screen.getByRole('button', { name: /Zapisz moją wersję/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' })));
    expect(mocks.createOwnVersion).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Skyr', bar_code: null }));
  });
});

describe('NewProductSheet limits', () => {
  function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement;
  }

  it('does not accept per 100 g values above the validator limits', () => {
    renderSheet({});

    fireEvent.change(field(t('productForm.kcal')), { target: { value: '900' } });
    fireEvent.change(field(t('productForm.kcal')), { target: { value: '901' } });
    expect(field(t('productForm.kcal')).value).toBe('900');

    for (const label of [t('productForm.protein'), t('productForm.carbs'), t('productForm.fat')]) {
      fireEvent.change(field(label), { target: { value: '100' } });
      fireEvent.change(field(label), { target: { value: '100.5' } });
      expect(field(label).value).toBe('100');
    }
  });

  it('accepts two decimal places for nutrition values', () => {
    renderSheet({});

    fireEvent.change(field(t('productForm.protein')), { target: { value: '12.34' } });
    expect(field(t('productForm.protein')).value).toBe('12.34');
    fireEvent.change(field(t('productForm.protein')), { target: { value: '12.345' } });
    expect(field(t('productForm.protein')).value).toBe('12.34');
  });

  it('does not limit values of products counted per piece', () => {
    renderSheet(draftFromProduct({ id: 'p9', name: 'Pizza', kcal: 1200, protein: 50, fat: 40, carbs: 150, unit: 'pc' } as never), {
      mode: 'edit',
      source: { id: 'p9', name: 'Pizza', kcal: 1200, protein: 50, fat: 40, carbs: 150, unit: 'pc' } as never,
    });

    fireEvent.change(field(t('productForm.kcal')), { target: { value: '1500' } });
    expect(field(t('productForm.kcal')).value).toBe('1500');
  });

  it('turns off autofill suggestions in every field', async () => {
    renderSheet({});
    fireEvent.click(await screen.findByRole('button', { name: /Dodaj miarę/ }));

    expect(field(t('productForm.name')).getAttribute('autocomplete')).toBe('off');
    expect(field(t('productForm.brand')).getAttribute('autocomplete')).toBe('off');
    expect(field(t('productForm.kcal')).getAttribute('inputmode')).toBe('decimal');
    expect(field(t('productForm.measureAmount', { name: 'sztuka', unit: 'g' })).getAttribute('autocomplete')).toBe('off');
  });

  it('locks the page behind the open sheet', () => {
    renderSheet({});

    expect(document.querySelector('[data-scroll-lock]')).not.toBeNull();
  });
});

describe('NewProductSheet measures', () => {
  const amountField = (name: string, unit = 'g') =>
    screen.getByLabelText(t('productForm.measureAmount', { name, unit })) as HTMLInputElement;
  const findAmountField = async (name: string, unit = 'g') =>
    (await screen.findByLabelText(t('productForm.measureAmount', { name, unit }))) as HTMLInputElement;
  const addMeasure = async () => fireEvent.click(await screen.findByRole('button', { name: /Dodaj miarę/ }));

  it('fills the package from Open Food Facts and sends it as a measure', async () => {
    mocks.createProduct.mockResolvedValue({ id: 'p1', ...SKYR });
    renderSheet({ prefill: { ...SKYR, package_weight: 450 } });

    expect((await findAmountField('opakowanie')).value).toBe('450');
    fireEvent.click(saveButton());

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      measures: [{ code: 'package', base_amount: 450, default: false }],
    })));
  });

  it('adds own measures, marks one as default and changes their kind', async () => {
    mocks.createProduct.mockResolvedValue({ id: 'p1', ...SKYR });
    renderSheet({ prefill: SKYR });

    await addMeasure();
    fireEvent.change(amountField('sztuka'), { target: { value: '120.5' } });
    fireEvent.click(screen.getByRole('button', { name: t('productForm.measureDefault', { name: 'sztuka' }) }));
    await addMeasure();
    fireEvent.change(screen.getByLabelText(t('productForm.measureKind', { index: 2 })), { target: { value: 'tbsp' } });
    fireEvent.change(amountField('łyżka'), { target: { value: '15' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      measures: [{ code: 'piece', base_amount: 120.5, default: true }, { code: 'tbsp', base_amount: 15, default: false }],
    })));
    expect(screen.getByRole('button', { name: t('productForm.measureDefault', { name: 'sztuka' }) }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers each kind only once and hides adding when every kind is used', async () => {
    renderSheet({ prefill: SKYR });

    for (let i = 0; i < MEASURE_KINDS.length; i++) await addMeasure();

    expect(screen.queryByRole('button', { name: /Dodaj miarę/ })).toBeNull();
    const lastKind = screen.getByLabelText(t('productForm.measureKind', { index: 6 })) as HTMLSelectElement;
    expect([...lastKind.options].map(option => option.value)).toEqual(['package']);
  });

  it('removes measures and skips ones left empty', async () => {
    mocks.createProduct.mockResolvedValue({ id: 'p1', ...SKYR });
    renderSheet({ prefill: { ...SKYR, package_weight: 450 } });

    await findAmountField('opakowanie');
    fireEvent.click(screen.getByRole('button', { name: t('productForm.measureRemove', { name: 'opakowanie' }) }));
    await addMeasure();
    fireEvent.click(saveButton());

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith(expect.objectContaining({ measures: [] })));
  });

  it('blocks saving a measure that weighs nothing', async () => {
    renderSheet({ prefill: SKYR });

    await addMeasure();
    fireEvent.change(amountField('sztuka'), { target: { value: '0' } });

    expect(screen.getByText(t('productForm.measureInvalid', { max: 5 }))).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    fireEvent.change(amountField('sztuka'), { target: { value: '5001' } });
    expect(amountField('sztuka').value).toBe('0');
  });

  it('edits the measures of a product without its base unit and keeps unknown kinds', async () => {
    mocks.updateProduct.mockResolvedValue({ id: 'p2' });
    const source = withMeasures(
      { id: 'p2', name: 'Mleko', kcal: 60, protein: 3, fat: 3, carbs: 5, unit: '100ml' },
      measure('cup', 250, true),
      { code: 'handful', base_amount: 30, default: false, names: { pl: { one: 'garść' } }, max_amount: 10 },
    );
    renderSheet(draftFromProduct(source as never), { mode: 'edit', source: source as never });

    expect(amountField('szklanka', 'ml').value).toBe('250');
    expect(amountField('garść', 'ml').value).toBe('30');
    fireEvent.click(screen.getByRole('button', { name: t('productForm.measureDefault', { name: 'szklanka' }) }));
    fireEvent.click(screen.getByRole('button', { name: /Zapisz zmiany/ }));

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledWith('p2', expect.objectContaining({
      unit: '100ml',
      measures: [{ code: 'cup', base_amount: 250, default: false }, { code: 'handful', base_amount: 30, default: false }],
    })));
  });

  it('has no measures for products counted per piece and works without the list of kinds', async () => {
    mocks.listMeasureKinds.mockRejectedValue(new Error('offline'));
    renderSheet({ prefill: SKYR }, { mode: 'edit', source: { id: 'p9', ...SKYR, unit: 'pc' } as never });

    await waitFor(() => expect(mocks.listMeasureKinds).toHaveBeenCalled());
    expect(screen.queryByText(t('productForm.measures'))).toBeNull();
  });
});
