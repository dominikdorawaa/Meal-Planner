import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NewProductSheet, type NewProductDraft } from './NewProductSheet';
import { t } from '../i18n';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  existing: { checking: false, product: null as null | { id: string; name: string } },
}));

vi.mock('../lib/apiClient', () => ({
  api: { products: { create: mocks.createProduct } },
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
      <NewProductSheet draft={draft} {...handlers} {...props} />
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
      name: 'Skyr', brand: 'Piątnica', bar_code: '5900820000318', sugars: 4, salt: 0.1, package_weight: null, unit: '100g',
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

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Błąd przy tworzeniu produktu: offline'));
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
    renderSheet({ barCode: '5900820000318', prefill: SKYR }, { onOpenProduct: undefined, productHref: product => `/product/${product.id}?x=1` });

    expect(within(screen.getByRole('alert')).getByRole('link').getAttribute('href')).toBe('/product/p9?x=1');
  });

  it('closes from the close button and the backdrop', () => {
    const { onClose } = renderSheet({});

    fireEvent.click(screen.getByText('close').closest('button')!);
    fireEvent.click(screen.getByText('Nowy produkt').closest('.fixed')!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores letters and signs in number fields', () => {
    renderSheet({});

    const kcal = screen.getAllByPlaceholderText('0')[0];
    expect(fireEvent.keyDown(kcal, { key: 'e' })).toBe(false);
    expect(fireEvent.keyDown(kcal, { key: '5' })).toBe(true);
    expect(fireEvent.keyDown(screen.getAllByPlaceholderText('0')[1], { key: '-' })).toBe(false);
    expect(fireEvent.keyDown(screen.getByLabelText(t('product.packageWeight')), { key: '+' })).toBe(false);
  });
});
