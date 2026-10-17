import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlanConflictDialog } from './PlanConflictDialog'

const conflicts = [
  { id: 'meal-1', title: 'Omelette', detail: 'Jutro • Śniadanie' },
  { id: 'meal-2', title: 'Coffee', detail: 'Jutro • Lunch' },
]

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderDialog(busy = false) {
  const handlers = { onOverwrite: vi.fn(), onAppend: vi.fn(), onCancel: vi.fn() }
  const view = render(<PlanConflictDialog conflicts={conflicts} busy={busy} {...handlers} />)
  return { ...handlers, view }
}

describe('PlanConflictDialog', () => {
  it('lists the meals already planned in the target slots', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Te miejsca mają już posiłki' })).toBeTruthy()
    expect(screen.getByText('Omelette')).toBeTruthy()
    expect(screen.getByText('Jutro • Lunch')).toBeTruthy()
  })

  it('runs the chosen action', () => {
    const { onOverwrite, onAppend, onCancel } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Nadpisz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dopisz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(onOverwrite).toHaveBeenCalledOnce()
    expect(onAppend).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cancels when the backdrop is tapped but not when the dialog is tapped', () => {
    const { onCancel, view } = renderDialog()

    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(view.container.firstChild as HTMLElement)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cancels with the Escape key and focuses the safe action first', () => {
    const { onCancel } = renderDialog()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anuluj' }))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('blocks every action while the transfer is saving', () => {
    const { onCancel, view } = renderDialog(true)

    fireEvent.click(view.container.firstChild as HTMLElement)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Nadpisz' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Dopisz' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
