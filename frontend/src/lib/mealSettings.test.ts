import { describe, expect, it } from 'vitest'
import { reorderMeals } from './mealSettings'

const meals = [
  { id: 'breakfast', name: 'Breakfast', visible: true },
  { id: 'lunch', name: 'Lunch', visible: true },
  { id: 'dinner', name: 'Dinner', visible: false },
]

describe('reorderMeals', () => {
  it('moves the dragged meal to the position of the meal it was dropped on', () => {
    expect(reorderMeals(meals, 'dinner', 'breakfast').map(meal => meal.id)).toEqual(['dinner', 'breakfast', 'lunch'])
    expect(reorderMeals(meals, 'breakfast', 'lunch').map(meal => meal.id)).toEqual(['lunch', 'breakfast', 'dinner'])
  })

  it('keeps the same list when the meal is dropped on itself or outside the list', () => {
    expect(reorderMeals(meals, 'lunch', 'lunch')).toBe(meals)
    expect(reorderMeals(meals, 'lunch', null)).toBe(meals)
    expect(reorderMeals(meals, 'unknown', 'lunch')).toBe(meals)
  })
})
