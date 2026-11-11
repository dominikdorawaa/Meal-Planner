import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlanWeekStrip, SWIPE_MS } from './PlanWeekStrip'

const STRIP_WIDTH = 350

const at = (days: number, px = 0) => `translateX(calc(${-days * (100 / 21)}% + ${px}px))`

type Props = { start?: string; visibleStart?: string; today?: string }

function renderStrip({ start = '2026-10-12', visibleStart = '2026-10-12', today = '2026-10-12' }: Props = {}) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('aria-label') === 'Dni planu' ? STRIP_WIDTH : 0
  })
  const onSelectDay = vi.fn()
  const onSwipeWeek = vi.fn()
  const isGoalMet = (date: string) => date === '2026-10-14'
  const strip = (props: Required<Props>) => (
    <PlanWeekStrip {...props} visibleCount={3} isGoalMet={isGoalMet} onSwipeWeek={onSwipeWeek} onSelectDay={onSelectDay} />
  )
  const view = render(strip({ start, visibleStart, today }))
  const rerender = (next: Props) => view.rerender(strip({ start, visibleStart, today, ...next }))
  return { ...view, onSelectDay, onSwipeWeek, rerender }
}

function strip() {
  return screen.getByLabelText('Dni planu')
}

function track() {
  return screen.getByTestId('strip-track')
}

function swipe(dx: number, { finish = true } = {}) {
  fireEvent.pointerDown(strip(), { pointerId: 1, clientX: 200 })
  fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 200 + dx / 2 })
  fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 200 + dx })
  fireEvent.pointerUp(strip(), { pointerId: 1, clientX: 200 + dx })
  if (finish) act(() => { vi.advanceTimersByTime(SWIPE_MS) })
}

function month() {
  return screen.getByRole('heading', { name: 'Plan' }).nextElementSibling as HTMLElement
}

function shownDays() {
  return screen.getAllByRole('button').map(button => button.getAttribute('data-strip-day'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PlanWeekStrip', () => {
  it('shows the seven days of its week under the Plan title with a week ready on each side', () => {
    const { container } = renderStrip()

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy()
    expect(shownDays()).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
    expect(container.querySelectorAll('[data-strip-day]')).toHaveLength(21)
    expect(track().style.transform).toBe(at(7))
  })

  it('marks today and names each day with its weekday and number', () => {
    renderStrip()

    expect(screen.getByRole('button', { name: 'Pon 12' }).getAttribute('aria-current')).toBe('date')
    expect(screen.getByRole('button', { name: 'Wt 13' }).getAttribute('aria-current')).toBeNull()
  })

  it('shows a leaf only on days that meet the goal', () => {
    const { container } = renderStrip()

    expect(container.querySelectorAll('[data-testid="goal-leaf"]')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Śr 14, cel dnia spełniony' }).querySelector('[data-testid="goal-leaf"]')).not.toBeNull()
  })

  it('places one highlight over the three days visible in the plan', () => {
    const { rerender } = renderStrip({ visibleStart: '2026-10-13' })
    expect(screen.getByTestId('visible-days').style.transform).toBe('translateX(266.66666666666663%)')

    rerender({ visibleStart: '2026-10-14' })

    expect(screen.getByTestId('visible-days').style.transform).toBe('translateX(300%)')
  })

  it('asks the plan to show a tapped day', () => {
    const { onSelectDay } = renderStrip()

    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))

    expect(onSelectDay).toHaveBeenCalledWith('2026-10-16')
  })

  it('moves exactly one week forward after a swipe left, however long it is', () => {
    const { onSwipeWeek, onSelectDay } = renderStrip()

    swipe(-1000, { finish: false })
    expect(track().style.transform).toBe(at(14))
    act(() => { vi.advanceTimersByTime(SWIPE_MS) })

    expect(onSwipeWeek).toHaveBeenCalledTimes(1)
    expect(onSwipeWeek).toHaveBeenCalledWith(1)
    expect(onSelectDay).not.toHaveBeenCalled()
  })

  it('moves exactly one week back after a swipe right', () => {
    const { onSwipeWeek } = renderStrip()

    swipe(120)

    expect(onSwipeWeek).toHaveBeenCalledWith(-1)
  })

  it('follows the finger while dragging', () => {
    renderStrip()

    fireEvent.pointerDown(strip(), { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 170 })

    expect(track().style.transform).toBe(at(7, -30))
    expect(track().style.transition).toBe('none')
  })

  it('springs back and stays on the week after a short swipe', () => {
    const { onSwipeWeek } = renderStrip()

    swipe(-40)

    expect(onSwipeWeek).not.toHaveBeenCalled()
    expect(track().style.transform).toBe(at(7))
  })

  it('ignores a second swipe while the first one is still moving', () => {
    const { onSwipeWeek } = renderStrip()

    swipe(-200, { finish: false })
    swipe(-200, { finish: false })
    act(() => { vi.advanceTimersByTime(SWIPE_MS) })

    expect(onSwipeWeek).toHaveBeenCalledTimes(1)
  })

  it('ignores pointer moves from another finger and after the swipe ended', () => {
    const { onSwipeWeek } = renderStrip()

    fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 10 })
    fireEvent.pointerUp(strip(), { pointerId: 1, clientX: 10 })
    fireEvent.pointerDown(strip(), { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(strip(), { pointerId: 2, clientX: 10 })
    fireEvent.pointerUp(strip(), { pointerId: 2, clientX: 10 })
    fireEvent.pointerCancel(strip(), { pointerId: 1, clientX: 200 })

    expect(onSwipeWeek).not.toHaveBeenCalled()
    expect(track().style.transform).toBe(at(7))
  })

  it('keeps receiving the drag outside the strip once it moves past a tap', () => {
    renderStrip()
    const setPointerCapture = vi.fn()
    strip().setPointerCapture = setPointerCapture

    fireEvent.pointerDown(strip(), { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 196 })
    expect(setPointerCapture).not.toHaveBeenCalled()
    fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 150 })
    fireEvent.pointerMove(strip(), { pointerId: 1, clientX: 140 })

    expect(setPointerCapture).toHaveBeenCalledTimes(1)
    expect(setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('drops a mouse drag released outside the strip and accepts the next swipe and tap', () => {
    const { onSwipeWeek, onSelectDay } = renderStrip()

    fireEvent.pointerDown(strip(), { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 200 })
    fireEvent.pointerMove(strip(), { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 100 })
    fireEvent.pointerMove(strip(), { pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 50 })

    expect(track().style.transform).toBe(at(7))
    expect(onSwipeWeek).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-16')

    swipe(-200)
    expect(onSwipeWeek).toHaveBeenCalledWith(1)
  })

  it('does not treat the end of a swipe as a tap on a day but accepts the next tap', () => {
    const { onSelectDay } = renderStrip()

    swipe(-200, { finish: false })
    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))
    act(() => { vi.advanceTimersByTime(SWIPE_MS) })
    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))

    expect(onSelectDay).toHaveBeenCalledTimes(1)
  })

  it('keeps a tap with a tiny finger movement as a tap', () => {
    const { onSelectDay, onSwipeWeek } = renderStrip()

    swipe(4)
    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))

    expect(onSwipeWeek).not.toHaveBeenCalled()
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-16')
  })

  it('shows the next week in place once the parent moves the start after a swipe', () => {
    const { rerender } = renderStrip()
    swipe(-200)

    rerender({ start: '2026-10-19' })

    expect(shownDays()[0]).toBe('2026-10-19')
    expect(track().style.transition).toBe('none')
    expect(track().style.transform).toBe(at(7))
  })

  it('slides to a start moved by the plan by up to a week', () => {
    const { rerender } = renderStrip()
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length })

    rerender({ start: '2026-10-19' })
    expect(track().style.transform).toBe(at(0))
    frames.forEach(frame => frame(0))

    expect(track().style.transform).toBe(at(7))
    expect(track().style.transition).toBe('')
  })

  it('jumps without sliding to a start more than a week away', () => {
    const { rerender } = renderStrip()

    rerender({ start: '2026-12-07' })

    expect(shownDays()[0]).toBe('2026-12-07')
    expect(track().style.transform).toBe(at(7))
    expect(track().style.transition).toBe('none')
  })

  it('hides the month while today is in the shown week', () => {
    renderStrip()

    expect(month().className).toContain('opacity-0')
    expect(month().textContent).toBe('')
  })

  it('names the month when the shown week is away from today', () => {
    renderStrip({ start: '2026-11-30' })

    expect(month().textContent).toBe('Grudzień 2026')
    expect(month().className).toContain('opacity-100')
  })
})
