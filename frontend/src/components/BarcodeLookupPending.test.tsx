import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarcodeLookupPending } from './BarcodeLookupPending';

afterEach(cleanup);

describe('BarcodeLookupPending', () => {
  it('tells the user the code is being looked up and lets them cancel', () => {
    const onCancel = vi.fn();
    render(<BarcodeLookupPending onCancel={onCancel} />);

    expect(screen.getByText('Szukam produktu...')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
