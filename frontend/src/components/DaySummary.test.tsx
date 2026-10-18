import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DaySummary } from './DaySummary'

afterEach(cleanup)

const targets = { target_kcal: 2200, target_protein: 150, target_fat: 70, target_carbs: 250 }
const consumed = { kcal: 2680, protein: 100, fat: 69.4, carbs: 301.8 }

function renderSummary(interactive = true) {
  return render(<DaySummary consumed={consumed} targets={targets} dayLabel="Niedziela, 18.10" interactive={interactive} />)
}

describe('DaySummary', () => {
  it('shows consumed values next to their targets in a short form', () => {
    renderSummary()

    const summary = screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' })
    const text = summary.textContent ?? ''
    expect(text).toContain('Kcal2680/2200')
    expect(text).toContain('B100135-165')
    expect(text).toContain('T6963-77')
    expect(text).toContain('W302225-275')
  })

  it('shows the excess on the progress bar', () => {
    renderSummary()

    expect(screen.getByTestId('kcal-fill').style.width).toBe('100%')
    expect(Number.parseFloat(screen.getByTestId('kcal-overflow').style.width)).toBeCloseTo(21.8, 1)
    expect(screen.getByTestId('protein-overflow').style.width).toBe('0%')
  })

  it('explains every value with full names after a tap', () => {
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <DaySummary consumed={consumed} targets={targets} dayLabel="Niedziela, 18.10" interactive />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    const dialog = screen.getByRole('dialog', { name: 'Podsumowanie dnia' })
    expect(onParentClick).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Niedziela, 18.10')).toBeTruthy()
    expect(within(dialog).getByText('Kalorie')).toBeTruthy()
    expect(within(dialog).getByText('Za dużo o 480 kcal')).toBeTruthy()
    expect(within(dialog).getByText('Białko')).toBeTruthy()
    expect(within(dialog).getByText('Brakuje 35 g')).toBeTruthy()
    expect(within(dialog).getByText('Tłuszcz')).toBeTruthy()
    expect(within(dialog).getByText('W celu')).toBeTruthy()
    expect(within(dialog).getByText('Węglowodany')).toBeTruthy()
    expect(within(dialog).getByText('Za dużo o 27 g')).toBeTruthy()
  })

  it('closes the details with the close button', () => {
    renderSummary()
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the details when tapping outside them without selecting the day', () => {
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <DaySummary consumed={consumed} targets={targets} dayLabel="Niedziela, 18.10" interactive />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(dialog.parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('moves focus into the details and back to the summary after closing with Escape', () => {
    renderSummary()
    const trigger = screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' })
    fireEvent.click(trigger)

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zamknij' }))

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('stays a plain summary while days or meals are being selected', () => {
    renderSummary(false)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('2680')).toBeTruthy()
  })
})

describe('DaySummary gestures', () => {
  it('closes the details when they are swiped down', () => {
    vi.useFakeTimers()
    renderSummary()

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))
    const sheet = screen.getByRole('dialog')
    fireEvent.touchStart(sheet, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientX: 100, clientY: 400 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientX: 100, clientY: 400 }] })
    act(() => vi.advanceTimersByTime(200))
    vi.useRealTimers()

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
