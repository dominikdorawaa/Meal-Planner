import { describe, expect, it } from 'vitest';
import {
  AMOUNT_LIMITS,
  NUTRITION_LIMITS,
  PROFILE_LIMITS,
  acceptsLimitedNumber,
  amountLimit,
  isPositiveWithinLimit,
  numberFieldProps,
} from './inputLimits';

describe('amountLimit', () => {
  it('uses the limit defined for each amount unit', () => {
    expect(amountLimit('g')).toBe(5000);
    expect(amountLimit('ml')).toBe(5000);
    expect(amountLimit('portion')).toBe(50);
    expect(amountLimit('szt')).toBe(100);
    expect(amountLimit('opak')).toBe(100);
  });

  it('falls back to the gram limit for unknown units', () => {
    expect(amountLimit('unknown')).toBe(AMOUNT_LIMITS.g);
  });
});

describe('limit definitions', () => {
  it('matches the backend nutrition validator limits', () => {
    expect(NUTRITION_LIMITS.kcal).toBe(900);
    expect(NUTRITION_LIMITS.protein).toBe(100);
    expect(NUTRITION_LIMITS.salt).toBe(100);
  });

  it('defines the profile limits', () => {
    expect(PROFILE_LIMITS.targetKcal).toBe(10000);
    expect(PROFILE_LIMITS.weight).toBe(500);
  });
});

describe('acceptsLimitedNumber', () => {
  it('accepts an empty value so the field can be cleared', () => {
    expect(acceptsLimitedNumber('', 100)).toBe(true);
  });

  it('accepts values up to the limit', () => {
    expect(acceptsLimitedNumber('100', 100)).toBe(true);
    expect(acceptsLimitedNumber('99.5', 100)).toBe(true);
    expect(acceptsLimitedNumber('99,5', 100)).toBe(true);
  });

  it('rejects values above the limit', () => {
    expect(acceptsLimitedNumber('100.1', 100)).toBe(false);
    expect(acceptsLimitedNumber('5001', 5000)).toBe(false);
  });

  it('accepts one decimal place by default and rejects more', () => {
    expect(acceptsLimitedNumber('1.', 100)).toBe(true);
    expect(acceptsLimitedNumber('1.2', 100)).toBe(true);
    expect(acceptsLimitedNumber('1.25', 100)).toBe(false);
  });

  it('respects a custom number of decimal places', () => {
    expect(acceptsLimitedNumber('1.25', 100, 2)).toBe(true);
    expect(acceptsLimitedNumber('1.5', 100, 0)).toBe(false);
    expect(acceptsLimitedNumber('15', 100, 0)).toBe(true);
  });

  it('rejects negative numbers and other text', () => {
    expect(acceptsLimitedNumber('-1', 100)).toBe(false);
    expect(acceptsLimitedNumber('1e3', 5000)).toBe(false);
    expect(acceptsLimitedNumber('abc', 100)).toBe(false);
  });
});

describe('isPositiveWithinLimit', () => {
  it('accepts positive values up to the limit', () => {
    expect(isPositiveWithinLimit(1, 100)).toBe(true);
    expect(isPositiveWithinLimit('100', 100)).toBe(true);
    expect(isPositiveWithinLimit('0,5', 100)).toBe(true);
  });

  it('rejects zero, empty and values above the limit', () => {
    expect(isPositiveWithinLimit(0, 100)).toBe(false);
    expect(isPositiveWithinLimit('', 100)).toBe(false);
    expect(isPositiveWithinLimit(null, 100)).toBe(false);
    expect(isPositiveWithinLimit(101, 100)).toBe(false);
    expect(isPositiveWithinLimit('abc', 100)).toBe(false);
  });
});

describe('numberFieldProps', () => {
  it('describes a decimal field without autofill suggestions', () => {
    expect(numberFieldProps(5000)).toEqual({ type: 'number', inputMode: 'decimal', autoComplete: 'off', min: 0, max: 5000, step: 0.1 });
  });

  it('uses the numeric keyboard for whole numbers', () => {
    expect(numberFieldProps(10000, 0)).toMatchObject({ inputMode: 'numeric', step: 1 });
  });
});
