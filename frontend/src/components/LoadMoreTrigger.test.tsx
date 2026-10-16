import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadMoreTrigger } from './LoadMoreTrigger';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

function stubIntersectionObserver() {
  const instance = { callback: (() => {}) as ObserverCallback, observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: ObserverCallback) {
      instance.callback = callback;
    }
    observe = instance.observe;
    disconnect = instance.disconnect;
  });
  return instance;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoadMoreTrigger', () => {
  it('loads more when the button scrolls into view', () => {
    const observer = stubIntersectionObserver();
    const onLoadMore = vi.fn();
    const { unmount } = render(<LoadMoreTrigger onLoadMore={onLoadMore} loading={false} />);

    observer.callback([{ isIntersecting: false }]);
    expect(onLoadMore).not.toHaveBeenCalled();
    observer.callback([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('loads more on click when the browser cannot observe scrolling', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onLoadMore = vi.fn();
    render(<LoadMoreTrigger onLoadMore={onLoadMore} loading={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows progress and blocks clicks while loading', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<LoadMoreTrigger onLoadMore={vi.fn()} loading />);

    expect((screen.getByRole('button', { name: 'Ładowanie...' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
