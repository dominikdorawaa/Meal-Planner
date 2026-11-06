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
  render(<PlanConflictDialog conflicts={conflicts} busy={busy} {...handlers} />)
  return handlers
}

describe('PlanConflictDialog', () => {
  it('lists the meals already planned in the target slots', () => {
    renderDialog()

    expect(screen.getByRole('alertdialog', { name: 'Te miejsca mają już pozycje w planie' })).toBeTruthy()
    expect(screen.getByText('Omelette')).toBeTruthy()
    expect(screen.getByText('Jutro • Lunch')).toBeTruthy()
  })

  it('runs the chosen action', () => {
    const { onOverwrite, onAppend, onCancel } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Nadpisz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dopisz obok' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(onOverwrite).toHaveBeenCalledOnce()
    expect(onAppend).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cancels when the backdrop is tapped but not when the dialog is tapped', () => {
    const { onCancel } = renderDialog()

    fireEvent.click(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('alertdialog').parentElement!)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cancels with the Escape key and focuses the safe action first', () => {
    const { onCancel } = renderDialog()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anuluj' }))
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('blocks every action while the transfer is saving', () => {
    const { onCancel } = renderDialog(true)

    fireEvent.click(screen.getByRole('alertdialog').parentElement!)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Nadpisz' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Dopisz obok' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
