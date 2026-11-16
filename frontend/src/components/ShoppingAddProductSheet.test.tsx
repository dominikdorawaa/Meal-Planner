import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShoppingAddProductSheet } from './ShoppingAddProductSheet';
import { setLanguage, t } from '../i18n';
import { api } from '../lib/apiClient';

const onAdded = vi.fn();
const onClose = vi.fn();

const field = (key: 'shopping.name' | 'shopping.quantity' | 'shopping.unit') => screen.getByLabelText(t(key)) as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole('button', { name: t('shopping.addToList') }));

beforeEach(() => {
  setLanguage('pl');
  onAdded.mockReset().mockResolvedValue(undefined);
  onClose.mockReset();
});

afterEach(() => {
  cleanup();
  setLanguage('pl');
  vi.restoreAllMocks();
});

describe('ShoppingAddProductSheet', () => {
  it('focuses the name field on open and restores focus to the opener on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    expect(document.activeElement).toBe(field('shopping.name'));

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('asks for a name and a positive amount before saving', () => {
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
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

  it('adds the product with the localized default unit, reloads the list and closes', async () => {
    setLanguage('en');
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    const addItem = vi.spyOn(api.shoppingList, 'addItem').mockResolvedValue({} as never);

    expect(field('shopping.unit').value).toBe('pcs');
    fireEvent.change(field('shopping.name'), { target: { value: ' Milk ' } });
    fireEvent.change(field('shopping.quantity'), { target: { value: '2,5' } });
    fireEvent.change(field('shopping.unit'), { target: { value: ' ' } });
    fireEvent.submit(field('shopping.name'));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(addItem).toHaveBeenCalledWith({ ingredient_name: 'Milk', quantity: 2.5, unit: 'pcs', is_checked: false });
    expect(onAdded).toHaveBeenCalledOnce();
  });

  it('ignores duplicate form submission while saving and explains when saving fails', async () => {
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    let rejectFirst!: (reason?: unknown) => void;
    const addItem = vi.spyOn(api.shoppingList, 'addItem')
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
      .mockRejectedValueOnce('offline');
    fireEvent.change(field('shopping.name'), { target: { value: 'Milk' } });

    submit();
    fireEvent.submit(field('shopping.name'));
    expect(addItem).toHaveBeenCalledTimes(1);

    rejectFirst(new Error('Server said no'));
    expect((await screen.findByRole('alert')).textContent).toBe('Server said no');

    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t('shopping.addFailed')));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the close button', () => {
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: t('shopping.close') }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
