import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Onboarding } from './Onboarding'
import { setLanguage, t } from '../i18n'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  refreshProfile: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('../lib/apiClient', () => ({
  api: {
    auth: { getUser: mocks.getUser },
    profile: { get: mocks.getProfile, update: mocks.updateProfile },
  },
}))

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({ refreshProfile: mocks.refreshProfile }),
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}))

const alertMock = vi.fn()

function renderOnboarding() {
  return render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.stubGlobal('alert', alertMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getUser.mockReturnValue({ userId: 'user-1' })
  mocks.getProfile.mockResolvedValue(null)
  mocks.updateProfile.mockResolvedValue({})
  mocks.refreshProfile.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Onboarding', () => {
  it('shows a neutral localized message when saving the profile fails', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('Server error (500)'))
    renderOnboarding()

    fireEvent.click(screen.getByText('Pomiń'))

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(t('onboarding.profileSaveFailed')))
    expect(alertMock.mock.calls[0][0]).not.toMatch(/sql|supabase/i)
    expect(mocks.refreshProfile).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('shows the profile save message in English when English is selected', async () => {
    setLanguage('en')
    mocks.updateProfile.mockRejectedValue(new Error('Server error (500)'))
    renderOnboarding()

    fireEvent.click(screen.getByText('Pomiń'))

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith('Could not save your profile. Please try again in a moment.')
    )
  })

  it('asks the user to sign in again when the session has expired', async () => {
    mocks.getUser.mockReturnValue(null)
    renderOnboarding()

    fireEvent.click(screen.getByText('Pomiń'))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/login'))
    expect(alertMock).toHaveBeenCalledWith(t('api.sessionExpired'))
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  it('saves the profile and opens the plan when saving succeeds', async () => {
    renderOnboarding()

    fireEvent.click(screen.getByText('Pomiń'))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/'))
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1', goal: 'reduce' }))
    expect(mocks.refreshProfile).toHaveBeenCalled()
    expect(alertMock).not.toHaveBeenCalled()
  })

  it('loads the existing profile before saving it again', async () => {
    mocks.getProfile.mockResolvedValue({ gender: 'male', age: 40, weight: 80, height: 180, target_weight: 90 })
    renderOnboarding()
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Pomiń'))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ gender: 'male', age: 40, weight: 80, target_weight: 90, goal: 'build' })
      )
    )
  })

  it('hides the skip button on the final summary screen', () => {
    renderOnboarding()

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Dalej'))

    expect(screen.getByText('Idź do Planu Posiłków')).toBeTruthy()
    expect(screen.queryByText('Pomiń')).toBeNull()
  })

  it('saves manually entered macros', async () => {
    renderOnboarding()

    fireEvent.click(screen.getByText('Znasz już swoje makro?'))
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1800' } })
    fireEvent.change(screen.getAllByRole('spinbutton')[3], { target: { value: '220' } })
    fireEvent.click(screen.getByText('Zatwierdź własne makro'))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
        goal: 'manual',
        target_kcal: 1800,
        target_carbs: 220,
        target_carbs_min: 220,
        target_carbs_max: 220,
      }))
    )
    expect(screen.getByText('Węgle (g)')).toBeTruthy()
    expect(screen.queryByText('Pomiń')).toBeNull()
  })

  it('goes back from manual macros to the guided setup', async () => {
    renderOnboarding()

    expect(screen.queryByLabelText('Wstecz')).toBeNull()
    fireEvent.click(screen.getByText('Znasz już swoje makro?'))
    fireEvent.click(screen.getByLabelText('Wstecz'))

    expect(screen.getByText('Opowiedz nam o sobie')).toBeTruthy()
    fireEvent.click(screen.getByText('Pomiń'))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ goal: 'reduce' }))
    )
  })

  it('blocks going back while manual macros are being saved', async () => {
    let resolveSave: (value: unknown) => void = () => {}
    mocks.updateProfile.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    renderOnboarding()

    fireEvent.click(screen.getByText('Znasz już swoje makro?'))
    fireEvent.click(screen.getByText('Zatwierdź własne makro'))

    const backButton = screen.getByLabelText('Wstecz') as HTMLButtonElement
    await waitFor(() => expect(backButton.disabled).toBe(true))
    fireEvent.click(backButton)
    expect(screen.queryByText('Opowiedz nam o sobie')).toBeNull()

    resolveSave({})
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/'))
  })

  it('goes back one step in the guided setup', () => {
    renderOnboarding()

    fireEvent.click(screen.getByText('Dalej'))
    expect(screen.getByText('Twoje wymiary')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Wstecz'))

    expect(screen.getByText('Opowiedz nam o sobie')).toBeTruthy()
  })
})
