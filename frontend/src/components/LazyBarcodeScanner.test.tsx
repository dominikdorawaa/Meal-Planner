import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.doUnmock('./BarcodeScanner');
  vi.resetModules();
});

describe('LazyBarcodeScanner', () => {
  it('shows the scanner once it has loaded', async () => {
    vi.doMock('./BarcodeScanner', () => ({ BarcodeScanner: () => <p>scanner ready</p> }));
    const { LazyBarcodeScanner } = await import('./LazyBarcodeScanner');

    render(<LazyBarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText('scanner ready')).toBeTruthy();
  });

  it('explains a failed download and lets the user close it without losing the page', async () => {
    vi.doMock('./BarcodeScanner', () => {
      throw new Error('chunk failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { LazyBarcodeScanner } = await import('./LazyBarcodeScanner');
    const onClose = vi.fn();

    render(
      <div>
        <p>recipe form</p>
        <LazyBarcodeScanner onDetected={vi.fn()} onClose={onClose} />
      </div>,
    );

    expect(await screen.findByText('Nie udało się wczytać skanera. Sprawdź połączenie i spróbuj ponownie.')).toBeTruthy();
    expect(screen.getByText('recipe form')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij skaner' }));
    expect(onClose).toHaveBeenCalled();
  });
});
