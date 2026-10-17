import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExistingBarCodeProduct } from './useExistingBarCodeProduct';

const mocks = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('./barcodeLookup', () => ({ findExistingProduct: mocks.find }));

const product = { id: 'p1', name: 'Skyr' };

afterEach(() => {
  mocks.find.mockReset();
});

describe('useExistingBarCodeProduct', () => {
  it('does not look up an incomplete or invalid code', () => {
    const { result, rerender } = renderHook(({ code }) => useExistingBarCodeProduct(code), {
      initialProps: { code: '' },
    });
    rerender({ code: '590082' });
    rerender({ code: '5900820000319' });

    expect(result.current).toEqual({ product: null, checking: false });
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('is checking until the lookup answers and then returns the product with the code', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.find.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useExistingBarCodeProduct('5900820000318'));

    expect(result.current).toEqual({ product: null, checking: true });
    await act(async () => finish(product));

    expect(result.current).toEqual({ product, checking: false });
    expect(mocks.find).toHaveBeenCalledWith('5900820000318');
  });

  it('stops checking when no product has the code or the lookup fails', async () => {
    mocks.find.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(({ code }) => useExistingBarCodeProduct(code), {
      initialProps: { code: '5900820000318' },
    });
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.product).toBeNull();

    rerender({ code: '96385074' });
    await waitFor(() => expect(result.current.checking).toBe(false));

    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(result.current.product).toBeNull();
  });

  it('forgets the product when the code changes and ignores a late answer for an old code', async () => {
    let finishOld: (value: unknown) => void = () => {};
    mocks.find
      .mockResolvedValueOnce(product)
      .mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce(null);
    const { result, rerender } = renderHook(({ code }) => useExistingBarCodeProduct(code), {
      initialProps: { code: '5900820000318' },
    });
    await waitFor(() => expect(result.current.product).toEqual(product));

    rerender({ code: '59008200003' });
    expect(result.current).toEqual({ product: null, checking: false });
    rerender({ code: '96385074' });
    rerender({ code: '00000000' });
    await act(async () => finishOld({ id: 'late' }));

    expect(result.current).toEqual({ product: null, checking: false });
  });
});
