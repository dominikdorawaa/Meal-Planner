import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Plan } from './Plan'
import { readPlanReturnPosition, rememberPlanReturnPosition } from '../lib/planPosition'
import { installBackNavigation } from '../lib/backNavigation'
import { DEFAULT_RECIPE_IMAGE_URLS } from '../lib/recipeImage'

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
  consumedKcal: null as null | ((date: string, excludedMealId?: string | null) => number),
}))

vi.mock('../lib/apiClient', () => ({
  api: { meals: { add: mocks.add, delete: mocks.delete } },
}))

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    recipes: [{ id: 'recipe-1', name: 'Omelette', kcal: 400, protein: 20, fat: 10, carbs: 30, images: [] }],
    profile: { target_kcal: 2000, target_protein: 100, target_fat: 70, target_carbs: 250, visible_meals: ['breakfast', 'lunch'] },
    userMeals: mocks.userMeals,
    setUserMeals: mocks.setUserMeals,
    profileStatus: mocks.profileStatus,
    loading: mocks.loading,
    reload: mocks.reload,
    refreshMeals: mocks.refreshMeals,
    getConsumedForDay: (date: string, excludedMealId?: string | null) => ({ kcal: mocks.consumedKcal?.(date, excludedMealId) ?? 0, protein: 0, fat: 0, carbs: 0 }),
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
  fireEvent.click(slot(container, mealDate, mealType).getByRole('button', { name: /^Opcje: / }))
}

const DAYS_BEFORE_TODAY = 7

function openDayMenu(dayIndex: number) {
  fireEvent.click(screen.getAllByRole('button', { name: /^Opcje dnia: / })[dayIndex + DAYS_BEFORE_TODAY])
}

function selectDay(date: string) {
  fireEvent.click(document.querySelector(`[data-day="${date}"] > div`) as HTMLElement)
}

function dayHeader(date: string) {
  return document.querySelector(`[data-day="${date}"]`) as HTMLElement
}

function stubDayColumnWidth(width = 120) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-day-column') ? width : 0
  })
}

function planScroller(container: HTMLElement) {
  return container.querySelector('.overflow-x-auto.overflow-y-hidden') as HTMLElement
}

function scrollPlanTo(container: HTMLElement, dayIndex: number) {
  const scroller = planScroller(container)
  scroller.scrollLeft = dayIndex * 120
  fireEvent.scroll(scroller)
}

function stripWeek() {
  return within(screen.getByLabelText('Dni planu')).getAllByRole('button').map(button => button.getAttribute('data-strip-day'))
}

function swipeStrip(dx: number) {
  const strip = screen.getByLabelText('Dni planu')
  fireEvent.pointerDown(strip, { pointerId: 1, clientX: 200 })
  fireEvent.pointerMove(strip, { pointerId: 1, clientX: 200 + dx })
  fireEvent.pointerUp(strip, { pointerId: 1, clientX: 200 + dx })
  act(() => { vi.advanceTimersByTime(300) })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  mocks.consumedKcal = null
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

    const dialog = screen.getByRole('alertdialog', { name: 'Te miejsca mają już pozycje w planie' })
    expect(within(dialog).getByText('Yogurt')).toBeTruthy()
    expect(mocks.add).not.toHaveBeenCalled()

    click('Dopisz obok')

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
    selectDay('2026-10-14')
    click('Wklej (1)')

    expect(await screen.findByText('Skopiowano')).toBeTruthy()
    expect(mocks.add.mock.calls.map(([payload]) => `${payload.meal_date} ${payload.meal_type}`)).toEqual(['2026-10-14 breakfast', '2026-10-14 lunch'])
  })

  it('asks only about the occupied slots when copying a day', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Skopiuj posiłki na inne dni/)
    selectDay('2026-10-13')
    click('Wklej (1)')

    const dialog = screen.getByRole('alertdialog')
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

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    expect(within(dialog).getByText('Yogurt')).toBeTruthy()

    click('Dopisz obok')

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
    selectDay('2026-10-12')

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
  it('lists the items of the day and deletes all of them by default', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Usuń posiłki z całego dnia/)
    const sheet = within(screen.getByRole('alertdialog', { name: /Co usunąć z planu\?/ }))
    expect(sheet.getAllByRole('checkbox').map(box => (box as HTMLInputElement).checked)).toEqual([true, true])
    expect(sheet.getByText('Tego nie da się cofnąć.')).toBeTruthy()
    click('Anuluj')
    expect(mocks.delete).not.toHaveBeenCalled()

    openDayMenu(0)
    click(/Usuń posiłki z całego dnia/)
    click('Usuń 2 pozycje')

    await waitFor(() => expect(mocks.refreshMeals).toHaveBeenCalledTimes(2))
    expect(mocks.delete.mock.calls).toEqual([['meal-1'], ['meal-2']])
    expect(mocks.setUserMeals).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('deletes only the items left checked', async () => {
    renderPlan()

    openDayMenu(0)
    click(/Usuń posiłki z całego dnia/)
    const boxes = within(screen.getByRole('alertdialog')).getAllByRole('checkbox')
    fireEvent.click(boxes[0])
    click('Usuń 1 pozycję')

    await waitFor(() => expect(mocks.refreshMeals).toHaveBeenCalledTimes(2))
    expect(mocks.delete.mock.calls).toEqual([['meal-2']])
  })

  it('does not delete anything when every item is unchecked', () => {
    renderPlan()

    openDayMenu(1)
    click(/Usuń posiłki z całego dnia/)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('checkbox'))

    expect((screen.getByRole('button', { name: 'Usuń' }) as HTMLButtonElement).disabled).toBe(true)
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
    click('Usuń 2 pozycje')

    expect(await screen.findByText('Nie udało się zapisać zmian. Spróbuj ponownie.')).toBeTruthy()
  })
})

describe('Plan item deletion', () => {
  it('deletes an item at once and offers undo', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Usuń posiłek/)

    expect(await screen.findByText('Usunięto z planu')).toBeTruthy()
    expect(mocks.refreshMeals).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.delete).toHaveBeenCalledWith('meal-2')
    expect(mocks.setUserMeals).toHaveBeenCalledOnce()

    click('Cofnij')

    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-12', meal_type: 'lunch', manual_name: 'Coffee' })))
    expect(screen.queryByText('Usunięto z planu')).toBeNull()
  })

  it('hides the deletion message after three seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 9, 12, 12))
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Usuń posiłek/)
    await act(async () => {})

    act(() => { vi.advanceTimersByTime(2999) })
    expect(screen.getByText('Usunięto z planu')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByText('Usunięto z planu')).toBeNull()
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

  it('names only today as today in the day header and the day strip', () => {
    renderPlan()

    expect(dayHeader('2026-10-12').textContent).toMatch(/^Dziś(?! 12)/)
    expect(dayHeader('2026-10-13').textContent).toContain('Wt 13')
    expect(dayHeader('2026-10-13').textContent).not.toContain('października')
    expect(screen.getByRole('button', { name: 'Pon 12' }).getAttribute('aria-current')).toBe('date')
    expect(screen.getByRole('button', { name: 'Wt 13' }).getAttribute('aria-current')).toBeNull()
  })

  it('lets today glow only through the band behind its column, without a card around the header', () => {
    const { container } = renderPlan()

    const todayCard = dayHeader('2026-10-12').firstElementChild as HTMLElement
    const band = container.querySelector('[data-today-band]') as HTMLElement
    expect(todayCard.className.split(' ').some(name => name.startsWith('bg-'))).toBe(false)
    expect(band.className).toContain('bg-gradient-to-b')
  })

  it('highlights the header of the day whose summary is open', () => {
    renderPlan()

    const card = dayHeader('2026-10-13').firstElementChild as HTMLElement
    expect(card.className).toContain('has-[[aria-expanded=true]]:bg-surface-container-lowest')
    fireEvent.click(within(dayHeader('2026-10-13')).getByRole('button', { name: /^Pokaż podsumowanie dnia/ }))

    expect(within(dayHeader('2026-10-13')).getByRole('button', { name: /^Pokaż podsumowanie dnia/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the week before today ready for scrolling back', () => {
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-05_breakfast"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="2026-10-25_breakfast"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="2026-10-26_breakfast"]')).toBeNull()
  })

  it('keeps the week when returning from the add screen on the same day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-19', visibleIndex: 7 })
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()
    expect(container.querySelector('[data-slot="2026-10-19_breakfast"]')).not.toBeNull()
  })

  it('ignores a week remembered on an earlier day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-19', visibleIndex: 7 }, '2026-10-11')
    const { container } = renderPlan()

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()
  })

  it('remembers the shown week when leaving for the add screen', () => {
    const { container, unmount } = renderPlan()

    fireEvent.click(slot(container, '2026-10-19', 'lunch').getByText('add'))
    unmount()

    expect(mocks.navigate).toHaveBeenCalledWith('/add-food?selectDate=2026-10-19&selectType=lunch')
    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-05', visibleIndex: 7, stripStart: '2026-10-12' })
  })

  it('remembers the shown week when leaving to edit an item', () => {
    const { container, unmount } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    click(/Edytuj posiłek/)
    unmount()

    expect(mocks.navigate).toHaveBeenCalledWith('/add-food?selectDate=2026-10-12&selectType=lunch&mealId=meal-2')
    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-05', visibleIndex: 7, stripStart: '2026-10-12' })
  })

  it('remembers the shown week when the page is reloaded or closed', () => {
    renderPlan()

    fireEvent(window, new Event('pagehide'))

    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-05', visibleIndex: 7, stripStart: '2026-10-12' })
  })

  it('jumps to today at midnight while the plan stays open', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 9, 12, 23, 59))
    const { container } = renderPlan()

    act(() => { vi.advanceTimersByTime(30 * 1000) })
    expect(dayHeader('2026-10-12').textContent).toContain('Dziś')

    act(() => { vi.advanceTimersByTime(60 * 1000) })
    expect(dayHeader('2026-10-13').textContent).toContain('Dziś')
    expect(container.querySelector('[data-slot="2026-10-05_breakfast"]')).toBeNull()
    expect(container.querySelector('[data-slot="2026-10-06_breakfast"]')).not.toBeNull()
  })

  it('jumps back to today when the app is shown again on a new day', () => {
    const { container } = renderPlan()

    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(dayHeader('2026-10-12').textContent).toContain('Dziś')

    vi.setSystemTime(new Date(2026, 9, 13, 8))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(container.querySelector('[data-slot="2026-10-05_breakfast"]')).not.toBeNull()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(dayHeader('2026-10-13').textContent).toContain('Dziś')
    expect(container.querySelector('[data-slot="2026-10-05_breakfast"]')).toBeNull()
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

  it('gives the item menu button a large tap area named after the item', () => {
    const { container } = renderPlan()

    const button = slot(container, '2026-10-12', 'lunch').getByRole('button', { name: 'Opcje: Coffee' })
    expect(button.className).toContain('w-14 h-14')
    fireEvent.click(button)

    expect(screen.getByRole('dialog', { name: 'Zarządzaj posiłkiem' })).toBeTruthy()
  })

  it('gives the day menu button a large tap area that opens the menu without opening the day summary', () => {
    renderPlan()

    const button = within(dayHeader('2026-10-13')).getByRole('button', { name: /^Opcje dnia: / })
    expect(button.className).toContain('w-11 h-11')
    fireEvent.click(button)

    expect(screen.getByRole('button', { name: /Skopiuj posiłki na inne dni/ })).toBeTruthy()
    expect(within(dayHeader('2026-10-13')).getByRole('button', { name: /^Pokaż podsumowanie dnia/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('closes the item menu with the back gesture', async () => {
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'breakfast')
    expect(screen.getByRole('dialog', { name: 'Zarządzaj posiłkiem' })).toBeTruthy()
    await goBack()

    expect(screen.queryByRole('dialog', { name: 'Zarządzaj posiłkiem' })).toBeNull()
  })

  it('shows the item, its meal, day and calories at the top of the item menu', () => {
    mocks.consumedKcal = (date, excludedMealId) => (date === '2026-10-12' ? (excludedMealId === 'meal-2' ? 400 : 420) : 0)
    const { container } = renderPlan()

    openMealMenu(container, '2026-10-12', 'lunch')
    const dialog = screen.getByRole('dialog', { name: 'Zarządzaj posiłkiem' })

    expect(within(dialog).getByRole('heading', { name: 'Coffee' })).toBeTruthy()
    expect(dialog.textContent).toContain('II śniadanie')
    expect(dialog.textContent).toContain('12.10')
    expect(dialog.textContent).toContain('20 kcal')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }))
    expect(screen.queryByRole('dialog', { name: 'Zarządzaj posiłkiem' })).toBeNull()
  })

  it('shows the day and its calories at the top of the day menu', () => {
    mocks.consumedKcal = date => (date === '2026-10-12' ? 1840 : 0)
    renderPlan()

    openDayMenu(0)
    const dialog = screen.getByRole('dialog', { name: 'Zarządzaj całym dniem' })

    expect(dialog.textContent).toContain('1840 kcal')
    expect(dialog.textContent).toContain('12')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }))
    expect(screen.queryByRole('dialog', { name: 'Zarządzaj całym dniem' })).toBeNull()
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
    const sheet = screen.getByRole('dialog', { name: 'Zarządzaj całym dniem' })
    fireEvent.touchStart(sheet, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientX: 100, clientY: 400 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientX: 100, clientY: 400 }] })
    act(() => vi.advanceTimersByTime(200))

    expect(screen.queryByRole('dialog', { name: 'Zarządzaj całym dniem' })).toBeNull()
  })
})

describe('Plan screen top', () => {
  it('has no title bar or shopping list button', () => {
    const { container } = renderPlan()

    expect(screen.queryByText('Twój Plan')).toBeNull()
    expect(container.querySelector('header')).toBeNull()
    expect(screen.queryByText('shopping_cart_checkout')).toBeNull()
  })

  it('starts the screen with the day strip instead of week buttons', () => {
    renderPlan()

    const strip = screen.getByLabelText('Dni planu').closest('.fixed')
    expect(strip?.className.split(' ')).toContain('top-0')
    expect(screen.queryByRole('button', { name: /tydzień/ })).toBeNull()
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
  it('shows shortened calories on the photo so they stay inside the card', () => {
    mocks.userMeals.splice(0, mocks.userMeals.length, {
      id: 'meal-9', meal_date: '2026-10-12', meal_type: 'lunch', manual_name: 'Feast',
      manual_kcal: 45000, manual_protein: 5000, manual_fat: 12345, manual_carbs: 900,
    })
    const { container } = renderPlan()

    const card = slot(container, '2026-10-12', 'lunch')
    const kcal = card.getByTestId('plan-card-kcal')
    expect(kcal.textContent).toBe('45 tys. kcal')
    expect(kcal.className).toContain('truncate')
    expect((kcal.parentElement as HTMLElement).className).toContain('aspect-square')
    expect(card.queryByText(/B 5000g/)).toBeNull()
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

  it('highlights today with one band behind its whole column', () => {
    const { container } = renderPlan()

    const bands = container.querySelectorAll('[data-today-band]')
    expect(bands).toHaveLength(1)
    expect((bands[0] as HTMLElement).style.left).toBe('calc(7 * var(--plan-column) + 3px)')
    expect((bands[0] as HTMLElement).style.width).toBe('calc(var(--plan-column) - 6px)')
  })
})

describe('Plan recipe images', () => {
  it('shows the default image for both themes on a recipe without a photo', () => {
    const { container } = renderPlan()

    const images = slot(container, '2026-10-12', 'breakfast').getAllByRole('img', { name: 'Omelette' })

    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      DEFAULT_RECIPE_IMAGE_URLS.light,
      DEFAULT_RECIPE_IMAGE_URLS.dark,
    ])
  })
})

describe('Plan meal rows', () => {
  it('names each meal once for all days and keeps the name in place while scrolling sideways', () => {
    renderPlan()

    const breakfast = screen.getByRole('heading', { name: /Śniadanie/ })
    expect(breakfast.className).toContain('sticky')
    expect(breakfast.className).toContain('left-0')
    expect(screen.getAllByRole('heading', { name: /Śniadanie/ })).toHaveLength(1)
  })

  it('marks each meal with its own colored dot instead of an icon', () => {
    const { container } = renderPlan()

    const dots = [...container.querySelectorAll('[data-meal-dot]')] as HTMLElement[]
    expect(dots).toHaveLength(2)
    expect(dots[0].style.backgroundColor).not.toBe(dots[1].style.backgroundColor)
    expect(screen.getByRole('heading', { name: 'Śniadanie' }).querySelector('.material-symbols-outlined')).toBeNull()
  })

    it('offers adding to an empty meal and adding more to a meal with items', () => {
    const { container } = renderPlan()

    expect(slot(container, '2026-10-12', 'breakfast').getByRole('button', { name: /Dodaj więcej/ })).toBeTruthy()
    expect(slot(container, '2026-10-14', 'breakfast').getByRole('button', { name: /Dodaj$/ })).toBeTruthy()
  })

  it('lets the add field fill the free space so rows stay aligned', () => {
    const { container } = renderPlan()

    const field = slot(container, '2026-10-14', 'breakfast').getByRole('button', { name: /Dodaj/ })
    expect(field.className).toContain('flex-1')
    expect(field.className).toContain('border-dashed')
    expect(slot(container, '2026-10-12', 'breakfast').getByRole('button', { name: /Dodaj więcej/ }).className).toContain('bg-today/[0.05]')
  })
})

describe('Plan meal row height', () => {
  beforeEach(() => {
    stubDayColumnWidth()
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('overflow-x-auto') ? 360 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (!this.hasAttribute('data-slot')) return 0
      return this.querySelector('[data-testid="plan-card-kcal"]') ? 300 : 65
    })
  })

  function slotColumn(container: HTMLElement, mealDate: string, mealType: string) {
    return container.querySelector(`[data-slot="${mealDate}_${mealType}"]`) as HTMLElement
  }

  it('stretches empty slots to the tallest visible day of the meal', () => {
    const { container } = renderPlan()

    scrollPlanTo(container, 7)

    expect(slotColumn(container, '2026-10-14', 'breakfast').parentElement!.style.getPropertyValue('--slot-fill')).toBe('300px')
  })

  it('keeps empty slots short when only hidden days have meals', () => {
    const { container } = renderPlan()

    scrollPlanTo(container, 13)

    const soupColumn = slotColumn(container, '2026-10-25', 'lunch')
    expect(soupColumn.parentElement!.style.getPropertyValue('--slot-fill')).toBe('65px')
    expect(soupColumn.style.maxHeight).toBe('65px')
    expect(soupColumn.style.overflow).toBe('hidden')
    expect(slotColumn(container, '2026-10-19', 'lunch').style.maxHeight).toBe('')
  })

  it('fits the rows again when the window is resized', () => {
    const { container } = renderPlan()
    const row = slotColumn(container, '2026-10-14', 'breakfast').parentElement!
    row.style.removeProperty('--slot-fill')

    fireEvent(window, new Event('resize'))

    expect(row.style.getPropertyValue('--slot-fill')).toBe('300px')
  })
})

describe('Plan scrolling through days', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 9, 12, 12))
    stubDayColumnWidth()
  })

  it('adds the next week when scrolling near the end of the shown days', () => {
    const { container } = renderPlan()

    scrollPlanTo(container, 15)
    act(() => { vi.advanceTimersByTime(200) })

    expect(container.querySelector('[data-slot="2026-11-01_breakfast"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="2026-10-05_breakfast"]')).toBeNull()
    expect(planScroller(container).scrollLeft).toBe(8 * 120)
  })

  it('adds the previous week when scrolling near the start of the shown days', () => {
    const { container } = renderPlan()

    scrollPlanTo(container, 2)
    act(() => { vi.advanceTimersByTime(200) })

    expect(container.querySelector('[data-slot="2026-09-28_breakfast"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="2026-10-25_breakfast"]')).toBeNull()
    expect(planScroller(container).scrollLeft).toBe(9 * 120)
  })

  it('keeps the shown days while scrolling in the middle of them', () => {
    const { container } = renderPlan()

    scrollPlanTo(container, 10)
    act(() => { vi.advanceTimersByTime(200) })

    expect(container.querySelector('[data-slot="2026-10-05_breakfast"]')).not.toBeNull()
    expect(planScroller(container).scrollLeft).toBe(10 * 120)
  })

  it('offers a way back to today once today is scrolled away', () => {
    const { container } = renderPlan()
    expect(screen.queryByRole('button', { name: 'Wróć do dzisiaj' })).toBeNull()

    scrollPlanTo(container, 10)
    click('Wróć do dzisiaj')

    expect(planScroller(container).scrollLeft).toBe(7 * 120)
    expect(screen.queryByRole('button', { name: 'Wróć do dzisiaj' })).toBeNull()
  })

  it('brings today back from a week where today is no longer loaded', () => {
    const { container } = renderPlan()
    scrollPlanTo(container, 15)
    act(() => { vi.advanceTimersByTime(200) })
    scrollPlanTo(container, 15)
    act(() => { vi.advanceTimersByTime(200) })
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()

    click('Wróć do dzisiaj')

    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()
    expect(planScroller(container).scrollLeft).toBe(7 * 120)
  })

  it('scrolls the plan to a day tapped in the strip', () => {
    const { container } = renderPlan()

    fireEvent.click(screen.getByRole('button', { name: 'Pt 16' }))

    expect(planScroller(container).scrollLeft).toBe(11 * 120)
  })

  it('moves only the strip by one week per swipe and leaves the plan days alone', () => {
    const { container } = renderPlan()

    swipeStrip(-600)
    expect(stripWeek()[0]).toBe('2026-10-19')
    swipeStrip(-600)
    expect(stripWeek()[0]).toBe('2026-10-26')
    swipeStrip(300)

    expect(stripWeek()[0]).toBe('2026-10-19')
    expect(planScroller(container).scrollLeft).toBe(7 * 120)
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).not.toBeNull()
  })

  it('shows a day tapped in a strip week far from the loaded plan days', () => {
    const { container } = renderPlan()
    swipeStrip(-200)
    swipeStrip(-200)
    swipeStrip(-200)

    fireEvent.click(screen.getByRole('button', { name: 'Śr 4' }))

    expect(container.querySelector('[data-slot="2026-11-04_breakfast"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="2026-10-12_breakfast"]')).toBeNull()
    expect(planScroller(container).scrollLeft).toBe(7 * 120)
    expect(stripWeek()[0]).toBe('2026-11-02')
  })

  it('moves the strip by whole weeks to follow the plan once the first shown day leaves its week', () => {
    const { container } = renderPlan()

    scrollPlanTo(container, 13)
    act(() => { vi.advanceTimersByTime(200) })
    expect(stripWeek()[0]).toBe('2026-10-12')

    scrollPlanTo(container, 14)
    act(() => { vi.advanceTimersByTime(200) })
    expect(stripWeek()[0]).toBe('2026-10-19')

    scrollPlanTo(container, 6)
    act(() => { vi.advanceTimersByTime(200) })
    expect(stripWeek()[0]).toBe('2026-10-12')
  })

  it('brings the strip back to today with the today button from far away', () => {
    const { container } = renderPlan()
    scrollPlanTo(container, 15)
    act(() => { vi.advanceTimersByTime(200) })
    scrollPlanTo(container, 15)
    act(() => { vi.advanceTimersByTime(200) })
    swipeStrip(-200)
    swipeStrip(-200)
    expect(stripWeek()[0]).not.toBe('2026-10-12')

    click('Wróć do dzisiaj')

    expect(stripWeek()[0]).toBe('2026-10-12')
    expect(planScroller(container).scrollLeft).toBe(7 * 120)
  })

  it('brings a swiped strip back to today with the today button while today is still loaded', () => {
    const { container } = renderPlan()
    scrollPlanTo(container, 10)
    swipeStrip(-200)

    click('Wróć do dzisiaj')

    expect(stripWeek()[0]).toBe('2026-10-12')
  })

  it('returns to the remembered day after coming back from another screen', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-05', visibleIndex: 10 })
    const { container } = renderPlan()

    expect(planScroller(container).scrollLeft).toBe(10 * 120)
    expect(stripWeek()[0]).toBe('2026-10-15')
    expect(screen.getByTestId('visible-days').style.transform).toBe('translateX(233.33333333333334%)')
    expect(screen.getByRole('button', { name: 'Wróć do dzisiaj' })).toBeTruthy()
  })

  it('keeps the remembered strip week across another visit', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-05', visibleIndex: 10, stripStart: '2026-10-14' })
    const { unmount } = renderPlan()

    unmount()

    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-05', visibleIndex: 10, stripStart: '2026-10-14' })
  })

  it('remembers the day scrolled to in the plan when leaving it', () => {
    const { container, unmount } = renderPlan()

    scrollPlanTo(container, 11)
    unmount()

    expect(readPlanReturnPosition()).toMatchObject({ startDate: '2026-10-05', visibleIndex: 11 })
  })

  it('remembers a day near the edge in a window centered on it when leaving before more days load', () => {
    const { container, unmount } = renderPlan()

    scrollPlanTo(container, 3)
    unmount()

    expect(readPlanReturnPosition()).toMatchObject({ startDate: '2026-09-28', visibleIndex: 10 })
  })

  it('remembers a day near the far edge in a window centered on it', () => {
    const { container, unmount } = renderPlan()

    scrollPlanTo(container, 16)
    unmount()

    expect(readPlanReturnPosition()).toMatchObject({ startDate: '2026-10-12', visibleIndex: 9 })
  })
})
