import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { installBackNavigation, registerOverlay, useCloseOnBack } from './backNavigation'

let uninstall: () => void

function isOnGuard() {
  return (window.history.state as Record<string, unknown> | null)?.overlayGuard === true
}

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function goBack() {
  return new Promise<void>(resolve => {
    window.addEventListener('popstate', () => resolve(), { once: true })
    window.history.back()
  })
}

beforeEach(() => {
  window.history.replaceState({ idx: 3, key: 'base' }, '', '/plan')
  uninstall = installBackNavigation()
})

afterEach(() => {
  cleanup()
  uninstall()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window.navigator, 'standalone')
})

function Sheet({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(true)
  const close = () => {
    setOpen(false)
    onClosed?.()
  }
  useCloseOnBack(open, close)
  return (
    <div>
      {open ? <span>sheet open</span> : <span>sheet closed</span>}
      <button onClick={() => setOpen(true)}>open</button>
      <button onClick={() => setOpen(false)}>close</button>
    </div>
  )
}

describe('back navigation', () => {
  it('adds a history entry that keeps the router state while an overlay is open', async () => {
    registerOverlay(() => {})
    await settle()

    expect(isOnGuard()).toBe(true)
    expect(window.history.state).toMatchObject({ idx: 3, key: 'base' })
    expect(window.location.pathname).toBe('/plan')
  })

  it('closes the open overlay when the user goes back instead of leaving the screen', async () => {
    const onClosed = vi.fn()
    const view = render(<Sheet onClosed={onClosed} />)
    await settle()

    await goBack()

    await waitFor(() => expect(view.getByText('sheet closed')).toBeTruthy())
    expect(onClosed).toHaveBeenCalledOnce()
    await settle()
    expect(isOnGuard()).toBe(false)
    expect(window.history.state).toMatchObject({ idx: 3, key: 'base' })
  })

  it('removes the extra history entry when the overlay is closed from the screen', async () => {
    const view = render(<Sheet />)
    await settle()
    expect(isOnGuard()).toBe(true)

    fireEvent.click(view.getByText('close'))
    await waitFor(() => expect(isOnGuard()).toBe(false))
    await settle()

    expect(window.history.state).toMatchObject({ idx: 3, key: 'base' })
  })

  it('closes only the top overlay first when several are open', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const unregisterFirst = registerOverlay(first)
    registerOverlay(() => {
      second()
    })
    await settle()

    await goBack()
    await settle()

    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    expect(isOnGuard()).toBe(true)
    unregisterFirst()
  })

  it('keeps one history entry when an overlay closes and another opens at once', async () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    const unregister = registerOverlay(() => {})
    await settle()

    unregister()
    registerOverlay(() => {})
    await settle()

    expect(pushState).toHaveBeenCalledOnce()
    expect(isOnGuard()).toBe(true)
  })

  it('does not close a newly opened overlay while removing the previous entry', async () => {
    const unregister = registerOverlay(() => {})
    await settle()
    const pushState = vi.spyOn(window.history, 'pushState')
    unregister()
    await settle()
    const next = vi.fn()

    await new Promise<void>(resolve => {
      window.addEventListener('popstate', () => resolve(), { once: true })
      registerOverlay(next)
    })
    await settle()

    expect(next).not.toHaveBeenCalled()
    expect(pushState).toHaveBeenCalledOnce()
    expect(isOnGuard()).toBe(true)
  })

  it('skips a leftover entry of an overlay closed by navigating to another screen', async () => {
    const unregister = registerOverlay(() => {})
    await settle()
    window.history.pushState({ idx: 4, key: 'next' }, '', '/recipe/1')
    unregister()
    await settle()

    await goBack()
    await waitFor(() => expect(isOnGuard()).toBe(false))

    expect(window.history.state).toMatchObject({ idx: 3, key: 'base' })
    expect(window.location.pathname).toBe('/plan')
  })

  it('ignores unregistering the same overlay twice', async () => {
    const unregister = registerOverlay(() => {})
    unregister()
    unregister()
    await settle()

    expect(isOnGuard()).toBe(false)
  })

  it('drops a leftover entry when the app starts on it', () => {
    uninstall()
    window.history.replaceState({ idx: 3, key: 'base', overlayGuard: true }, '')

    uninstall = installBackNavigation()

    expect(window.history.state).toEqual({ idx: 3, key: 'base' })
  })
})

describe('edge swipe back', () => {
  function swipe(fromX: number, toX: number, toY = 300) {
    fireEvent.touchStart(window, { touches: [{ clientX: fromX, clientY: 300 }] })
    fireEvent.touchEnd(window, { changedTouches: [{ clientX: toX, clientY: toY }] })
  }

  function installAsIosApp() {
    uninstall()
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })
    uninstall = installBackNavigation()
    return vi.spyOn(window.history, 'back').mockImplementation(() => {})
  }

  it('goes back when the installed iOS app is swiped from the left edge', () => {
    const back = installAsIosApp()

    swipe(5, 120)

    expect(back).toHaveBeenCalledOnce()
  })

  it('ignores swipes that start away from the edge, are too short or mostly vertical', () => {
    const back = installAsIosApp()

    swipe(100, 250)
    swipe(5, 50)
    swipe(5, 120, 500)
    fireEvent.touchStart(window, { touches: [{ clientX: 5, clientY: 300 }] })
    fireEvent.touchCancel(window)
    fireEvent.touchEnd(window, { changedTouches: [{ clientX: 200, clientY: 300 }] })

    expect(back).not.toHaveBeenCalled()
  })

  it('leaves edge swipes to the system outside the installed iOS app', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    swipe(5, 120)

    expect(back).not.toHaveBeenCalled()
  })
})
