import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function next() {
  fireEvent.click(screen.getByRole('button', { name: /^(Dalej|Pokaż mój cel)$/ }))
}

function heading() {
  return screen.getByRole('heading', { level: 1 }).textContent
}

function typeInto(label: string, value: string) {
  const input = screen.getByLabelText(label)
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

async function finish() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Zaplanuj dzisiejszy dzień/ }))
  })
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

describe('Onboarding guided setup', () => {
  it('starts with the goal, suggests a target and saves the calculated plan', async () => {
    renderOnboarding()

    expect(heading()).toBe('Co chcesz osiągnąć?')
    expect(screen.getByText('Krok 1 z 5')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Schudnąć/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Wróć' })).toBeNull()
    next()

    expect(heading()).toBe('Opowiedz nam o sobie')
    expect((screen.getByLabelText('Waga') as HTMLInputElement).value).toBe('70,0')
    next()

    expect(heading()).toBe('Ile chcesz schudnąć?')
    expect(screen.getByText(/Teraz ważysz 70 kg/)).toBeTruthy()
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('66,5')
    expect(screen.getByText('Zalecamy 0,5 kg na tydzień.')).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
    next()

    expect(heading()).toBe('Jak wygląda Twój zwykły dzień?')
    expect(screen.getByRole('radio', { name: /Lekki/ }).textContent).toContain('+145 kcal')
    next()

    expect(heading()).toBe('Ile razy w tygodniu trenujesz?')
    next()

    expect(heading()).toBe('Gotowe, możesz planować')
    const goal = within(screen.getByRole('region', { name: 'Twój dzienny cel' }))
    expect(goal.getByText('1242')).toBeTruthy()
    expect(goal.getByText('140-168 g')).toBeTruthy()
    expect(goal.getByText('Cel osiągniesz', { exact: false }).textContent).toMatch(/za 7 tyg\., −3,5 kg/)
    expect(screen.queryByRole('progressbar')).toBeNull()

    await finish()

    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
      goal: 'reduce',
      gender: 'female',
      weight: 70,
      target_weight: 66.5,
      change_speed: 0.5,
      is_manual_macros: false,
      target_kcal: 1242,
      target_protein_min: 140,
      target_protein_max: 168,
    }))
    expect(mocks.updateProfile.mock.calls[0][0]).not.toHaveProperty('display_name')
    expect(mocks.refreshProfile).toHaveBeenCalled()
    expect(mocks.navigate).toHaveBeenCalledWith('/')
    expect(localStorage.getItem('mp_onboarding_draft')).toBeNull()
  })

  it('skips the target step when keeping the weight', async () => {
    renderOnboarding()
    fireEvent.click(screen.getByRole('radio', { name: /Utrzymać wagę/ }))
    expect(screen.getByText('Krok 1 z 4')).toBeTruthy()
    next()
    fireEvent.click(screen.getByRole('radio', { name: /Mężczyzna/ }))
    next()

    expect(heading()).toBe('Jak wygląda Twój zwykły dzień?')
    expect(screen.getByText('Krok 3 z 4')).toBeTruthy()
    next()
    next()

    expect(screen.queryByText('Cel osiągniesz', { exact: false })).toBeNull()
    await finish()
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ goal: 'maintain', gender: 'male', target_weight: 70 }))
  })

  it('suggests a higher target when gaining and keeps a changed target', () => {
    renderOnboarding()
    fireEvent.click(screen.getByRole('radio', { name: /Przybrać na masie/ }))
    next()
    next()

    expect(heading()).toBe('Ile chcesz przybrać?')
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('73,5')
    expect(screen.getByText(/przybywa więcej tłuszczu/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Zwiększ: Cel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }))
    next()
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('74,0')
  })

  it('suggests a new target when the goal changes or the target ends up on the wrong side', () => {
    renderOnboarding()
    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: 'Zmniejsz: Cel' }))
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('66,0')

    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }))
    typeInto('Waga', '60')
    next()
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('57,0')

    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }))
    fireEvent.click(screen.getByRole('radio', { name: /Przybrać na masie/ }))
    next()
    next()
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('63,0')
  })

  it('warns gently when the target is below a healthy weight', () => {
    renderOnboarding()
    next()
    next()
    typeInto('Cel', '50')

    const note = screen.getByRole('note')
    expect(note.textContent).toContain('To poniżej zdrowej wagi')
    expect(note.textContent).toContain('Przy wzroście 170 cm zdrowa waga zaczyna się od około 54 kg')
    next()
    expect(heading()).toBe('Jak wygląda Twój zwykły dzień?')
  })

  it('remembers the progress after the app is closed', () => {
    renderOnboarding()
    next()
    typeInto('Wiek', '41')
    cleanup()
    mocks.getProfile.mockClear()

    renderOnboarding()
    expect(heading()).toBe('Opowiedz nam o sobie')
    expect((screen.getByLabelText('Wiek') as HTMLInputElement).value).toBe('41')
    expect(mocks.getProfile).not.toHaveBeenCalled()
  })

  it('ignores a saved progress that cannot be read', () => {
    localStorage.setItem('mp_onboarding_draft', '{broken')
    renderOnboarding()
    expect(heading()).toBe('Co chcesz osiągnąć?')
    cleanup()

    localStorage.setItem('mp_onboarding_draft', JSON.stringify({ step: 'body' }))
    renderOnboarding()
    expect(heading()).toBe('Co chcesz osiągnąć?')
  })

  it('starts from the existing profile when there is no saved progress', async () => {
    mocks.getProfile.mockResolvedValue({ gender: 'male', age: 23, height: 182, weight: 80, target_weight: 84, change_speed: 0.3 })
    renderOnboarding()

    await waitFor(() => expect(screen.getByRole('radio', { name: /Przybrać na masie/ }).getAttribute('aria-checked')).toBe('true'))
    next()
    expect((screen.getByLabelText('Waga') as HTMLInputElement).value).toBe('80,0')
    next()
    expect((screen.getByLabelText('Cel') as HTMLInputElement).value).toBe('84,0')
    expect((screen.getByLabelText('Tempo na tydzień') as HTMLInputElement).value).toBe('0,3')
  })

  it('keeps the answers given before the existing profile arrives', async () => {
    let resolveProfile: (value: unknown) => void = () => {}
    mocks.getProfile.mockReturnValue(new Promise(resolve => {
      resolveProfile = resolve
    }))
    renderOnboarding()
    fireEvent.click(screen.getByRole('radio', { name: /Utrzymać wagę/ }))

    await act(async () => {
      resolveProfile({ gender: 'male', weight: 80, target_weight: 84, display_name: 'Ola' })
    })

    expect(screen.getByRole('radio', { name: /Utrzymać wagę/ }).getAttribute('aria-checked')).toBe('true')
    next()
    expect((screen.getByLabelText('Waga') as HTMLInputElement).value).toBe('70,0')
  })

  it('does not ask for the profile without a signed in user', () => {
    mocks.getUser.mockReturnValue(null)
    renderOnboarding()
    expect(mocks.getProfile).not.toHaveBeenCalled()
  })

  it('explains the goal and goes back to the right step from the explanation', () => {
    renderOnboarding()
    for (let index = 0; index < 5; index += 1) next()

    fireEvent.click(screen.getByRole('button', { name: 'Skąd 1242 kcal?' }))
    const breakdown = within(screen.getByRole('region', { name: 'Skąd 1242 kcal?' }))
    expect(breakdown.getByText('1452')).toBeTruthy()
    fireEvent.click(breakdown.getByRole('button', { name: /Zmień dane/ }))
    expect(heading()).toBe('Opowiedz nam o sobie')

    for (let index = 0; index < 4; index += 1) next()
    fireEvent.click(screen.getByRole('button', { name: 'Skąd 1242 kcal?' }))
    fireEvent.click(screen.getByRole('button', { name: /Zmień aktywność/ }))
    expect(heading()).toBe('Jak wygląda Twój zwykły dzień?')

    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: 'Skąd 1242 kcal?' }))
    fireEvent.click(screen.getByRole('button', { name: /Zmień cel i tempo/ }))
    expect(heading()).toBe('Ile chcesz schudnąć?')

    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }))
    fireEvent.click(screen.getByRole('radio', { name: /Utrzymać wagę/ }))
    for (let index = 0; index < 4; index += 1) next()
    fireEvent.click(screen.getByRole('button', { name: /^Skąd/ }))
    fireEvent.click(screen.getByRole('button', { name: /Zmień cel i tempo/ }))
    expect(heading()).toBe('Co chcesz osiągnąć?')

    for (let index = 0; index < 4; index += 1) next()
    fireEvent.click(screen.getByRole('button', { name: /^Skąd/ }))
    fireEvent.click(within(screen.getByRole('region', { name: /^Skąd/ })).getByRole('button', { name: 'Wróć' }))
    expect(heading()).toBe('Gotowe, możesz planować')
  })
})

describe('Onboarding saving', () => {
  async function goToResultAndFinish() {
    renderOnboarding()
    for (let index = 0; index < 5; index += 1) next()
    await finish()
  }

  it('shows a neutral localized message when saving the profile fails', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('Server error (500)'))
    await goToResultAndFinish()

    expect(alertMock).toHaveBeenCalledWith(t('onboarding.profileSaveFailed'))
    expect(alertMock.mock.calls[0][0]).not.toMatch(/sql|supabase/i)
    expect(mocks.refreshProfile).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(heading()).toBe('Gotowe, możesz planować')
  })

  it('shows the profile save message in English when English is selected', async () => {
    setLanguage('en')
    mocks.updateProfile.mockRejectedValue(new Error('Server error (500)'))
    renderOnboarding()
    for (let index = 0; index < 5; index += 1) fireEvent.click(screen.getByRole('button', { name: /^(Next|Show my goal)$/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Plan today/ }))
    })

    expect(alertMock).toHaveBeenCalledWith('Could not save your profile. Please try again in a moment.')
    setLanguage('pl')
  })

  it('asks the user to sign in again when the session has expired', async () => {
    renderOnboarding()
    for (let index = 0; index < 5; index += 1) next()
    mocks.getUser.mockReturnValue(null)
    await finish()

    expect(alertMock).toHaveBeenCalledWith(t('api.sessionExpired'))
    expect(mocks.navigate).toHaveBeenCalledWith('/login')
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  it('blocks the buttons while the profile is being saved', async () => {
    let resolveSave: (value: unknown) => void = () => {}
    mocks.updateProfile.mockReturnValue(new Promise(resolve => {
      resolveSave = resolve
    }))
    renderOnboarding()
    for (let index = 0; index < 5; index += 1) next()
    fireEvent.click(screen.getByRole('button', { name: /Zaplanuj dzisiejszy dzień/ }))

    const saving = screen.getByRole('button', { name: /Zapisywanie/ }) as HTMLButtonElement
    expect(saving.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Wróć' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      resolveSave({})
    })
    expect(mocks.navigate).toHaveBeenCalledWith('/')
  })
})

describe('Onboarding manual goal', () => {
  it('saves hand set calories and macros without the automatic switch', async () => {
    renderOnboarding()
    fireEvent.click(screen.getByRole('button', { name: 'Znam swoje kalorie i makro' }))
    const page = within(screen.getByRole('region', { name: 'Dzienny cel' }))

    expect(page.getByText(/Wpisz swój dzienny cel i makro/)).toBeTruthy()
    expect(page.queryByRole('switch')).toBeNull()
    expect(page.queryByRole('button', { name: /^Skąd/ })).toBeNull()
    expect(page.queryByText(/g\/kg/)).toBeNull()
    fireEvent.change(page.getByLabelText('Białko (g)'), { target: { value: '150' } })
    const kcal = (page.getByLabelText('Twój cel kaloryczny') as HTMLInputElement).value

    await act(async () => {
      fireEvent.click(page.getByRole('button', { name: 'Zapisz i zacznij planować' }))
    })

    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ is_manual_macros: true, target_protein: 150, target_kcal: Number(kcal) }))
    const saved = mocks.updateProfile.mock.calls[0][0]
    for (const field of ['gender', 'age', 'height', 'weight', 'target_weight', 'display_name']) expect(saved).not.toHaveProperty(field)
    expect(mocks.navigate).toHaveBeenCalledWith('/')
  })

  it('starts from remembered hand set numbers and goes back to the guided setup', () => {
    localStorage.setItem('mp_manual_targets', JSON.stringify({ kcal: 2100, protein: 160, fat: 70, carbs: 208 }))
    renderOnboarding()
    fireEvent.click(screen.getByRole('button', { name: 'Znam swoje kalorie i makro' }))
    const page = within(screen.getByRole('region', { name: 'Dzienny cel' }))

    expect((page.getByLabelText('Twój cel kaloryczny') as HTMLInputElement).value).toBe('2100')
    expect((page.getByLabelText('Białko (g)') as HTMLInputElement).value).toBe('160')
    fireEvent.click(page.getByRole('button', { name: 'Wróć' }))
    expect(screen.queryByRole('region', { name: 'Dzienny cel' })).toBeNull()
    expect(heading()).toBe('Co chcesz osiągnąć?')
  })
})
