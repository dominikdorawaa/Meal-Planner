import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InstallAppCard } from './InstallAppCard'
import { t } from '../i18n'

const ANDROID_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'

function mockEnvironment({ userAgent = ANDROID_USER_AGENT, standalone = false, maxTouchPoints = 0 } = {}) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
  window.matchMedia = vi.fn().mockReturnValue({ matches: standalone }) as unknown as typeof window.matchMedia
}

function createInstallPromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  const prompt = vi.fn().mockResolvedValue(undefined)
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) })
  return { event, prompt }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window.navigator, 'standalone')
  Reflect.deleteProperty(window.navigator, 'maxTouchPoints')
})

describe('InstallAppCard', () => {
  it('renders nothing when the browser cannot install the app', () => {
    mockEnvironment()

    const { container } = render(<InstallAppCard />)

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when the app already runs installed', () => {
    mockEnvironment({ userAgent: IPHONE_USER_AGENT, standalone: true })

    const { container } = render(<InstallAppCard />)

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when the app was opened from the iPhone home screen', () => {
    mockEnvironment({ userAgent: IPHONE_USER_AGENT })
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })

    const { container } = render(<InstallAppCard />)

    expect(container.innerHTML).toBe('')
  })

  it('shows manual instructions on an iPad that reports a desktop browser', () => {
    mockEnvironment({ userAgent: IPAD_DESKTOP_USER_AGENT, maxTouchPoints: 5 })

    render(<InstallAppCard />)

    expect(screen.getByText(t('install.iosHint'))).toBeTruthy()
  })

  it('renders nothing on a Mac without a touch screen', () => {
    mockEnvironment({ userAgent: IPAD_DESKTOP_USER_AGENT })

    const { container } = render(<InstallAppCard />)

    expect(container.innerHTML).toBe('')
  })

  it('shows manual instructions on iPhone', () => {
    mockEnvironment({ userAgent: IPHONE_USER_AGENT })

    render(<InstallAppCard />)

    expect(screen.getByText(t('install.iosHint'))).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the install button after the browser offers installation and hides it once accepted', async () => {
    mockEnvironment()
    render(<InstallAppCard />)
    const { event, prompt } = createInstallPromptEvent('accepted')

    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(t('install.title')) }))
    })

    expect(prompt).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the install button again when the browser offers installation after a dismissal', async () => {
    mockEnvironment()
    render(<InstallAppCard />)

    act(() => {
      window.dispatchEvent(createInstallPromptEvent('dismissed').event)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(t('install.title')) }))
    })
    expect(screen.queryByRole('button')).toBeNull()

    act(() => {
      window.dispatchEvent(createInstallPromptEvent('accepted').event)
    })

    expect(screen.getByRole('button', { name: new RegExp(t('install.title')) })).toBeTruthy()
  })

  it('hides the install button when the app gets installed from the browser menu', () => {
    mockEnvironment()
    render(<InstallAppCard />)

    act(() => {
      window.dispatchEvent(createInstallPromptEvent('accepted').event)
    })
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(screen.queryByRole('button')).toBeNull()
  })
})
