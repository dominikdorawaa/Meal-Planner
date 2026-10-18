import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UNDO_SNACKBAR_DURATION_MS, UndoSnackbar } from './UndoSnackbar'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('UndoSnackbar', () => {
  it('shows the message with an undo action', () => {
    const onUndo = vi.fn()
    render(<UndoSnackbar message="Skopiowano" onUndo={onUndo} onClose={vi.fn()} />)

    expect(screen.getByRole('status').textContent).toContain('Skopiowano')
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }))

    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('hides the undo action when there is nothing to undo', () => {
    render(<UndoSnackbar message="Nie udało się zapisać zmian." onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Cofnij' })).toBeNull()
  })

  it('closes itself after a few seconds', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<UndoSnackbar message="Skopiowano" onClose={onClose} />)

    act(() => { vi.advanceTimersByTime(UNDO_SNACKBAR_DURATION_MS - 1) })
    expect(onClose).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1) })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('UndoSnackbar duration', () => {
  it('closes itself after a custom time', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<UndoSnackbar message="Usunięto" onClose={onClose} durationMs={5000} />)

    act(() => { vi.advanceTimersByTime(4999) })
    expect(onClose).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1) })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
