import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

afterEach(cleanup)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  it('keeps the menu above the phone gesture bar', () => {
    const { container } = renderAt('/')

    expect(container.querySelector('nav > div')?.className).toContain('bottom-[calc(1.5rem+env(safe-area-inset-bottom))]')
  })

  it('links to every main section', () => {
    renderAt('/')

    const targets = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(targets).toEqual(['/', '/recipes', '/cart', '/profile'])
  })

  it('highlights the section that is currently open', () => {
    renderAt('/recipes')

    const [plan, recipes] = screen.getAllByRole('link')
    expect(recipes.className.split(' ')).toContain('text-primary')
    expect(recipes.className).toContain('bg-primary/10')
    expect(plan.className).toContain('text-primary/50')
  })
})
