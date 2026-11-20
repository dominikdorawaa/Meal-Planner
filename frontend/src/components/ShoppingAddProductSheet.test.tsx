import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShoppingAddProductSheet } from './ShoppingAddProductSheet';
import { setLanguage, t } from '../i18n';
import { api } from '../lib/apiClient';

const onAdded = vi.fn();
const onClose = vi.fn();

const nameField = () => screen.getByLabelText(t('shopping.name')) as HTMLInputElement;
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
    expect(document.activeElement).toBe(nameField());

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('asks for a name before saving', () => {
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    const addItem = vi.spyOn(api.shoppingList, 'addItem');

    fireEvent.change(nameField(), { target: { value: '   ' } });
    submit();

    expect(screen.getByRole('alert').textContent).toBe(t('shopping.nameRequired'));
    expect(addItem).not.toHaveBeenCalled();
  });

  it('adds the product by name alone, reloads the list and closes', async () => {
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    const addItem = vi.spyOn(api.shoppingList, 'addItem').mockResolvedValue({} as never);

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(nameField().getAttribute('autocomplete')).toBe('off');
    fireEvent.change(nameField(), { target: { value: ' 2 kg potatoes ' } });
    fireEvent.submit(nameField());

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(addItem).toHaveBeenCalledWith({ ingredient_name: '2 kg potatoes', quantity: null, unit: null, is_checked: false });
    expect(onAdded).toHaveBeenCalledOnce();
  });

  it('ignores duplicate form submission while saving and explains when saving fails', async () => {
    render(<ShoppingAddProductSheet onAdded={onAdded} onClose={onClose} />);
    let rejectFirst!: (reason?: unknown) => void;
    const addItem = vi.spyOn(api.shoppingList, 'addItem')
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
      .mockRejectedValueOnce('offline');
    fireEvent.change(nameField(), { target: { value: 'Milk' } });

    submit();
    fireEvent.submit(nameField());
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
