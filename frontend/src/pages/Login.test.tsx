import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Login } from './Login'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('../lib/apiClient', () => ({
  api: { auth: { login: mocks.login, register: mocks.register } },
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}))

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Login', () => {
  it('shows the app logo above the app name', () => {
    const { container } = renderLogin()

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/favicon.svg')
    expect(screen.getByRole('heading', { name: 'Calendories' })).toBeTruthy()
  })

  it('logs in with the entered credentials', async () => {
    mocks.login.mockResolvedValue(undefined)
    const authChange = vi.fn()
    window.addEventListener('auth-change', authChange)
    const { container } = renderLogin()

    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'ola@example.com' } })
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'test-password' } })
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(authChange).toHaveBeenCalledOnce())
    expect(mocks.login).toHaveBeenCalledWith('ola@example.com', 'test-password')
    window.removeEventListener('auth-change', authChange)
  })

  it('registers a new account and opens onboarding', async () => {
    mocks.register.mockResolvedValue(undefined)
    const { container } = renderLogin()

    fireEvent.click(screen.getByRole('button', { name: 'Pierwszy raz? Załóż konto próbne' }))
    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: 'Ola' } })
    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'ola@example.com' } })
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'test-password' } })
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/onboarding'))
    expect(mocks.register).toHaveBeenCalledWith('ola@example.com', 'test-password', 'Ola')
  })

  it('shows the error message when logging in fails', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid credentials'))
    const { container } = renderLogin()

    fireEvent.submit(container.querySelector('form')!)

    expect(await screen.findByText('Invalid credentials')).toBeTruthy()
  })
})
