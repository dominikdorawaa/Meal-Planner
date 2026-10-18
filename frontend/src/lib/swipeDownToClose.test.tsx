import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useSwipeDownToClose } from './swipeDownToClose'
import { useBottomSheet } from './bottomSheet'

function Sheet({ onClose }: { onClose: () => void }) {
  const ref = useSwipeDownToClose(onClose)
  return (
    <div ref={ref} data-testid="sheet">
      <div data-testid="list" style={{ overflowY: 'auto' }}>
        <button>item</button>
      </div>
      <input aria-label="amount" />
    </div>
  )
}

function sheet() {
  const element = screen.getByTestId('sheet')
  Object.defineProperty(element, 'offsetHeight', { value: 400, configurable: true })
  return element
}

function drag(target: Element, distance: number, durationMs = 1000, dx = 0) {
  fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 100 }] })
  vi.advanceTimersByTime(durationMs)
  fireEvent.touchMove(target, { touches: [{ clientX: 100 + dx / 2, clientY: 100 + distance / 2 }] })
  fireEvent.touchMove(target, { touches: [{ clientX: 100 + dx, clientY: 100 + distance }] })
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: 100 + dx, clientY: 100 + distance }] })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('swipe down to close', () => {
  it('moves the sheet with the finger and closes it after a long enough drag', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const element = sheet()

    fireEvent.touchStart(element, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(element, { touches: [{ clientX: 100, clientY: 160 }] })
    expect(element.style.transform).toBe('translateY(60px)')

    vi.advanceTimersByTime(1000)
    fireEvent.touchMove(element, { touches: [{ clientX: 100, clientY: 250 }] })
    fireEvent.touchEnd(element, { changedTouches: [{ clientX: 100, clientY: 250 }] })
    expect(element.style.transform).toBe('translateY(100%)')
    expect(onClose).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(200))
    expect(onClose).toHaveBeenCalledOnce()
    act(() => vi.advanceTimersByTime(200))
    expect(element.style.transform).toBe('')
  })

  it('closes after a short but quick flick', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)

    drag(sheet(), 60, 50)
    act(() => vi.advanceTimersByTime(200))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('springs back after a short slow drag', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const element = sheet()

    drag(element, 60)
    expect(element.style.transform).toBe('')
    act(() => vi.advanceTimersByTime(400))

    expect(onClose).not.toHaveBeenCalled()
    expect(element.style.transition).toBe('')
  })

  it('springs back when the touch is cancelled', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const element = sheet()

    fireEvent.touchStart(element, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(element, { touches: [{ clientX: 100, clientY: 350 }] })
    fireEvent.touchCancel(element)
    act(() => vi.advanceTimersByTime(400))

    expect(onClose).not.toHaveBeenCalled()
    expect(element.style.transform).toBe('')
  })

  it('leaves upward and sideways moves to scrolling', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const element = sheet()

    drag(element, -200, 50)
    drag(element, 100, 50, 300)
    fireEvent.touchStart(element, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(element, { touches: [{ clientX: 102, clientY: 103 }] })
    fireEvent.touchEnd(element, { changedTouches: [{ clientX: 102, clientY: 103 }] })
    act(() => vi.advanceTimersByTime(400))

    expect(onClose).not.toHaveBeenCalled()
    expect(element.style.transform).toBe('')
  })

  it('does not drag while the content is scrolled down, from form fields or with two fingers', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const element = sheet()
    const list = screen.getByTestId('list')

    list.scrollTop = 50
    drag(screen.getByText('item'), 300, 50)
    list.scrollTop = 0
    drag(screen.getByLabelText('amount'), 300, 50)
    fireEvent.touchStart(element, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 150, clientY: 100 }] })
    fireEvent.touchMove(element, { touches: [{ clientX: 100, clientY: 400 }] })
    fireEvent.touchEnd(element, { changedTouches: [{ clientX: 100, clientY: 400 }] })
    act(() => vi.advanceTimersByTime(400))

    expect(onClose).not.toHaveBeenCalled()
    expect(element.style.transform).toBe('')
  })

  it('drags from content that is scrolled to the top', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    sheet()

    drag(screen.getByText('item'), 300, 50)
    act(() => vi.advanceTimersByTime(200))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stops listening once the sheet is removed', () => {
    const onClose = vi.fn()
    const view = render(<Sheet onClose={onClose} />)
    const element = sheet()

    drag(element, 300, 50)
    view.unmount()
    act(() => vi.advanceTimersByTime(400))
    drag(element, 300, 50)
    act(() => vi.advanceTimersByTime(400))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('uses the latest close handler', () => {
    const first = vi.fn()
    const second = vi.fn()
    const view = render(<Sheet onClose={first} />)
    view.rerender(<Sheet onClose={second} />)

    drag(sheet(), 300, 50)
    act(() => vi.advanceTimersByTime(200))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})

describe('bottom sheet', () => {
  function Page() {
    const [open, setOpen] = useState(true)
    const ref = useBottomSheet(open, () => setOpen(false))
    return open ? <div ref={ref} data-testid="sheet">sheet</div> : <span>closed</span>
  }

  it('closes the sheet with a downward swipe', () => {
    render(<Page />)

    drag(sheet(), 300, 50)
    act(() => vi.advanceTimersByTime(200))

    expect(screen.getByText('closed')).toBeTruthy()
  })
})

describe('locked sheet', () => {
  function LockedSheet({ locked, onClose }: { locked: boolean; onClose: () => void }) {
    const ref = useSwipeDownToClose(onClose, locked)
    return <div ref={ref} data-testid="sheet">sheet</div>
  }

  it('does not move while it cannot be closed and moves again once unlocked', () => {
    const onClose = vi.fn()
    const view = render(<LockedSheet locked onClose={onClose} />)

    drag(sheet(), 300, 50)
    act(() => vi.advanceTimersByTime(400))
    expect(sheet().style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()

    view.rerender(<LockedSheet locked={false} onClose={onClose} />)
    drag(sheet(), 300, 50)
    act(() => vi.advanceTimersByTime(200))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
