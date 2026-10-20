import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'

afterEach(cleanup)

function TabPage() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="path">{location.pathname}</output>
      <button type="button" onClick={() => navigate(-1)}>system back</button>
      <button type="button" onClick={() => navigate('/recipe/1')}>open details</button>
      <BottomNav />
    </>
  )
}

function DetailsPage() {
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="path">details</output>
      <button type="button" onClick={() => navigate(-1)}>system back</button>
    </>
  )
}

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={['/start', ...initialEntries]} initialIndex={initialEntries.length}>
      <Routes>
        <Route path="/start" element={<output data-testid="path">outside</output>} />
        <Route path="/" element={<TabPage />} />
        <Route path="/recipes" element={<TabPage />} />
        <Route path="/cart" element={<TabPage />} />
        <Route path="/profile" element={<TabPage />} />
        <Route path="/recipe/:id" element={<DetailsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function currentPath() {
  return screen.getByTestId('path').textContent
}

function swipe(dx: number) {
  const startX = 200
  fireEvent.touchStart(document.body, { touches: [{ clientX: startX, clientY: 300 }] })
  fireEvent.touchEnd(document.body, { changedTouches: [{ clientX: startX + dx, clientY: 305 }] })
}

function tab(name: string) {
  return screen.getByRole('link', { name })
}

describe('BottomNav', () => {
  it('floats close to the bottom edge above the phone gesture bar', () => {
    renderApp()

    expect(screen.getByRole('navigation').querySelector('div')?.className).toContain('bottom-[calc(0.5rem+env(safe-area-inset-bottom))]')
  })

  it('links to every main section with translated labels', () => {
    renderApp()

    const links = screen.getAllByRole('link')
    expect(links.map(link => link.textContent)).toEqual(['calendar_monthPlan', 'restaurant_menuPrzepisy', 'list_altZakupy', 'more_horizWięcej'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/', '/recipes', '/cart', '/profile'])
  })

  it('highlights the section that is currently open', () => {
    renderApp(['/recipes'])

    expect(tab('restaurant_menuPrzepisy').getAttribute('aria-current')).toBe('page')
    expect(tab('restaurant_menuPrzepisy').className).toContain('bg-primary/10')
    expect(tab('calendar_monthPlan').getAttribute('aria-current')).toBeNull()
    expect(tab('calendar_monthPlan').className).toContain('text-primary/50')
  })

  it('returns to the plan when going back from another tab', () => {
    renderApp()

    fireEvent.click(tab('restaurant_menuPrzepisy'))
    fireEvent.click(tab('list_altZakupy'))
    fireEvent.click(tab('more_horizWięcej'))
    expect(currentPath()).toBe('/profile')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('/')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('outside')
  })

  it('goes back in history when the plan tab is picked after leaving the plan', () => {
    renderApp()

    fireEvent.click(tab('list_altZakupy'))
    fireEvent.click(tab('calendar_monthPlan'))
    expect(currentPath()).toBe('/')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('outside')
  })

  it('puts the plan below a tab that was opened directly', () => {
    renderApp(['/cart'])
    expect(currentPath()).toBe('/cart')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('/')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('outside')
  })

  it('returns to the plan after switching tabs from a tab opened directly', () => {
    renderApp(['/recipes'])

    fireEvent.click(tab('list_altZakupy'))
    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('/')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('outside')
  })

  it('goes back to the plan below when the plan tab is picked on a tab opened directly', () => {
    renderApp(['/profile'])

    fireEvent.click(tab('calendar_monthPlan'))
    expect(currentPath()).toBe('/')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('outside')
  })

  it('keeps the way back to the plan after visiting details from a tab', () => {
    renderApp()

    fireEvent.click(tab('restaurant_menuPrzepisy'))
    fireEvent.click(screen.getByText('open details'))
    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('/recipes')

    fireEvent.click(screen.getByText('system back'))
    expect(currentPath()).toBe('/')
  })

  it('scrolls the open tab to the top when its tab is picked again', () => {
    const calls: unknown[] = []
    const original = window.scrollTo
    window.scrollTo = ((...args: unknown[]) => { calls.push(args[0]) }) as typeof window.scrollTo
    try {
      renderApp(['/recipes'])

      fireEvent.click(tab('restaurant_menuPrzepisy'))

      expect(currentPath()).toBe('/recipes')
      expect(calls).toEqual([{ top: 0, behavior: 'smooth' }])
    } finally {
      window.scrollTo = original
    }
  })

  it('switches to the neighbouring tab after a horizontal swipe', () => {
    renderApp()
    fireEvent.click(tab('restaurant_menuPrzepisy'))

    swipe(-120)
    expect(currentPath()).toBe('/cart')

    swipe(120)
    swipe(120)
    expect(currentPath()).toBe('/')
  })

  it('ignores swipes on the plan and past the last tab', () => {
    renderApp()
    swipe(-120)
    expect(currentPath()).toBe('/')

    fireEvent.click(tab('more_horizWięcej'))
    swipe(-120)
    expect(currentPath()).toBe('/profile')
  })

  it('ignores a gesture that started where a swipe is not allowed', () => {
    renderApp(['/recipes'])
    const input = document.createElement('input')
    document.body.appendChild(input)

    fireEvent.touchStart(input, { touches: [{ clientX: 300, clientY: 300 }] })
    fireEvent.touchEnd(input, { changedTouches: [{ clientX: 180, clientY: 300 }] })
    fireEvent.touchCancel(window)
    fireEvent.touchEnd(document.body, { changedTouches: [{ clientX: 180, clientY: 300 }] })

    expect(currentPath()).toBe('/recipes')
    input.remove()
  })

  it('hides while a text field has focus so it does not cover the keyboard area', () => {
    renderApp()
    const input = document.createElement('input')
    document.body.appendChild(input)
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    document.body.appendChild(checkbox)

    act(() => input.focus())
    expect(screen.getByRole('navigation', { hidden: true }).getAttribute('aria-hidden')).toBe('true')

    act(() => checkbox.focus())
    expect(screen.getByRole('navigation').getAttribute('aria-hidden')).toBeNull()

    input.remove()
    checkbox.remove()
  })

  it('shows again when the focused text field is removed together with its sheet', async () => {
    renderApp()
    const sheet = document.createElement('div')
    const input = document.createElement('input')
    sheet.appendChild(input)
    document.body.appendChild(sheet)
    act(() => input.focus())
    expect(screen.getByRole('navigation', { hidden: true }).getAttribute('aria-hidden')).toBe('true')

    act(() => sheet.remove())

    await waitFor(() => expect(screen.getByRole('navigation').getAttribute('aria-hidden')).toBeNull())
  })
})
