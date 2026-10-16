import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_SEARCH_DEBOUNCE_MS, PRODUCT_SEARCH_PAGE_SIZE, useProductSearch } from './useProductSearch';

const mocks = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock('./apiClient', () => ({
  api: { products: { search: mocks.search } },
}));

const noFilters = {};

function page(items: string[], pageNumber: number, hasNext: boolean) {
  return { items: items.map(id => ({ id })), page: pageNumber, size: PRODUCT_SEARCH_PAGE_SIZE, has_next: hasNext };
}

async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(PRODUCT_SEARCH_DEBOUNCE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  mocks.search.mockReset();
});

describe('useProductSearch', () => {
  it('searches once after the user stops typing', async () => {
    mocks.search.mockResolvedValue(page(['a'], 0, false));
    const { result, rerender } = renderHook(
      ({ query }) => useProductSearch({ query, filters: noFilters, enabled: true }),
      { initialProps: { query: 's' } },
    );

    rerender({ query: 'se' });
    rerender({ query: 'ser' });
    await flushDebounce();

    expect(mocks.search).toHaveBeenCalledTimes(1);
    expect(mocks.search).toHaveBeenCalledWith({ query: 'ser', page: 0, size: PRODUCT_SEARCH_PAGE_SIZE, filters: {} });
    expect(result.current.items).toEqual([{ id: 'a' }]);
    expect(result.current.loading).toBe(false);
  });

  it('does not search while disabled', async () => {
    renderHook(() => useProductSearch({ query: 'ser', filters: noFilters, enabled: false }));
    await flushDebounce();

    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('appends the next page and stops when there are no more results', async () => {
    mocks.search.mockResolvedValueOnce(page(['a'], 0, true)).mockResolvedValueOnce(page(['b'], 1, false));
    const { result } = renderHook(() => useProductSearch({ query: 'ser', filters: noFilters, enabled: true }));
    await flushDebounce();

    await act(async () => {
      result.current.loadMore();
    });

    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(result.current.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.current.hasNext).toBe(false);

    act(() => result.current.loadMore());
    expect(mocks.search).toHaveBeenCalledTimes(2);
  });

  it('ignores results of an older search that finishes late', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    mocks.search
      .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce(page(['new'], 0, false));
    const { result, rerender } = renderHook(
      ({ query }) => useProductSearch({ query, filters: noFilters, enabled: true }),
      { initialProps: { query: 'old' } },
    );
    await flushDebounce();
    rerender({ query: 'new' });
    await flushDebounce();

    await act(async () => {
      resolveOld(page(['old'], 0, false));
    });

    expect(result.current.items).toEqual([{ id: 'new' }]);
  });

  it('reports a failed search', async () => {
    mocks.search.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProductSearch({ query: 'ser', filters: noFilters, enabled: true }));
    await flushDebounce();

    expect(result.current.error).toBe(true);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('ignores a failure of an older search', async () => {
    let rejectOld: (reason: unknown) => void = () => {};
    mocks.search
      .mockReturnValueOnce(new Promise((_, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce(page(['new'], 0, false));
    const { result, rerender } = renderHook(
      ({ query }) => useProductSearch({ query, filters: noFilters, enabled: true }),
      { initialProps: { query: 'old' } },
    );
    await flushDebounce();
    rerender({ query: 'new' });
    await flushDebounce();

    await act(async () => {
      rejectOld(new Error('late'));
    });

    expect(result.current.error).toBe(false);
  });

  it('searches again when filters change or a reload is requested', async () => {
    mocks.search.mockResolvedValue(page([], 0, false));
    const { result, rerender } = renderHook(
      ({ filters }) => useProductSearch({ query: '', filters, enabled: true }),
      { initialProps: { filters: { maxKcal: '' } } },
    );
    await flushDebounce();

    rerender({ filters: { maxKcal: '200' } });
    await flushDebounce();
    act(() => result.current.reload());
    await flushDebounce();

    expect(mocks.search).toHaveBeenCalledTimes(3);
    expect(mocks.search).toHaveBeenNthCalledWith(2, expect.objectContaining({ filters: { maxKcal: '200' } }));
  });
});
