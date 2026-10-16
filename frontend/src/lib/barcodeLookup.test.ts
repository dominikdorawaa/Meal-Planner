import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiClient';
import { findProductByBarCode, normalizeBarCode } from './barcodeLookup';

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

    await expect(findProductByBarCode('5900820000318')).resolves.toBe(product);
  });

  it('returns null when no product has the code', async () => {
    mocks.getByBarCode.mockRejectedValue(new ApiError('Not found', 404));

    await expect(findProductByBarCode('5900820000318')).resolves.toBeNull();
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
