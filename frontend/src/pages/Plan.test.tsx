import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Plan } from './Plan'
import { readPlanReturnPosition, rememberPlanReturnPosition } from '../lib/planPosition'
import { installBackNavigation } from '../lib/backNavigation'

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  delete: vi.fn(),
  refreshMeals: vi.fn(),
  setUserMeals: vi.fn(),
  navigate: vi.fn(),
  userMeals: [] as Record<string, unknown>[],
  reload: vi.fn(),
  profileStatus: 'ready',
  loading: false,
}))

vi.mock('../lib/apiClient', () => ({
  api: { meals: { add: mocks.add, delete: mocks.delete } },
}))

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    recipes: [{ id: 'recipe-1', name: 'Omelette', kcal: 400, protein: 20, fat: 10, carbs: 30, image_url: null }],
    profile: { target_kcal: 2000, target_protein: 100, target_fat: 70, target_carbs: 250, visible_meals: ['breakfast', 'lunch'] },
    userMeals: mocks.userMeals,
    setUserMeals: mocks.setUserMeals,
    profileStatus: mocks.profileStatus,
    loading: mocks.loading,
    reload: mocks.reload,
    refreshMeals: mocks.refreshMeals,
    getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
    refreshShoppingList: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}))

const omelette = { id: 'meal-1', meal_date: '2026-10-12', meal_type: 'breakfast', recipe: { id: 'recipe-1' }, portions_consumed: 1 }
const coffee = { id: 'meal-2', meal_date: '2026-10-12', meal_type: 'lunch', manual_name: 'Coffee', manual_kcal: 20 }
const yogurt = { id: 'meal-3', meal_date: '2026-10-13', meal_type: 'breakfast', manual_name: 'Yogurt', manual_kcal: 150 }
const soup = { id: 'meal-4', meal_date: '2026-10-25', meal_type: 'lunch', manual_name: 'Soup', manual_kcal: 300 }

function renderPlan() {
  return render(
    <MemoryRouter>
      <Plan />
    </MemoryRouter>
  )
}

function slot(container: HTMLElement, mealDate: string, mealType: string) {
  return within(container.querySelector(`[data-slot="${mealDate}_${mealType}"]`) as HTMLElement)
}

function openMealMenu(container: HTMLElement, mealDate: string, mealType: string) {
  fireEvent.click(slot(container, mealDate, mealType).getByText('more_horiz'))
}

function openDayMenu(dayIndex: number) {
  fireEvent.click(screen.getAllByText('edit_square')[dayIndex])
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.userMeals.splice(0, mocks.userMeals.length, omelette, coffee, yogurt, soup)
  mocks.add.mockImplementation(async (payload: Record<string, unknown>) => ({ ...payload, id: `copy-${mocks.add.mock.calls.length}` }))
  mocks.delete.mockResolvedValue(undefined)
  mocks.refreshMeals.mockResolvedValue(undefined)
  mocks.reload.mockResolvedValue(undefined)
  mocks.profileStatus = 'ready'
  mocks.loading = false
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
  sessionStorage.clear()
  localStorage.clear()
})

describe('Plan copying', () => {
  it('copies an item to the next day straight away when the slot is empty', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Skopiuj na następny dzień/)

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-13', meal_type: 'lunch', manual_name: 'Coffee' }))
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.refreshMeals).toHaveBeenCalledTimes(2)
  })

  it('asks before copying into a slot with meals and appends next to them', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'breakfast')
    click(/Skopiuj na następny dzień/)

    const dialog = screen.getByRole('dialog', { name: 'Te miejsca mają już posiłki' })
    expect(within(dialog).getByText('Yogurt')).toBeTruthy()
    expect(mocks.add).not.toHaveBeenCalled()

    click('Dopisz')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-13', meal_type: 'breakfast', recipe: { id: 'recipe-1' } }))
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('overwrites the meals in the target slot and undoes it', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'breakfast')
    click(/Skopiuj na następny dzień/)
    click('Nadpisz')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.delete).toHaveBeenCalledWith('meal-3')

    click('Cofnij')

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('copy-1'))
    expect(mocks.add).toHaveBeenLastCalledWith(expect.objectContaining({ meal_date: '2026-10-13', meal_type: 'breakfast', manual_name: 'Yogurt' }))
    expect(screen.queryByText('Skopiowano')).toBeNull()
  })

  it('leaves the plan untouched when copying is cancelled', () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'breakfast')
    click(/Skopiuj na następny dzień/)
    click('Anuluj')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.add).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('copies the last visible day to the day after it', async () => {
    renderPlan()

    openDayMenu(13)
    click(/Skopiuj na następny dzień/)

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledOnce()
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-26', meal_type: 'lunch', manual_name: 'Soup' }))
  })

  it('tells the user when the day to copy has no meals', () => {
    renderPlan()

    openDayMenu(3)
    click(/Skopiuj na następny dzień/)

    expect(screen.getByText('Ten dzień nie ma jeszcze posiłków')).toBeTruthy()
    expect(mocks.add).not.toHaveBeenCalled()
  })

  it('copies a day into empty slots of other days straight away', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Skopiuj posiłki na inne dni/)
    fireEvent.click(screen.getByText('14.10'))
    click('Wklej (1)')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add.mock.calls.map(([payload]) => `${payload.meal_date} ${payload.meal_type}`)).toEqual(['2026-10-14 breakfast', '2026-10-14 lunch'])
  })

  it('asks only about the occupied slots when copying a day', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Skopiuj posiłki na inne dni/)
    fireEvent.click(screen.getByText('13.10'))
    click('Wklej (1)')

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    expect(within(dialog).getByText('Yogurt')).toBeTruthy()

    click('Nadpisz')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledTimes(2)
    expect(mocks.delete.mock.calls).toEqual([['meal-3']])
  })

  it('copies an item into several selected slots', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Skopiuj na inne dni/)
    fireEvent.click(slot(container, '2026-10-14', 'breakfast').getByText('Wklej'))
    fireEvent.click(slot(container, '2026-10-15', 'lunch').getByText('Wklej'))
    click('Wklej (2)')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add.mock.calls.map(([payload]) => `${payload.meal_date} ${payload.meal_type}`)).toEqual(['2026-10-14 breakfast', '2026-10-15 lunch'])
  })

  it('asks before copying a day to a next day that already has meals', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Skopiuj na następny dzień/)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    expect(within(dialog).getByText('Yogurt')).toBeTruthy()

    click('Dopisz')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add.mock.calls.map(([payload]) => `${payload.meal_date} ${payload.meal_type}`)).toEqual(['2026-10-13 breakfast', '2026-10-13 lunch'])
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('ignores hidden meals whose recipe no longer exists', async () => {
    mocks.userMeals.push({ id: 'meal-5', meal_date: '2026-10-14', meal_type: 'breakfast', recipe: { id: 'deleted-recipe' } })
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Skopiuj na inne dni/)
    fireEvent.click(slot(container, '2026-10-14', 'breakfast').getByText('Wklej'))
    click('Wklej (1)')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.delete).not.toHaveBeenCalled()

    openDayMenu(2)
    click(/Usuń posiłki z całego dnia/)

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Ten dzień nie ma jeszcze posiłków')).toBeTruthy()
  })

  it('does not let a day be copied onto itself', () => {
    renderPlan()

    openDayMenu(0)
    click(/Skopiuj posiłki na inne dni/)
    fireEvent.click(screen.getByText('12.10'))

    expect((screen.getByRole('button', { name: 'Wklej (0)' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('saves only once when the paste button is tapped twice', async () => {
    let finishAdd: (value: unknown) => void = () => {}
    mocks.add.mockImplementation(() => new Promise(resolve => { finishAdd = resolve }))
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Skopiuj na inne dni/)
    fireEvent.click(slot(container, '2026-10-14', 'breakfast').getByText('Wklej'))
    click('Wklej (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Wklej (1)' }))

    expect(mocks.add).toHaveBeenCalledOnce()
    finishAdd({ id: 'copy-1' })
    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledOnce()
  })

  it('shows an error without undo when copying fails', async () => {
    mocks.add.mockRejectedValue(new Error('Server error (500)'))
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Skopiuj na następny dzień/)

    expect(await screen.findByText('Nie udało się zapisać zmian. Spróbuj ponownie.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cofnij' })).toBeNull()
  })

  it('shows an error when undo fails', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Skopiuj na następny dzień/)
    await screen.findByText('Skopiowano')
    mocks.delete.mockRejectedValue(new Error('Server error (500)'))
    click('Cofnij')

    expect(await screen.findByText('Nie udało się zapisać zmian. Spróbuj ponownie.')).toBeTruthy()
  })
})

describe('Plan moving', () => {
  it('moves an item to one selected slot and undoes it', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    expect(screen.getByText('Wybierz jedno miejsce docelowe')).toBeTruthy()

    fireEvent.click(slot(container, '2026-10-14', 'lunch').getByText('Tutaj'))
    fireEvent.click(slot(container, '2026-10-15', 'lunch').getByText('Tutaj'))
    click('Przenieś')

    expect(await screen.findByText('Przeniesiono')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledOnce()
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-15', meal_type: 'lunch', manual_name: 'Coffee' }))
    expect(mocks.delete.mock.calls).toEqual([['meal-2']])

    click('Cofnij')

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('copy-1'))
    expect(mocks.add).toHaveBeenLastCalledWith(expect.objectContaining({ meal_date: '2026-10-12', meal_type: 'lunch', manual_name: 'Coffee' }))
  })

  it('asks before moving into a slot with meals and can overwrite them', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    fireEvent.click(slot(container, '2026-10-13', 'breakfast').getByText('Yogurt'))
    click('Przenieś')
    click('Nadpisz')

    expect(await screen.findByText('Przeniesiono')).toBeTruthy()
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-13', meal_type: 'breakfast' }))
    expect(mocks.delete.mock.calls).toEqual([['meal-3'], ['meal-2']])
  })

  it('undoes a move that overwrote a meal', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    fireEvent.click(slot(container, '2026-10-13', 'breakfast').getByText('Yogurt'))
    click('Przenieś')
    click('Nadpisz')
    await screen.findByText('Przeniesiono')
    click('Cofnij')

    await waitFor(() => expect(mocks.delete).toHaveBeenLastCalledWith('copy-1'))
    expect(mocks.add.mock.calls.slice(1).map(([payload]) => payload.manual_name)).toEqual(['Yogurt', 'Coffee'])
  })

  it('offers undo when a move could not remove the original item', async () => {
    mocks.delete.mockRejectedValue(new Error('Server error (500)'))
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    fireEvent.click(slot(container, '2026-10-14', 'lunch').getByText('Tutaj'))
    click('Przenieś')

    expect(await screen.findByText('Nie udało się zapisać zmian. Spróbuj ponownie.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBeTruthy()
  })

  it('does not offer the current slot as a move target', () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    fireEvent.click(slot(container, '2026-10-12', 'lunch').getByText('Coffee'))

    expect((screen.getByRole('button', { name: 'Przenieś' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('returns to normal mode when moving is cancelled', () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    click('Anuluj')

    expect(screen.queryByText('Wybierz jedno miejsce docelowe')).toBeNull()
    expect(mocks.add).not.toHaveBeenCalled()
  })
})

describe('Plan day deletion', () => {
  it('confirms with the item count before deleting a whole day', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Usuń posiłki z całego dnia/)
    expect(screen.getByRole('alertdialog', { name: 'Usunąć 2 pozycje z poniedziałku?' })).toBeTruthy()
    click('Anuluj')
    expect(mocks.delete).not.toHaveBeenCalled()

    openDayMenu(0)
    click(/Usuń posiłki z całego dnia/)
    click('Usuń')

    await waitFor(() => expect(mocks.refreshMeals).toHaveBeenCalledTimes(2))
    expect(mocks.delete.mock.calls).toEqual([['meal-1'], ['meal-2']])
    expect(mocks.setUserMeals).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('uses the singular form for one item', () => {
    renderPlan()

    openDayMenu(1)
    click(/Usuń posiłki z całego dnia/)

    expect(screen.getByRole('alertdialog', { name: 'Usunąć 1 pozycję z wtorku?' })).toBeTruthy()
  })

  it('does not ask to delete a day without meals', () => {
    renderPlan()

    openDayMenu(3)
    click(/Usuń posiłki z całego dnia/)

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Ten dzień nie ma jeszcze posiłków')).toBeTruthy()
  })

  it('shows an error when deleting a day fails', async () => {
    mocks.delete.mockRejectedValue(new Error('Server error (500)'))
    renderPlan()

    openDayMenu(0)
    click(/Usuń posiłki z całego dnia/)
    click('Usuń')

    expect(await screen.findByText('Nie udało się zapisać zmian. Spróbuj ponownie.')).toBeTruthy()
  })
})

describe('Plan item deletion', () => {
  it('deletes an item at once and offers undo', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Usuń posiłek/)

    expect(await screen.findByText('Usunięto Coffee z II śniadanie')).toBeTruthy()
    expect(mocks.refreshMeals).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.delete).toHaveBeenCalledWith('meal-2')
    expect(mocks.setUserMeals).toHaveBeenCalledOnce()

    click('Cofnij')

    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-12', meal_type: 'lunch', manual_name: 'Coffee' })))
    expect(screen.queryByText('Usunięto Coffee z II śniadanie')).toBeNull()
  })

  it('hides the deletion message after five seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 9, 12, 12))
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Usuń posiłek/)
    await act(async () => {})

    act(() => { vi.advanceTimersByTime(4999) })
    expect(screen.getByText('Usunięto Coffee z II śniadanie')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByText('Usunięto Coffee z II śniadanie')).toBeNull()
  })

  it('shows an error without undo when deleting an item fails', async () => {
    mocks.delete.mockRejectedValue(new Error('Server error (500)'))
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Usuń posiłek/)

    expect(await screen.findByText('Nie udało się zapisać zmian. Spróbuj ponownie.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cofnij' })).toBeNull()
  })
})

describe('Plan start date', () => {
  it('starts from today when there is no position to return to', () => {
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()
  })

  it('marks only today with a filled date circle', () => {
    renderPlan()

    expect(screen.getAllByText('12.10')[0].className).toContain('bg-today')
    expect(screen.getAllByText('13.10')[0].className).toContain('bg-primary/20')
    expect(screen.getAllByText('13.10')[0].className).not.toContain('bg-today')
  })

  it('keeps the week when returning from the add screen on the same day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-19', scrollLeft: 0 })
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()
    expect(container.querySelector('[data-slot="2026-10-19_breakfast"]')).not.toBeNull()
    expect(readPlanReturnPosition()).toBeNull()
  })

  it('ignores a week remembered on an earlier day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-19', scrollLeft: 0 }, '2026-10-11')
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()
  })

  it('remembers the shown week when opening the add screen', () => {
    const { container } = renderPlan()

    click(/Następny/)
    fireEvent.click(slot(container, '2026-10-19', 'lunch').getByText('add'))

    expect(mocks.navigate).toHaveBeenCalledWith('/add-food?selectDate=2026-10-19&selectType=lunch')
    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-19', scrollLeft: 0 })
  })

  it('remembers the shown week when opening an item to edit', () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Edytuj posiłek/)

    expect(mocks.navigate).toHaveBeenCalledWith('/add-food?selectDate=2026-10-12&selectType=lunch&mealId=meal-2')
    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-12', scrollLeft: 0 })
  })

  it('jumps to today at midnight while the plan stays open', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 9, 12, 23, 59))
    const { container } = renderPlan()

    act(() => { vi.advanceTimersByTime(30 * 1000) })
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()

    act(() => { vi.advanceTimersByTime(60 * 1000) })
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()
    expect(container.querySelector('[data-slot="2026-10-13_breakfast"]')).not.toBeNull()
  })

  it('jumps back to today when the app is shown again on a new day', () => {
    const { container } = renderPlan()
    click(/Następny/)

    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()

    vi.setSystemTime(new Date(2026, 9, 13, 8))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(container.querySelector('[data-slot="2026-10-13_breakfast"]')).toBeNull()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(container.querySelector('[data-slot="2026-10-13_breakfast"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()
  })
})

describe('Plan mobile gestures', () => {
  let uninstall: () => void

  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    uninstall = installBackNavigation()
  })

  afterEach(() => {
    uninstall()
  })

  async function goBack() {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
      await new Promise<void>(resolve => {
        window.addEventListener('popstate', () => resolve(), { once: true })
        window.history.back()
      })
    })
  }

  it('closes the item menu with the back gesture', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'breakfast')
    expect(screen.getByText('Zarządzaj posiłkiem')).toBeTruthy()
    await goBack()

    expect(screen.queryByText('Zarządzaj posiłkiem')).toBeNull()
  })

  it('cancels copying with the back gesture', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Przenieś do\.\.\./)
    await goBack()

    expect(screen.queryByText('Wybierz jedno miejsce docelowe')).toBeNull()
  })

  it('closes the day menu when it is swiped down', async () => {
    vi.useFakeTimers()
    renderPlan()

    openDayMenu(0)
    const sheet = screen.getByText('Zarządzaj całym dniem').parentElement as HTMLElement
    fireEvent.touchStart(sheet, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientX: 100, clientY: 400 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientX: 100, clientY: 400 }] })
    act(() => vi.advanceTimersByTime(200))

    expect(screen.queryByText('Zarządzaj całym dniem')).toBeNull()
  })
})

describe('Plan screen top', () => {
  it('has no title bar or shopping list button', () => {
    const { container } = renderPlan()

    expect(screen.queryByText('Twój Plan')).toBeNull()
    expect(container.querySelector('header')).toBeNull()
    expect(screen.queryByText('shopping_cart_checkout')).toBeNull()
  })

  it('starts the screen with the week navigation', () => {
    renderPlan()

    const weekBar = screen.getByRole('button', { name: 'Dzisiaj' }).closest('.fixed')
    expect(weekBar?.className.split(' ')).toContain('top-0')
  })
})

describe('Plan profile loading', () => {
  it('shows the plan without onboarding for a user with a calorie goal', () => {
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalledWith('/onboarding')
  })

  it('opens onboarding when the loaded profile has no calorie goal', () => {
    mocks.profileStatus = 'needsOnboarding'
    renderPlan()

    expect(mocks.navigate).toHaveBeenCalledWith('/onboarding')
  })

  it('waits on the loading screen while the profile is loading', () => {
    mocks.profileStatus = 'loading'
    mocks.loading = true
    renderPlan()

    expect(screen.getByText('Przygotowujemy Twój profil...')).toBeTruthy()
    expect(mocks.navigate).not.toHaveBeenCalledWith('/onboarding')
  })

  it('offers a retry instead of onboarding when the profile could not be fetched', () => {
    mocks.profileStatus = 'failed'
    renderPlan()

    expect(screen.getByText('Nie udało się wczytać profilu')).toBeTruthy()
    expect(mocks.navigate).not.toHaveBeenCalledWith('/onboarding')

    click('Spróbuj ponownie')

    expect(mocks.reload).toHaveBeenCalledOnce()
  })
})

describe('Plan cards with very large values', () => {
  it('shortens calories and macros so they stay inside the card', () => {
    mocks.userMeals.splice(0, mocks.userMeals.length, {
      id: 'meal-9', meal_date: '2026-10-12', meal_type: 'lunch', manual_name: 'Feast',
      manual_kcal: 45000, manual_protein: 5000, manual_fat: 12345, manual_carbs: 900,
    })
    const { container } = renderPlan()

    const card = slot(container, '2026-10-12', 'lunch')
    const kcal = card.getByTestId('plan-card-kcal')
    expect(kcal.textContent).toBe('45 tys. kcal')
    expect(kcal.className).toContain('truncate')
    expect(card.getByText('B 5000g · T 12,3 tys.g · W 900g').className).toContain('max-w-full')
  })
})

describe('Plan last meal of the day', () => {
  it('keeps the vertical scroll on the page when today has an item in the last meal', () => {
    const { container } = renderPlan()

    const todayLastSlot = container.querySelector('[data-slot="2026-10-12_lunch"]') as HTMLElement
    const scroller = todayLastSlot.closest('.overflow-x-auto') as HTMLElement

    expect(slot(container, '2026-10-12', 'lunch').getByText('Coffee')).toBeTruthy()
    expect(scroller.className).toContain('overflow-y-hidden')
  })

  it('leaves room below the last row for the highlight of today and its ring', () => {
    const { container } = renderPlan()

    const todayLastSlot = container.querySelector('[data-slot="2026-10-12_lunch"]') as HTMLElement
    const scroller = todayLastSlot.closest('.overflow-x-auto') as HTMLElement

    expect(todayLastSlot.querySelector('.-my-2')).not.toBeNull()
    expect((scroller.firstElementChild as HTMLElement).className).toContain('pb-6')
  })
})
