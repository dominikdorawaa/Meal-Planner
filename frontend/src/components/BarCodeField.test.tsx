import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../lib/apiClient';
import { BarCodeField } from './BarCodeField';

vi.mock('./LazyBarcodeScanner', () => ({
  LazyBarcodeScanner: ({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) => (
    <div role="dialog">
      <button type="button" onClick={() => onDetected('5900820000318')}>detect</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));

const existing = { id: 'p1', name: 'Skyr naturalny', brand: 'Piątnica' } as Product;

function renderField(existingProduct: Product | null = null, value = '') {
  const onChange = vi.fn();
  render(
    <MemoryRouter>
      <BarCodeField
        value={value}
        onChange={onChange}
        existingProduct={existingProduct}
        existingProductAction={{ href: product => `/product/${product.id}` }}
      />
    </MemoryRouter>
  );
  return { onChange };
}

afterEach(cleanup);

describe('BarCodeField', () => {
  it('keeps only the digits of a typed code', () => {
    const { onChange } = renderField();

    fireEvent.change(screen.getByLabelText('Kod kreskowy'), { target: { value: '590 0820-000318' } });

    expect(onChange).toHaveBeenCalledWith('5900820000318');
  });

  it('fills the field with a scanned code and closes the scanner', () => {
    const { onChange } = renderField();

    fireEvent.click(screen.getByRole('button', { name: 'Zeskanuj kod kreskowy' }));
    fireEvent.click(screen.getByRole('button', { name: 'detect' }));

    expect(onChange).toHaveBeenCalledWith('5900820000318');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the scanner without changing the code', () => {
    const { onChange } = renderField();

    fireEvent.click(screen.getByRole('button', { name: 'Zeskanuj kod kreskowy' }));
    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('links to the product that already has the code', () => {
    renderField(existing, '5900820000318');

    expect(screen.getByRole('alert').textContent).toContain('Ten produkt już istnieje');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/product/p1');
  });

  it('shows no warning when no product has the code', () => {
    renderField(null, '5900820000318');

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
