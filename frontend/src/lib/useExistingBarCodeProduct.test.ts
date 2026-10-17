import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExistingBarCodeProduct } from './useExistingBarCodeProduct';

const mocks = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('./barcodeLookup', () => ({ findProductByBarCode: mocks.find }));

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

    expect(result.current).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('returns the product that already has the code', async () => {
    mocks.find.mockResolvedValue({ product, prefill: null });
    const { result } = renderHook(() => useExistingBarCodeProduct('5900820000318'));

    await waitFor(() => expect(result.current).toEqual(product));
    expect(mocks.find).toHaveBeenCalledWith('5900820000318');
  });

  it('returns nothing when no product has the code or the lookup fails', async () => {
    mocks.find
      .mockResolvedValueOnce({ product: null, prefill: { name: 'Skyr' } })
      .mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(({ code }) => useExistingBarCodeProduct(code), {
      initialProps: { code: '5900820000318' },
    });
    await act(async () => {});
    rerender({ code: '96385074' });
    await act(async () => {});

    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(result.current).toBeNull();
  });

  it('forgets the product when the code changes and ignores a late answer for an old code', async () => {
    let finishOld: (value: unknown) => void = () => {};
    mocks.find
      .mockResolvedValueOnce({ product, prefill: null })
      .mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce({ product: null, prefill: null });
    const { result, rerender } = renderHook(({ code }) => useExistingBarCodeProduct(code), {
      initialProps: { code: '5900820000318' },
    });
    await waitFor(() => expect(result.current).toEqual(product));

    rerender({ code: '59008200003' });
    expect(result.current).toBeNull();
    rerender({ code: '96385074' });
    rerender({ code: '00000000' });
    await act(async () => finishOld({ product: { id: 'late' }, prefill: null }));

    expect(result.current).toBeNull();
  });
});
