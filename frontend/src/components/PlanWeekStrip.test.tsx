import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlanWeekStrip, type StripDay } from './PlanWeekStrip'
import { addDaysToIsoDate } from '../lib/planDates'

const DAY_WIDTH = 50
const STRIP_WIDTH = DAY_WIDTH * 7

function windowFrom(start: string, todayIndex: number): StripDay[] {
  return Array.from({ length: 21 }, (_, index) => ({
    date: addDaysToIsoDate(start, index),
    isToday: index === todayIndex,
    goalMet: index === 9,
  }))
}

const days = windowFrom('2026-10-05', 7)

type Props = { days?: StripDay[]; firstVisible?: number; settledVisible?: number }

function renderStrip({ days: shownDays = days, firstVisible = 7, settledVisible = firstVisible }: Props = {}) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('aria-label') === 'Dni planu' ? STRIP_WIDTH : 0
  })
  const onSelectDay = vi.fn()
  const view = render(<PlanWeekStrip days={shownDays} firstVisible={firstVisible} settledVisible={settledVisible} visibleCount={3} onSelectDay={onSelectDay} />)
  const rerender = ({ days: nextDays = shownDays, firstVisible: nextFirst = firstVisible, settledVisible: nextSettled = nextFirst }: Props) =>
    view.rerender(<PlanWeekStrip days={nextDays} firstVisible={nextFirst} settledVisible={nextSettled} visibleCount={3} onSelectDay={onSelectDay} />)
  return { ...view, onSelectDay, rerender }
}

function stripScroller() {
  return screen.getByLabelText('Dni planu')
}

function finishScroll(left: number) {
  const scroller = stripScroller()
  scroller.scrollLeft = left
  fireEvent.scroll(scroller)
  act(() => { vi.advanceTimersByTime(150) })
}

function month() {
  return screen.getByRole('heading', { name: 'Plan' }).nextElementSibling as HTMLElement
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
  it('shows every loaded day under the Plan title, seven at a time', () => {
    const { container } = renderStrip()

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy()
    expect(container.querySelectorAll('[data-strip-day]')).toHaveLength(21)
    expect((stripScroller().firstElementChild as HTMLElement).style.width).toBe('300%')
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

  it('slides one highlight over the three days visible in the plan', () => {
    const { rerender } = renderStrip({ firstVisible: 8 })
    const highlight = screen.getByTestId('visible-days')
    expect(highlight.style.transform).toBe('translateX(266.66666666666663%)')
    expect(highlight.className).toContain('transition-transform')

    rerender({ firstVisible: 9 })

    expect(screen.getByTestId('visible-days').style.transform).toBe('translateX(300%)')
  })

  it('starts on the week with today', () => {
    renderStrip()

    expect(stripScroller().scrollLeft).toBe(7 * DAY_WIDTH)
  })

  it('scrolls the plan to a tapped day', () => {
    const { onSelectDay } = renderStrip()

    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))

    expect(onSelectDay).toHaveBeenCalledWith(11)
  })

  it('moves so all three visible days stay in view once the plan stops', () => {
    const { rerender } = renderStrip()

    rerender({ firstVisible: 12, settledVisible: 12 })

    expect(stripScroller().scrollLeft).toBe(8 * DAY_WIDTH)
  })

  it('moves back when the plan stops on days before the shown ones', () => {
    const { rerender } = renderStrip()

    rerender({ firstVisible: 5, settledVisible: 5 })

    expect(stripScroller().scrollLeft).toBe(5 * DAY_WIDTH)
  })

  it('stays put while the plan stops on days already in view', () => {
    const { rerender } = renderStrip()

    rerender({ firstVisible: 10, settledVisible: 10 })

    expect(stripScroller().scrollLeft).toBe(7 * DAY_WIDTH)
  })

  it('hides the month while today is in view', () => {
    renderStrip()

    expect(month().className).toContain('opacity-0')
    expect(month().textContent).toBe('')
  })

  it('names the month when swiped past the days with today and brings the plan along', () => {
    const { onSelectDay } = renderStrip()
    finishScroll(7 * DAY_WIDTH)

    finishScroll(14 * DAY_WIDTH)

    expect(month().textContent).toBe('Październik 2026')
    expect(month().className).toContain('opacity-100')
    expect(onSelectDay).toHaveBeenCalledWith(14)
  })

  it('brings the plan back when swiped to earlier days', () => {
    const { onSelectDay } = renderStrip()
    finishScroll(7 * DAY_WIDTH)

    finishScroll(2 * DAY_WIDTH)

    expect(onSelectDay).toHaveBeenCalledWith(0)
    expect(stripScroller().scrollLeft).toBe(0)
  })

  it('returns to the shown week after a swipe shorter than half a week', () => {
    const { onSelectDay } = renderStrip()
    finishScroll(7 * DAY_WIDTH)

    finishScroll(10 * DAY_WIDTH)

    expect(onSelectDay).not.toHaveBeenCalled()
    expect(stripScroller().scrollLeft).toBe(7 * DAY_WIDTH)
  })

  it('jumps a whole week after a swipe longer than half a week', () => {
    const { onSelectDay } = renderStrip()
    finishScroll(7 * DAY_WIDTH)

    finishScroll(11 * DAY_WIDTH)

    expect(onSelectDay).toHaveBeenCalledWith(14)
    expect(stripScroller().scrollLeft).toBe(14 * DAY_WIDTH)
  })

  it('leaves the plan alone when the visible days stay in the week swiped to', () => {
    const { onSelectDay } = renderStrip({ firstVisible: 15 })
    finishScroll(8 * DAY_WIDTH)

    finishScroll(14 * DAY_WIDTH)

    expect(onSelectDay).not.toHaveBeenCalled()
    expect(stripScroller().scrollLeft).toBe(14 * DAY_WIDTH)
  })

  it('keeps the shown days and the highlight in place when more days are loaded around them', () => {
    const { rerender } = renderStrip({ firstVisible: 14 })
    finishScroll(14 * DAY_WIDTH)

    rerender({ days: windowFrom('2026-10-12', 0), firstVisible: 7, settledVisible: 7 })

    expect(stripScroller().scrollLeft).toBe(7 * DAY_WIDTH)
    expect(screen.getByTestId('visible-days').style.transition).toBe('none')
  })
})
