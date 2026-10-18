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

  it('downloads the scanner again when the user retries', async () => {
    let fail = true;
    vi.doMock('./BarcodeScanner', () => {
      if (fail) throw new Error('chunk failed');
      return { BarcodeScanner: () => <p>scanner ready</p> };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { LazyBarcodeScanner } = await import('./LazyBarcodeScanner');

    render(<LazyBarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Nie udało się wczytać skanera. Sprawdź połączenie i spróbuj ponownie.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByText('scanner ready')).toBeTruthy();
  });
});

describe('LazyBarcodeScanner back gesture', () => {
  it('closes the scanner when the user goes back', async () => {
    vi.doMock('./BarcodeScanner', () => ({ BarcodeScanner: () => <p>scanner ready</p> }));
    const { installBackNavigation } = await import('../lib/backNavigation');
    const { LazyBarcodeScanner } = await import('./LazyBarcodeScanner');
    const uninstall = installBackNavigation();
    const onClose = vi.fn();

    render(<LazyBarcodeScanner onDetected={vi.fn()} onClose={onClose} />);
    await screen.findByText('scanner ready');
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise<void>(resolve => {
      window.addEventListener('popstate', () => resolve(), { once: true });
      window.history.back();
    });

    expect(onClose).toHaveBeenCalledOnce();
    uninstall();
  });
});
