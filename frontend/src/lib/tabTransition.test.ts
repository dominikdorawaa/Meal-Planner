import { afterEach, describe, expect, it, vi } from 'vitest'
import { markNavigationRendered, runTabTransition, SLIDE_ATTRIBUTE } from './tabTransition'

function installViewTransitions(finished: Promise<void>) {
  const updates: Promise<void>[] = []
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: (update: () => Promise<void>) => {
      updates.push(update())
      return { finished }
    },
  })
  return updates
}

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition')
  document.documentElement.removeAttribute(SLIDE_ATTRIBUTE)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('runTabTransition', () => {
  it('switches the screen right away when the browser has no view transitions', () => {
    const update = vi.fn()

    runTabTransition('forward', update)

    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.hasAttribute(SLIDE_ATTRIBUTE)).toBe(false)
  })

  it('skips the animation when the user prefers reduced motion', () => {
    installViewTransitions(Promise.resolve())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    const update = vi.fn()

    runTabTransition('forward', update)

    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.hasAttribute(SLIDE_ATTRIBUTE)).toBe(false)
  })

  it('slides in the direction of the picked tab until the new screen is rendered', async () => {
    let finish: () => void = () => {}
    const updates = installViewTransitions(new Promise<void>(resolve => { finish = resolve }))
    const update = vi.fn()

    runTabTransition('backward', update)

    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.getAttribute(SLIDE_ATTRIBUTE)).toBe('backward')

    markNavigationRendered()
    await expect(updates[0]).resolves.toBeUndefined()

    finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement.hasAttribute(SLIDE_ATTRIBUTE)).toBe(false)
  })

  it('does not wait forever when the new screen never reports being rendered', async () => {
    vi.useFakeTimers()
    const updates = installViewTransitions(Promise.reject(new Error('skipped')))

    runTabTransition('forward', () => {})
    vi.advanceTimersByTime(400)

    await expect(updates[0]).resolves.toBeUndefined()
    await Promise.resolve()
    expect(document.documentElement.hasAttribute(SLIDE_ATTRIBUTE)).toBe(false)
  })
})
