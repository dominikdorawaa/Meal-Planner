import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Plan } from './Plan'

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  delete: vi.fn(),
  refreshMeals: vi.fn(),
  setUserMeals: vi.fn(),
  navigate: vi.fn(),
  userMeals: [] as Record<string, unknown>[],
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
    loading: false,
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
  sessionStorage.setItem('planBaseDate', new Date(2026, 9, 12).toISOString())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.userMeals.splice(0, mocks.userMeals.length, omelette, coffee, yogurt, soup)
  mocks.add.mockImplementation(async (payload: Record<string, unknown>) => ({ ...payload, id: `copy-${mocks.add.mock.calls.length}` }))
  mocks.delete.mockResolvedValue(undefined)
  mocks.refreshMeals.mockResolvedValue(undefined)
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
