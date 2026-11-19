import { describe, expect, it } from 'vitest'
import { macroFillClass, macroRingBackground } from './macroColors'

describe('macroColors', () => {
  it('fills the ring with the macro color up to the given percent on a neutral track', () => {
    expect(macroRingBackground('protein', 42)).toBe('conic-gradient(var(--color-macro-protein) 42%, var(--color-surface-container-highest) 0)')
  })

  it('gives every macro its own fill class', () => {
    expect(macroFillClass).toEqual({ protein: 'bg-macro-protein', fat: 'bg-macro-fat', carbs: 'bg-macro-carbs' })
  })
})
