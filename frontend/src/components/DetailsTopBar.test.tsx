import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailsTopBar, type DetailsTarget } from './DetailsTopBar';

const observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeResizeObserver {
  callback: () => void;
  disconnect = vi.fn();
  constructor(callback: () => void) {
    this.callback = callback;
    observers.push(this);
  }
  observe() {
    this.callback();
  }
}

function target(overrides: Partial<DetailsTarget> = {}): DetailsTarget {
  return { mealName: 'Obiad', mealColor: '#a78bfa', date: '2026-10-20', editing: false, onOpen: vi.fn(), ...overrides };
}

function setWidths(capsule: number, probe: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.className.includes('rounded-[25px]') ? capsule : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.className.includes('invisible') ? probe : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-capsule-action') ? 44 : 0;
  });
}

beforeEach(() => {
  observers.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DetailsTopBar', () => {
  it('shows back, the meal with its day, the heart and the menu in one bar', () => {
    const onBack = vi.fn();
    const onToggle = vi.fn();
    const onMenu = vi.fn();
    const pill = target();
    render(
      <DetailsTopBar
        overPhoto
        backLabel="Wróć"
        onBack={onBack}
        target={pill}
        saved={{ value: true, busy: false, label: 'Usuń z zapisanych', onToggle }}
        menu={{ label: 'Więcej opcji', onOpen: onMenu }}
      />
    );

    const open = screen.getByRole('button', { name: 'Obiad, Wtorek, 20.10. Zmień porę lub dzień' });
    expect(open.textContent).toContain('· wt 20.10');
    expect(open.textContent).toContain('expand_more');
    expect(open.closest('.dark')).toBeTruthy();
    const heart = screen.getByRole('button', { name: 'Usuń z zapisanych' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    expect(heart.className).toContain('text-saved');

    fireEvent.click(open);
    fireEvent.click(heart);
    fireEvent.click(screen.getByRole('button', { name: 'Więcej opcji' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }));
    expect(pill.onOpen).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalled();
    expect(onMenu).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it('shows the meal and day as information only while editing', () => {
    const pill = target({ editing: true });
    render(<DetailsTopBar overPhoto={false} backLabel="Wróć" onBack={vi.fn()} target={pill} />);

    const info = screen.getByRole('button', { name: 'Edytujesz w: Obiad, Wtorek, 20.10' }) as HTMLButtonElement;
    expect(info.disabled).toBe(true);
    expect(info.textContent).not.toContain('expand_more');
    expect(info.closest('.dark')).toBeNull();
  });

  it('keeps separate round buttons without a meal', () => {
    render(<DetailsTopBar overPhoto={false} backLabel="Wróć" onBack={vi.fn()} menu={{ label: 'Więcej opcji', expanded: true, onOpen: vi.fn() }} />);

    const menu = screen.getByRole('button', { name: 'Więcej opcji' });
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(menu.className).toContain('bg-surface-container');
    expect(screen.queryByRole('button', { name: /Zmień porę/ })).toBeNull();
  });

  it('puts a long meal name above the full date when one line does not fit', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    setWidths(240, 260);
    render(<DetailsTopBar overPhoto backLabel="Wróć" onBack={vi.fn()} target={target({ mealName: 'Przekąska po treningu siłowym' })} menu={{ label: 'Więcej opcji', onOpen: vi.fn() }} />);

    expect(screen.getByTestId('target-stacked').textContent).toContain('Wtorek, 20.10');
  });

  it('keeps one line when it fits and checks again when the bar changes size', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    setWidths(300, 150);
    render(<DetailsTopBar overPhoto backLabel="Wróć" onBack={vi.fn()} target={target()} />);
    expect(screen.queryByTestId('target-stacked')).toBeNull();

    setWidths(160, 150);
    act(() => observers.at(-1)!.callback());
    expect(screen.getByTestId('target-stacked')).toBeTruthy();

    cleanup();
    expect(observers.at(-1)!.disconnect).toHaveBeenCalled();
  });

  it('measures without ResizeObserver and again when the window is resized', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 0; });
    setWidths(300, 150);
    render(<DetailsTopBar overPhoto backLabel="Wróć" onBack={vi.fn()} target={target()} />);
    expect(screen.queryByTestId('target-stacked')).toBeNull();

    setWidths(160, 150);
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('target-stacked')).toBeTruthy();
  });
});
