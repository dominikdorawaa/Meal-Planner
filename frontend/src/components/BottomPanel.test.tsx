import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomPanel } from './BottomPanel';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function renderPanel(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BottomPanel title="Panel" onClose={onClose}>
        <button type="button">Inside</button>
      </BottomPanel>
    </MemoryRouter>
  );
}

describe('BottomPanel', () => {
  it('stops the page behind from scrolling while open and restores it after closing', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = renderPanel();

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('auto');
  });

  it('closes when tapping outside but not when tapping inside', () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog', { name: 'Panel' }).parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
