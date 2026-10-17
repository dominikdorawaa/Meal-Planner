import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppDataProvider, useAppData } from './AppDataContext'

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('./apiClient', () => ({
  api: {
    profile: { get: mocks.getProfile, update: mocks.updateProfile },
    recipes: { getAll: vi.fn().mockResolvedValue([]) },
    meals: { getAll: vi.fn().mockResolvedValue([]) },
    shoppingList: { getItems: vi.fn().mockResolvedValue([]), getRecipes: vi.fn().mockResolvedValue([]) },
  },
}))

const user = { userId: 'user-1', email: 'user@example.com', name: 'Test User' }

function MealNames({ changes, onError }: { changes: Record<string, unknown>, onError: (error: Error) => void }) {
  const { profile, saveProfile } = useAppData()
  const meals = Array.isArray(profile?.meal_config) ? profile.meal_config : []
  return (
    <>
      <p>{meals.map((meal: { name: string }) => meal.name).join(', ')}</p>
      <p>{`Visible: ${JSON.stringify(profile?.visible_meals)}, kcal: ${profile?.target_kcal}`}</p>
      <button onClick={() => saveProfile(changes).catch(onError)}>Save</button>
    </>
  )
}

function renderProvider(changes: Record<string, unknown>, onError = vi.fn()) {
  render(
    <AppDataProvider user={user} onLogout={() => {}}>
      <MealNames changes={changes} onError={onError} />
    </AppDataProvider>
  )
  return onError
}

const oldConfig = [
  { id: 'breakfast', name: 'Breakfast', visible: true },
  { id: 'lunch', name: 'Lunch', visible: true },
]

beforeEach(() => {
  mocks.getProfile.mockResolvedValue({ target_kcal: 2000, meal_config: JSON.stringify(oldConfig), visible_meals: '["breakfast","lunch"]' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppDataProvider saveProfile', () => {
  it('shows saved meal names and order to every screen without reloading', async () => {
    const newConfig = [
      { id: 'lunch', name: 'Late lunch', visible: true },
      { id: 'breakfast', name: 'Early breakfast', visible: true },
    ]
    mocks.updateProfile.mockResolvedValue({ target_kcal: 2000, meal_config: JSON.stringify(newConfig), visible_meals: '["lunch","breakfast"]' })
    const changes = { meal_config: newConfig, visible_meals: ['lunch', 'breakfast'] }
    renderProvider(changes)
    await screen.findByText('Breakfast, Lunch')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Late lunch, Early breakfast')).toBeTruthy()
    expect(screen.getByText('Visible: ["lunch","breakfast"], kcal: 2000')).toBeTruthy()
    expect(mocks.updateProfile).toHaveBeenCalledWith(changes)
    expect(mocks.getProfile).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous profile when saving fails', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('Server error (500)'))
    const onError = renderProvider({ meal_config: [] })
    await screen.findByText('Breakfast, Lunch')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith(new Error('Server error (500)')))
    expect(screen.getByText('Breakfast, Lunch')).toBeTruthy()
  })
})
