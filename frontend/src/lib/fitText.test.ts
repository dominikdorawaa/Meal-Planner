import { describe, expect, it } from 'vitest';
import { KCAL_HERO_SIZES, RING_VALUE_SIZES, fitTextClass } from './fitText';

describe('fitTextClass', () => {
  it('keeps the full size for short text', () => {
    expect(fitTextClass('900', KCAL_HERO_SIZES, 3)).toBe('text-3xl');
    expect(fitTextClass('12g', RING_VALUE_SIZES, 4)).toBe('text-base');
  });

  it('steps the size down for every extra character', () => {
    expect(fitTextClass('4500', KCAL_HERO_SIZES, 3)).toBe('text-2xl');
    expect(fitTextClass('5000g', RING_VALUE_SIZES, 4)).toBe('text-sm');
  });

  it('stops at the smallest size', () => {
    expect(fitTextClass('999,9 tys.', KCAL_HERO_SIZES, 3)).toBe('text-sm');
    expect(fitTextClass('12,3 tys.g', RING_VALUE_SIZES, 4)).toBe('text-[10px]');
  });
});
