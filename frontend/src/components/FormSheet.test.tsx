import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormSheet, SheetSubmit } from './FormSheet';

afterEach(cleanup);

describe('SheetSubmit', () => {
  it('keeps its name for screen readers while saving', () => {
    render(<SheetSubmit label="Save" busy />);

    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('greys out only when it cannot be used yet', () => {
    const { rerender } = render(<SheetSubmit label="Save" busy={false} disabled />);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('disabled:bg-surface-container-highest');

    rerender(<SheetSubmit label="Save" busy />);
    expect(screen.getByRole('button', { name: 'Save' }).className).not.toContain('disabled:bg-surface-container-highest');
  });
});

describe('FormSheet', () => {
  it('shows the leading tile and hint and closes from the close button', () => {
    const onClose = vi.fn();
    render(
      <FormSheet title="Quick meal" hint="Breakfast" leading={<span>tile</span>} closeLabel="Close" onClose={onClose}>
        <p>fields</p>
      </FormSheet>
    );

    expect(screen.getByRole('dialog', { name: 'Quick meal' })).toBeTruthy();
    expect(screen.getByText('tile')).toBeTruthy();
    expect(screen.getByText('Breakfast')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close while it is busy', () => {
    const onClose = vi.fn();
    render(
      <FormSheet title="Quick meal" closeLabel="Close" busy onClose={onClose}>
        <p>fields</p>
      </FormSheet>
    );

    fireEvent.click(screen.getByRole('dialog').previousElementSibling!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
