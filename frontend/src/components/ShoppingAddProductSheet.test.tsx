import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShoppingAddProductSheet } from './ShoppingAddProductSheet';
import { t } from '../i18n';
import { api } from '../lib/apiClient';

const onAdded = vi.fn();
const onClose = vi.fn();

const field = (key: 'shopping.name' | 'shopping.quantity' | 'shopping.unit') => screen.getByLabelText(t(key)) as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole('button', { name: t('shopping.addToList') }));

beforeEach(() => {
  onAdded.mockReset().mockResolvedValue(undefined);
  onClose.mockReset();
  render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShoppingAddProductSheet', () => {
  it('asks for a name and a positive amount before saving', () => {
    const addItem = vi.spyOn(api.shoppingList, 'addItem');

    submit();
    expect(screen.getByRole('alert').textContent).toBe(t('shopping.nameRequired'));

    fireEvent.change(field('shopping.name'), { target: { value: ' Milk ' } });
    fireEvent.change(field('shopping.quantity'), { target: { value: '0' } });
    submit();
    expect(screen.getByRole('alert').textContent).toBe(t('shopping.quantityInvalid'));

    fireEvent.change(field('shopping.quantity'), { target: { value: '' } });
    submit();
    expect(screen.getByRole('alert').textContent).toBe(t('shopping.quantityInvalid'));
    expect(addItem).not.toHaveBeenCalled();
  });

  it('adds the product, reloads the list and closes', async () => {
    const addItem = vi.spyOn(api.shoppingList, 'addItem').mockResolvedValue({} as never);

    fireEvent.change(field('shopping.name'), { target: { value: ' Milk ' } });
    fireEvent.change(field('shopping.quantity'), { target: { value: '2,5' } });
    fireEvent.change(field('shopping.unit'), { target: { value: ' ' } });
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(addItem).toHaveBeenCalledWith({ ingredient_name: 'Milk', quantity: 2.5, unit: 'szt', is_checked: false });
    expect(onAdded).toHaveBeenCalledOnce();
  });

  it('keeps the sheet open and explains when saving fails', async () => {
    vi.spyOn(api.shoppingList, 'addItem').mockRejectedValueOnce(new Error('Server said no')).mockRejectedValueOnce('offline');
    fireEvent.change(field('shopping.name'), { target: { value: 'Milk' } });

    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('Server said no');

    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t('shopping.addFailed')));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the close button', () => {
    fireEvent.click(screen.getByRole('button', { name: t('shopping.close') }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
