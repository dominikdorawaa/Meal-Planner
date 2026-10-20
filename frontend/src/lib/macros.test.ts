import { describe, expect, it } from 'vitest'
import { formatMacrosShort, targetRange } from './macros'

describe('formatMacrosShort', () => {
  it('shows protein, fat and carbs rounded to whole grams', () => {
    expect(formatMacrosShort(30.4, 12.6, 45)).toBe('B 30g · T 13g · W 45g')
  })

  it('shortens very large amounts', () => {
    expect(formatMacrosShort(50000, 20000, 123456)).toBe('B 50 tys.g · T 20 tys.g · W 123,5 tys.g')
  })
})

describe('targetRange', () => {
  it('uses the stored minimum and maximum', () => {
    expect(targetRange(150, 120, 180)).toBe('120-180')
  })

  it('falls back to ten percent around the target when the range is missing', () => {
    expect(targetRange(150, null, undefined)).toBe('135-165')
  })
})
