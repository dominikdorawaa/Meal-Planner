import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiClient';
import { findProductByBarCode, missingProductMessage, normalizeBarCode } from './barcodeLookup';

const mocks = vi.hoisted(() => ({ getByBarCode: vi.fn() }));

vi.mock('./apiClient', async importOriginal => {
  const original = await importOriginal<typeof import('./apiClient')>();
  return { ...original, api: { products: { getByBarCode: mocks.getByBarCode } } };
});

afterEach(() => {
  mocks.getByBarCode.mockReset();
});

describe('findProductByBarCode', () => {
  it('returns the product with the code', async () => {
    const product = { id: '1', name: 'Skyr', kcal: 65, protein: 12, fat: 0, carbs: 4.2 };
    mocks.getByBarCode.mockResolvedValue(product);

    await expect(findProductByBarCode('5900820000318')).resolves.toEqual({ product, prefill: null });
  });

  it('returns null when no product has the code', async () => {
    mocks.getByBarCode.mockRejectedValue(new ApiError('Not found', 404));

    await expect(findProductByBarCode('5900820000318')).resolves.toEqual({ product: null, prefill: null });
  });

  it('passes on data from Open Food Facts to fill in the form', async () => {
    const prefill = { name: 'Baton', brand: 'Wedel', kcal: 480, protein: 5 };
    mocks.getByBarCode.mockRejectedValue(new ApiError('Not found', 404, { error: 'Not found', prefill }));

    await expect(findProductByBarCode('5900820000318')).resolves.toEqual({ product: null, prefill });
  });

  it('ignores a malformed error body', async () => {
    mocks.getByBarCode.mockRejectedValueOnce(new ApiError('Not found', 404, { prefill: 'text' }));
    await expect(findProductByBarCode('5900820000318')).resolves.toEqual({ product: null, prefill: null });

    mocks.getByBarCode.mockRejectedValueOnce(new ApiError('Not found', 404, 'text'));
    await expect(findProductByBarCode('5900820000318')).resolves.toEqual({ product: null, prefill: null });
  });

  it('passes on other failures', async () => {
    mocks.getByBarCode.mockRejectedValue(new ApiError('Server error', 500));
    await expect(findProductByBarCode('5900820000318')).rejects.toThrow('Server error');

    mocks.getByBarCode.mockRejectedValue(new Error('offline'));
    await expect(findProductByBarCode('5900820000318')).rejects.toThrow('offline');
  });
});

describe('normalizeBarCode', () => {
  it('keeps only digits', () => {
    expect(normalizeBarCode(' 590-0820 000318 ')).toBe('5900820000318');
  });
});

describe('missingProductMessage', () => {
  it('says the product was not found when there is nothing to fill in', () => {
    expect(missingProductMessage(null)).toBe('scanner.notFound');
  });

  it('asks to check the data when the form was filled in', () => {
    expect(missingProductMessage({ name: 'Milk chocolate candies', kcal: 500 })).toBe('scanner.foundToReview');
  });

  it('asks to enter the name when the filled-in data has no name', () => {
    expect(missingProductMessage({ name: '  ', kcal: 500 })).toBe('scanner.foundToReviewWithoutName');
    expect(missingProductMessage({ kcal: 500 })).toBe('scanner.foundToReviewWithoutName');
  });
});
