import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MealSettingsList } from './MealSettingsList'

const meals = [
  { id: 'breakfast', name: 'Breakfast', visible: true },
  { id: 'lunch', name: 'Lunch', visible: true },
  { id: 'dinner', name: 'Dinner', visible: true },
]

function rowRect(element: Element) {
  const row = element.closest('[data-meal-index]') ?? element
  const index = Number(row.getAttribute('data-meal-index') ?? 0)
  const top = index * 100
  return { x: 0, y: top, top, left: 0, right: 300, bottom: top + 80, width: 300, height: 80, toJSON: () => ({}) } as DOMRect
}

async function pressKey(element: HTMLElement, code: string) {
  await act(async () => {
    fireEvent.keyDown(element, { code })
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

function renderList(isReordering: boolean, onReorder = vi.fn()) {
  render(
    <MealSettingsList
      meals={meals}
      isReordering={isReordering}
      onReorder={onReorder}
      renderMeal={(meal, index, handle) => (
        <div data-meal-index={index}>
          {handle}
          <span>{meal.name}</span>
        </div>
      )}
    />
  )
  return onReorder
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rowRect(this.querySelector('[data-meal-index]') ?? this)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MealSettingsList', () => {
  it('renders meals in the given order without drag handles outside reorder mode', () => {
    renderList(false)

    expect(screen.getAllByText(/Breakfast|Lunch|Dinner/).map(node => node.textContent)).toEqual(['Breakfast', 'Lunch', 'Dinner'])
    expect(screen.queryByRole('button', { name: /Przeciągnij/ })).toBeNull()
  })

  it('shows a touch friendly drag handle for every meal in reorder mode', () => {
    renderList(true)

    const handles = screen.getAllByRole('button', { name: /Przeciągnij/ })
    expect(handles).toHaveLength(3)
    expect(handles[0].className).toContain('touch-none')
  })

  it('moves a meal with the keyboard through its drag handle', async () => {
    const onReorder = renderList(true)
    const handle = screen.getByRole('button', { name: 'Przeciągnij: Breakfast' })

    handle.focus()
    await pressKey(handle, 'Space')
    await pressKey(handle, 'ArrowDown')
    await pressKey(handle, 'Space')

    expect(onReorder).toHaveBeenCalledWith([meals[1], meals[0], meals[2]])
  })

  it('does not report a change when a drag ends where it started', async () => {
    const onReorder = renderList(true)
    const handle = screen.getByRole('button', { name: 'Przeciągnij: Lunch' })

    handle.focus()
    await pressKey(handle, 'Space')
    await pressKey(handle, 'Space')

    expect(onReorder).not.toHaveBeenCalled()
  })
})
