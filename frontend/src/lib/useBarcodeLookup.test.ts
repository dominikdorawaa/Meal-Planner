import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBarcodeLookup } from './useBarcodeLookup';

const mocks = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('./barcodeLookup', () => ({ findProductByBarCode: mocks.find }));

function handlers() {
  return { onFound: vi.fn(), onMissing: vi.fn(), onError: vi.fn() };
}

afterEach(() => {
  mocks.find.mockReset();
});

describe('useBarcodeLookup', () => {
  it('stays pending until the lookup finishes and reports a found product', async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.find.mockReturnValue(new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useBarcodeLookup());
    const callbacks = handlers();

    let lookup: Promise<void> = Promise.resolve();
    act(() => { lookup = result.current.lookUp('5900820000318', callbacks); });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      resolve({ id: 'p1' });
      await lookup;
    });

    expect(callbacks.onFound).toHaveBeenCalledWith({ id: 'p1' });
    expect(result.current.pending).toBe(false);
  });

  it('reports a missing product and a failed lookup', async () => {
    mocks.find.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useBarcodeLookup());
    const missing = handlers();
    const failed = handlers();

    await act(() => result.current.lookUp('5900820000318', missing));
    await act(() => result.current.lookUp('5900820000318', failed));

    expect(missing.onMissing).toHaveBeenCalled();
    expect(failed.onError).toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('ignores the result of a cancelled lookup', async () => {
    let resolve: (value: unknown) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    mocks.find
      .mockReturnValueOnce(new Promise(done => { resolve = done; }))
      .mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const { result } = renderHook(() => useBarcodeLookup());
    const first = handlers();
    const second = handlers();

    let firstLookup: Promise<void> = Promise.resolve();
    let secondLookup: Promise<void> = Promise.resolve();
    act(() => { firstLookup = result.current.lookUp('5900820000318', first); });
    act(() => result.current.cancel());
    expect(result.current.pending).toBe(false);
    act(() => { secondLookup = result.current.lookUp('5901234123457', second); });
    act(() => result.current.cancel());

    await act(async () => {
      resolve(null);
      reject(new Error('late'));
      await firstLookup;
      await secondLookup;
    });

    expect(first.onMissing).not.toHaveBeenCalled();
    expect(second.onError).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
});
