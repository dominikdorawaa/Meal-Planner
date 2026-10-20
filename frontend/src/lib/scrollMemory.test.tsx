import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { ScrollMemory } from './scrollMemory'

let maxScroll = 10_000

function setScroll(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: Math.max(0, Math.min(y, maxScroll)) })
}

function userScrollsTo(y: number) {
  setScroll(y)
  fireEvent.scroll(window)
}

function Screen({ name }: { name: string }) {
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="screen">{name}</output>
      <button type="button" onClick={() => navigate('/recipes', { replace: true })}>recipes tab</button>
      <button type="button" onClick={() => navigate('/cart', { replace: true })}>cart tab</button>
      <button type="button" onClick={() => navigate('/recipe/1')}>details</button>
      <button type="button" onClick={() => navigate('/recipes?q=soup', { replace: true })}>search</button>
      <button type="button" onClick={() => navigate(-1)}>back</button>
    </>
  )
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/recipes']}>
      <ScrollMemory />
      <Routes>
        <Route path="/recipes" element={<Screen name="recipes" />} />
        <Route path="/cart" element={<Screen name="cart" />} />
        <Route path="/recipe/:id" element={<Screen name="details" />} />
      </Routes>
    </MemoryRouter>
  )
}

function press(name: string) {
  fireEvent.click(screen.getByText(name))
}

beforeEach(() => {
  maxScroll = 10_000
  setScroll(0)
  vi.spyOn(window, 'scrollTo').mockImplementation(((_x: number, y: number) => setScroll(y)) as typeof window.scrollTo)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ScrollMemory', () => {
  it('keeps a separate scroll position for every tab', () => {
    renderApp()
    userScrollsTo(500)

    press('cart tab')
    expect(window.scrollY).toBe(0)
    userScrollsTo(120)

    press('recipes tab')
    expect(window.scrollY).toBe(500)

    press('cart tab')
    expect(window.scrollY).toBe(120)
  })

  it('opens details from the top and restores the list after going back', () => {
    renderApp()
    userScrollsTo(800)

    press('details')
    expect(window.scrollY).toBe(0)
    userScrollsTo(300)

    press('back')
    expect(screen.getByTestId('screen').textContent).toBe('recipes')
    expect(window.scrollY).toBe(800)
  })

  it('leaves the position alone when only the address of the same screen changes', () => {
    renderApp()
    userScrollsTo(450)

    press('search')

    expect(window.scrollY).toBe(450)
  })

  it('keeps trying until the restored screen is tall enough', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    renderApp()
    userScrollsTo(900)
    press('cart tab')

    maxScroll = 200
    press('recipes tab')
    expect(window.scrollY).toBe(200)
    fireEvent.scroll(window)

    maxScroll = 10_000
    act(() => { vi.advanceTimersByTime(50) })
    expect(window.scrollY).toBe(900)
  })

  it('gives up restoring once the user touches the screen', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    renderApp()
    userScrollsTo(900)
    press('cart tab')

    maxScroll = 200
    press('recipes tab')
    fireEvent.touchStart(window)
    maxScroll = 10_000
    act(() => { vi.advanceTimersByTime(50) })

    expect(window.scrollY).toBe(200)
    press('cart tab')
    press('recipes tab')
    expect(window.scrollY).toBe(200)
  })

  it('gives up restoring when the screen never gets tall enough', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    renderApp()
    userScrollsTo(900)
    press('cart tab')

    maxScroll = 200
    press('recipes tab')
    act(() => { vi.advanceTimersByTime(2000) })
    maxScroll = 10_000
    act(() => { vi.advanceTimersByTime(100) })

    expect(window.scrollY).toBe(200)
  })
})
