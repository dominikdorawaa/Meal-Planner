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
  it('keeps macro bars the same length whatever the numbers next to them', () => {
    renderSummary()

    const rows = ['protein', 'fat', 'carbs'].map(key => screen.getByTestId(`${key}-fill`).closest('.grid') as HTMLElement)
    expect(rows.every(row => row.className.includes('grid-cols-[9px_minmax(0,1fr)_44px]'))).toBe(true)
  })

  it('shows consumed values next to their targets in a short form', () => {
    renderSummary()

    const summary = screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' })
    const text = summary.textContent ?? ''
    expect(text).toContain('2680kcalz 2200')
    expect(text).toContain('B100/150')
    expect(text).toContain('T69/70')
    expect(text).toContain('W302/250')
  })

  it('shows the excess on the progress bar', () => {
    renderSummary()

    expect(screen.getByTestId('kcal-fill').style.width).toBe('100%')
    expect(Number.parseFloat(screen.getByTestId('kcal-overflow').style.width)).toBeCloseTo(21.8, 1)
    expect(screen.getByTestId('protein-overflow').style.width).toBe('0%')
  })

  it('colors the macro bars like the recipe rings and keeps kcal in the primary color', () => {
    renderSummary()

    expect(screen.getByTestId('kcal-fill').className).toContain('bg-primary')
    expect(screen.getByTestId('protein-fill').className).toContain('bg-macro-protein')
    expect(screen.getByTestId('fat-fill').className).toContain('bg-macro-fat')
    expect(screen.getByTestId('carbs-fill').className).toContain('bg-macro-carbs')
    expect(screen.getByTestId('carbs-overflow').className).toContain('bg-error')
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
    expect(within(dialog).getByText('480 kcal za dużo')).toBeTruthy()
    expect(within(dialog).getByText('Białko')).toBeTruthy()
    expect(within(dialog).getByText('brakuje 35 g')).toBeTruthy()
    expect(within(dialog).getByText('Tłuszcz')).toBeTruthy()
    expect(within(dialog).getByText('W celu')).toBeTruthy()
    expect(within(dialog).getByText('Węglowodany')).toBeTruthy()
    expect(within(dialog).getByText('27 g za dużo')).toBeTruthy()
  })

  it('shows the exact calorie difference to the goal', () => {
    render(<DaySummary consumed={{ ...consumed, kcal: 2243 }} targets={{ ...targets, target_kcal: 3006 }} dayLabel="Niedziela, 18.10" interactive />)
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    expect(within(screen.getByRole('dialog')).getByText('brakuje 763 kcal')).toBeTruthy()
  })

  it('keeps calories close to the goal green while showing what is left or exceeded', () => {
    const { unmount } = render(<DaySummary consumed={{ ...consumed, kcal: 2170 }} targets={targets} dayLabel="Niedziela, 18.10" interactive />)
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))
    expect(within(screen.getByRole('dialog')).getByText('brakuje 30 kcal')).toBeTruthy()
    expect(screen.getByTestId('kcal-compact-value').className).toContain('text-primary')
    unmount()

    render(<DaySummary consumed={{ ...consumed, kcal: 2220 }} targets={targets} dayLabel="Niedziela, 18.10" interactive />)
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))
    const overLabel = within(screen.getByRole('dialog')).getByText('20 kcal za dużo')
    expect(overLabel.className).not.toContain('text-error')
    expect(screen.getByTestId('kcal-compact-value').className).toContain('text-primary')
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
  it('closes the details when tapping outside them', () => {
    renderSummary()
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the details from the bottom of the screen', () => {
    renderSummary()

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    const sheet = screen.getByRole('dialog')
    expect(sheet.className).toContain('rounded-t-[28px]')
    expect((sheet.parentElement as HTMLElement).className).toContain('justify-end')
  })

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

  it('shows each value next to its goal with a colored dot and a bar', () => {
    renderSummary()
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('2680 / 2200 kcal')).toBeTruthy()
    expect(dialog.getByText('100 / 135-165 g')).toBeTruthy()
    expect(dialog.getByText('480 kcal za dużo').className).toContain('text-error')
    expect(dialog.getByText('brakuje 35 g').className).toContain('text-primary')
    expect(dialog.getAllByTestId('protein-fill').length).toBeGreaterThan(0)
  })
})

describe('DaySummary with very large values', () => {
  const huge = { kcal: 123456, protein: 25000, fat: 9999, carbs: 1000000 }
  const maxTargets = { target_kcal: 10000, target_protein: 500, target_fat: 300, target_carbs: 1000 }

  it('shortens the values so they fit in the day column', () => {
    render(<DaySummary consumed={huge} targets={maxTargets} dayLabel="Niedziela, 18.10" interactive={false} />)

    expect(screen.getByTestId('kcal-compact-value').textContent).toBe('123,5 tys.')
    expect(screen.getByTestId('protein-compact-value').textContent).toBe('25 tys.')
    expect(screen.getByTestId('fat-compact-value').textContent).toBe('9999')
    expect(screen.getByTestId('carbs-compact-value').textContent).toBe('1 mln')
    expect(screen.getByTestId('kcal-compact-value').className).toContain('truncate')
    expect(screen.getByTestId('kcal-compact-value').className).toContain('text-[clamp(11px,3.6vw,14px)]')
    expect(screen.getByTestId('fat-compact-value').parentElement?.className).toContain('text-[clamp(7.5px,2.4vw,8.5px)]')
  })

  it('shortens the values and the excess in the details', () => {
    render(<DaySummary consumed={huge} targets={maxTargets} dayLabel="Niedziela, 18.10" interactive />)
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż podsumowanie dnia: Niedziela, 18.10' }))

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('123,5 tys. / 10 tys. kcal')).toBeTruthy()
    expect(dialog.getByText('113,5 tys. kcal za dużo')).toBeTruthy()
    expect(dialog.getByText('25 tys. / 450-550 g')).toBeTruthy()
  })
})
