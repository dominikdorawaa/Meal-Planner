import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { newRecipeImage } from '../lib/recipeImage'
import { PlanAction, PlanActionGroup, PlanActionSheet, PlanSheetDayBadge, PlanSheetThumb } from './PlanActionSheet'

afterEach(cleanup)

function renderSheet(onClose = vi.fn(), onAction = vi.fn()) {
  render(
    <MemoryRouter>
      <PlanActionSheet label="Manage meal" title="Oatmeal" meta={<span>Breakfast</span>} leading={<span>thumb</span>} onClose={onClose}>
        <PlanActionGroup>
          <PlanAction icon="edit" label="Edit meal" onClick={onAction} />
          <PlanAction icon="delete" label="Delete meal" onClick={onAction} danger />
        </PlanActionGroup>
      </PlanActionSheet>
    </MemoryRouter>,
  )
  return { onClose, onAction }
}

describe('PlanActionSheet', () => {
  it('shows the item context and its actions in a named dialog', () => {
    const { onAction } = renderSheet()

    const dialog = screen.getByRole('dialog', { name: 'Manage meal' })
    expect(dialog.textContent).toContain('Oatmeal')
    expect(dialog.textContent).toContain('Breakfast')
    fireEvent.click(screen.getByRole('button', { name: 'Edit meal' }))

    expect(onAction).toHaveBeenCalledOnce()
  })

  it('marks destructive actions with the error color', () => {
    renderSheet()

    expect(screen.getByRole('button', { name: 'Delete meal' }).className).toContain('text-error')
    expect(screen.getByRole('button', { name: 'Edit meal' }).className).not.toContain('text-error')
  })

  it('closes with the close button, a tap outside and Escape', () => {
    const { onClose } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }))
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('keeps taps inside the sheet from closing it', () => {
    const { onClose } = renderSheet()

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('PlanSheetThumb', () => {
  it('shows a product photo and falls back to an icon when it fails', () => {
    const { container } = render(<PlanSheetThumb kind="product" imageUrl="https://example.com/milk.png" alt="Milk" />)

    fireEvent.error(screen.getByAltText('Milk'))

    expect(screen.queryByAltText('Milk')).toBeNull()
    expect(container.textContent).toBe('nutrition')
  })

  it('shows a lightning icon for a quick meal', () => {
    const { container } = render(<PlanSheetThumb kind="manual" alt="Snack" />)

    expect(container.textContent).toBe('bolt')
  })

  it('shows the recipe cover for a recipe', () => {
    render(<PlanSheetThumb kind="recipe" recipeImage={newRecipeImage('https://example.com/oats.png')} alt="Oatmeal" />)

    expect(screen.getAllByAltText('Oatmeal').length).toBeGreaterThan(0)
  })
})

describe('PlanSheetDayBadge', () => {
  it('fills today with the today color', () => {
    const { container } = render(<PlanSheetDayBadge day={11} weekday="Śr" isToday />)

    expect(container.textContent).toBe('11Śr')
    expect((container.firstChild as HTMLElement).className).toContain('bg-today')
  })

  it('keeps other days on a neutral surface', () => {
    const { container } = render(<PlanSheetDayBadge day={12} weekday="Czw" isToday={false} />)

    expect((container.firstChild as HTMLElement).className).toContain('bg-surface-container-high')
  })
})
