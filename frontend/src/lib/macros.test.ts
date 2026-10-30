import { describe, expect, it } from 'vitest'
import { formatMacrosShort, macroEnergyPercents, scaleMacros, targetRange } from './macros'

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

describe('macroEnergyPercents', () => {
  it('shares the rings by calories from each macro', () => {
    expect(macroEnergyPercents({ protein: 10, fat: 10, carbs: 10 })).toEqual({ protein: 24, fat: 53, carbs: 24 })
  })

  it('leaves the rings empty when there are no macros', () => {
    expect(macroEnergyPercents({ protein: 0, fat: 0, carbs: 0 })).toEqual({ protein: 0, fat: 0, carbs: 0 })
  })

  it('ignores negative amounts', () => {
    expect(macroEnergyPercents({ protein: -5, fat: 0, carbs: 20 })).toEqual({ protein: 0, fat: 0, carbs: 100 })
  })
})

describe('scaleMacros', () => {
  it('rounds calories to whole numbers and grams to one decimal place', () => {
    expect(scaleMacros({ kcal: 108, protein: 2.84, fat: 0.33, carbs: 22.85 }, 1.5)).toEqual({ kcal: 162, protein: 4.3, fat: 0.5, carbs: 34.3 })
  })
})
