import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppDataProvider, useAppData } from './AppDataContext'

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  getRecipes: vi.fn(),
  getMeals: vi.fn(),
  getShoppingItems: vi.fn(),
  getShoppingRecipes: vi.fn(),
}))

vi.mock('./apiClient', () => ({
  api: {
    profile: { get: mocks.getProfile, update: mocks.updateProfile },
    recipes: { getAll: mocks.getRecipes },
    meals: { getAll: mocks.getMeals },
    shoppingList: { getItems: mocks.getShoppingItems, getRecipes: mocks.getShoppingRecipes },
  },
}))

const user = { userId: 'user-1', email: 'user@example.com', name: 'Test User' }

const oldConfig = [
  { id: 'breakfast', name: 'Breakfast', visible: true },
  { id: 'lunch', name: 'Lunch', visible: true },
]

function AppDataProbe({ changes = {}, date = '2026-10-17', onError = () => {} }: { changes?: Record<string, unknown>, date?: string, onError?: (error: Error) => void }) {
  const data = useAppData()
  const meals = Array.isArray(data.profile?.meal_config) ? data.profile.meal_config : []
  return (
    <>
      <p data-testid="loading">{String(data.loading)}</p>
      <p data-testid="meal-names">{meals.map((meal: { name: string }) => meal.name).join(', ')}</p>
      <p data-testid="profile">{JSON.stringify(data.profile)}</p>
      <p data-testid="counts">{`recipes ${data.recipes.length}, meals ${data.userMeals.length}, items ${data.shoppingList.length}, list recipes ${data.shoppingListRecipes.map(recipe => `${recipe.id}x${recipe.portions}`).join(' ')}`}</p>
      <p data-testid="consumed">{JSON.stringify(data.getConsumedForDay(date))}</p>
      <button onClick={() => data.saveProfile(changes).catch(onError)}>Save</button>
      <button onClick={() => data.refreshProfile()}>Refresh profile</button>
      <button onClick={() => data.refreshRecipes()}>Refresh recipes</button>
      <button onClick={() => data.refreshMeals()}>Refresh meals</button>
      <button onClick={() => data.refreshShoppingList()}>Refresh shopping list</button>
    </>
  )
}

function renderProvider(props: Parameters<typeof AppDataProbe>[0] = {}, currentUser: typeof user | null = user) {
  render(
    <AppDataProvider user={currentUser} onLogout={() => {}}>
      <AppDataProbe {...props} />
    </AppDataProvider>
  )
}

async function waitForLoad() {
  await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
}

function text(testId: string) {
  return screen.getByTestId(testId).textContent
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getProfile.mockResolvedValue({ target_kcal: 2000, meal_config: JSON.stringify(oldConfig), visible_meals: '["breakfast","lunch"]' })
  mocks.getRecipes.mockResolvedValue([])
  mocks.getMeals.mockResolvedValue([])
  mocks.getShoppingItems.mockResolvedValue([])
  mocks.getShoppingRecipes.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('AppDataProvider loading', () => {
  it('loads profile, recipes, meals and the shopping list for a signed in user', async () => {
    mocks.getRecipes.mockResolvedValue([{ id: 'r1' }])
    mocks.getMeals.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }])
    mocks.getShoppingItems.mockResolvedValue([{ id: 'i1' }])
    mocks.getShoppingRecipes.mockResolvedValue([
      { recipe: { id: 'r1' }, portions: 2 },
      { recipe: { id: 'r1' }, portions: 3 },
      { recipe: { id: 'r2' }, portions: 1 },
    ])
    renderProvider()
    await waitForLoad()

    expect(text('meal-names')).toBe('Breakfast, Lunch')
    expect(text('counts')).toBe('recipes 1, meals 2, items 1, list recipes r1x3 r2x1')
  })

  it('keeps going with empty data when requests fail or the profile is broken', async () => {
    mocks.getProfile.mockResolvedValue({ target_kcal: 2000, meal_config: '{broken', visible_meals: '[broken' })
    mocks.getRecipes.mockRejectedValue(new Error('down'))
    mocks.getMeals.mockRejectedValue(new Error('down'))
    mocks.getShoppingItems.mockRejectedValue(new Error('down'))
    mocks.getShoppingRecipes.mockRejectedValue(new Error('down'))
    renderProvider()
    await waitForLoad()

    expect(JSON.parse(text('profile') ?? '')).toEqual({ target_kcal: 2000, meal_config: '{broken', visible_meals: '[broken' })
    expect(text('counts')).toBe('recipes 0, meals 0, items 0, list recipes ')
  })

  it('has no profile when the server returns none', async () => {
    mocks.getProfile.mockRejectedValue(new Error('not found'))
    renderProvider()
    await waitForLoad()

    expect(text('profile')).toBe('null')
  })

  it('loads nothing without a signed in user', async () => {
    renderProvider({}, null)
    await waitForLoad()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh meals' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh shopping list' }))

    expect(text('profile')).toBe('null')
    expect(mocks.getProfile).not.toHaveBeenCalled()
    expect(mocks.getMeals).not.toHaveBeenCalled()
    expect(mocks.getShoppingItems).not.toHaveBeenCalled()
  })
})

describe('AppDataProvider refresh', () => {
  it('reloads each part of the data on request', async () => {
    renderProvider()
    await waitForLoad()
    mocks.getProfile.mockResolvedValue({ target_kcal: 2000, meal_config: [{ id: 'lunch', name: 'Brunch', visible: true }] })
    mocks.getRecipes.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
    mocks.getMeals.mockResolvedValue([{ id: 'm1' }])
    mocks.getShoppingItems.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }])
    mocks.getShoppingRecipes.mockResolvedValue([{ recipe: { id: 'r2' }, portions: 4 }])

    fireEvent.click(screen.getByRole('button', { name: 'Refresh profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh recipes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh meals' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh shopping list' }))

    await waitFor(() => expect(text('meal-names')).toBe('Brunch'))
    await waitFor(() => expect(text('counts')).toBe('recipes 2, meals 1, items 2, list recipes r2x4'))
  })

  it('empties the shopping list recipes when the list has none and keeps the profile when refreshing fails', async () => {
    mocks.getShoppingRecipes.mockResolvedValue([{ recipe: { id: 'r1' }, portions: 1 }])
    renderProvider()
    await waitFor(() => expect(text('counts')).toBe('recipes 0, meals 0, items 0, list recipes r1x1'))
    mocks.getShoppingRecipes.mockResolvedValue([])
    mocks.getProfile.mockRejectedValue(new Error('down'))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh shopping list' }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh profile' }))

    await waitFor(() => expect(text('counts')).toBe('recipes 0, meals 0, items 0, list recipes '))
    expect(text('meal-names')).toBe('Breakfast, Lunch')
  })
})

describe('AppDataProvider saveProfile', () => {
  it('shows saved meal names and order to every screen without reloading', async () => {
    const newConfig = [
      { id: 'lunch', name: 'Late lunch', visible: true },
      { id: 'breakfast', name: 'Early breakfast', visible: true },
    ]
    mocks.updateProfile.mockResolvedValue({ target_kcal: 2000, meal_config: JSON.stringify(newConfig), visible_meals: '["lunch","breakfast"]' })
    const changes = { meal_config: newConfig, visible_meals: ['lunch', 'breakfast'] }
    renderProvider({ changes })
    await waitForLoad()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(text('meal-names')).toBe('Late lunch, Early breakfast'))
    expect(JSON.parse(text('profile') ?? '')).toEqual({ target_kcal: 2000, meal_config: newConfig, visible_meals: ['lunch', 'breakfast'] })
    expect(mocks.updateProfile).toHaveBeenCalledWith(changes)
    expect(mocks.getProfile).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous profile when saving fails', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('Server error (500)'))
    const onError = vi.fn()
    renderProvider({ changes: { meal_config: [] }, onError })
    await waitForLoad()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith(new Error('Server error (500)')))
    expect(text('meal-names')).toBe('Breakfast, Lunch')
  })
})

describe('AppDataProvider getConsumedForDay', () => {
  const date = '2026-10-17'
  const meals = [
    { id: 'm1', meal_date: date, meal_type: 'breakfast', recipe: { id: 'r1' }, portions_consumed: 2 },
    { id: 'm2', meal_date: date, meal_type: 'lunch', product: { id: 'p1', name: 'Oats', unit: 'g', kcal: 380, protein: 13, fat: 7, carbs: 60 }, portions_consumed: 50 },
    { id: 'm3', meal_date: date, meal_type: 'lunch', product: { id: 'p2', name: 'Egg', unit: 'pc', kcal: 70, protein: 6, fat: 5, carbs: 0.5 }, portions_consumed: 2 },
    { id: 'm4', meal_date: date, meal_type: 'breakfast', manual_kcal: '100', manual_protein: '1.5', manual_fat: '2', manual_carbs: '3' },
    { id: 'm5', meal_date: date, meal_type: 'supper', manual_kcal: 999 },
    { id: 'm6', meal_date: '2026-10-18', meal_type: 'breakfast', manual_kcal: 999 },
    { id: 'm7', meal_date: date, meal_type: 'breakfast', recipe: 'missing' },
    { id: 'm8', meal_date: date, meal_type: 'breakfast', product: 'unknown' },
    { id: 'm9', meal_date: date, meal_type: 'lunch', recipe: { id: 'r1' } },
    { id: 'm10', meal_date: date, meal_type: 'lunch', product: { id: 'p1', name: 'Oats', unit: 'g', kcal: 380, protein: 13, fat: 7, carbs: 60 } },
    { id: 'm11', meal_date: date, meal_type: 'breakfast' },
  ]

  it('adds up only meals shown in the saved meal settings for the given day', async () => {
    mocks.getProfile.mockResolvedValue({ meal_config: [...oldConfig, { id: 'supper', name: 'Supper', visible: false }], visible_meals: ['breakfast', 'lunch', 'supper'] })
    mocks.getRecipes.mockResolvedValue([{ id: 'r1', kcal: 250, protein: 10, fat: 5, carbs: 30 }])
    mocks.getMeals.mockResolvedValue(meals)
    renderProvider({ date })

    await waitFor(() => expect(JSON.parse(text('consumed') ?? '')).toEqual({ kcal: 1560, protein: 63, fat: 37.5, carbs: 184 }))
  })

  it('falls back to visible meals and then to all meals when there are no meal settings', async () => {
    mocks.getProfile.mockResolvedValue({ visible_meals: ['supper'] })
    mocks.getMeals.mockResolvedValue(meals)
    renderProvider({ date })
    await waitFor(() => expect(JSON.parse(text('consumed') ?? '')).toEqual({ kcal: 999, protein: 0, fat: 0, carbs: 0 }))
    cleanup()

    mocks.getProfile.mockResolvedValue(null)
    renderProvider({ date })
    await waitFor(() => expect(JSON.parse(text('consumed') ?? '').kcal).toBe(1809))
  })
})
