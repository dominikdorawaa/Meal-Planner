import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarcodeLookupPending } from './BarcodeLookupPending';
import { installBackNavigation } from '../lib/backNavigation';

afterEach(cleanup);

describe('BarcodeLookupPending', () => {
  it('tells the user the code is being looked up and lets them cancel', () => {
    const onCancel = vi.fn();
    render(<BarcodeLookupPending onCancel={onCancel} />);

    expect(screen.getByText('Szukam produktu...')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels the lookup when the user goes back', async () => {
    const uninstall = installBackNavigation();
    const onCancel = vi.fn();
    render(<BarcodeLookupPending onCancel={onCancel} />);

    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise<void>(resolve => {
      window.addEventListener('popstate', () => resolve(), { once: true });
      window.history.back();
    });

    expect(onCancel).toHaveBeenCalledOnce();
    uninstall();
  });
});
