import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomPanel } from './BottomPanel';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function renderPanel(onClose = vi.fn(), children = <button type="button">Inside</button>) {
  return render(
    <MemoryRouter>
      <BottomPanel title="Panel" onClose={onClose}>
        {children}
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

  it('moves focus into the panel and gives it back to the opener after closing', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderPanel();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the panel', () => {
    renderPanel(vi.fn(), <><button type="button">First</button><button type="button">Last</button></>);
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('keeps focus on the panel when it has nothing to focus', () => {
    renderPanel(vi.fn(), <p>Text</p>);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });
});
