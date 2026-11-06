import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmSheet, type ConfirmSheetProps } from './ConfirmSheet';
import { t } from '../i18n';

afterEach(() => {
  cleanup();
});

function renderSheet(props: Partial<ConfirmSheetProps> = {}) {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() };
  render(
    <ConfirmSheet
      question="Delete product?"
      title="Cottage cheese"
      description="Plan items stay."
      confirmLabel="Delete product"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('ConfirmSheet', () => {
  it('names the item in its title and explains the effect', () => {
    renderSheet({ detail: 'First words of the step' });

    const dialog = screen.getByRole('alertdialog', { name: 'Delete product? Cottage cheese' });
    expect(dialog.getAttribute('aria-describedby')).toBe(screen.getByText('Plan items stay.').id);
    expect(screen.getByRole('heading', { name: 'Cottage cheese' })).toBeTruthy();
    expect(screen.getByText('First words of the step')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: t('common.cancel') }));
  });

  it('uses the title alone as the name when there is no question', () => {
    renderSheet({ question: undefined, description: undefined });

    const dialog = screen.getByRole('alertdialog', { name: 'Cottage cheese' });
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
  });

  it('confirms and cancels with its buttons, the backdrop and the Escape key', () => {
    const { onConfirm, onCancel } = renderSheet({ cancelLabel: 'Keep it' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    fireEvent.click(screen.getByRole('alertdialog'));
    fireEvent.click(screen.getByRole('alertdialog').parentElement!);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('paints the confirm button as danger by default and as neutral on request', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Delete product' }).className).toContain('bg-danger');
    cleanup();

    renderSheet({ tone: 'neutral', confirmLabel: 'Log out' });
    expect(screen.getByRole('button', { name: 'Log out' }).className).toContain('bg-primary');
  });

  it('offers a secondary action and renders extra content', () => {
    const onClick = vi.fn();
    renderSheet({ secondaryAction: { label: 'Add next to them', onClick }, children: <p>Breakfast</p> });

    fireEvent.click(screen.getByRole('button', { name: 'Add next to them' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText('Breakfast')).toBeTruthy();
  });

  it('disables only the confirm button when confirming is not possible', () => {
    renderSheet({ confirmDisabled: true });

    expect((screen.getByRole('button', { name: 'Delete product' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: t('common.cancel') }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('blocks every way out while busy', () => {
    const { onCancel } = renderSheet({ busy: true, secondaryAction: { label: 'Add next to them', onClick: vi.fn() } });

    fireEvent.click(screen.getByRole('alertdialog').parentElement!);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
    for (const name of ['Delete product', t('common.cancel'), 'Add next to them']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
