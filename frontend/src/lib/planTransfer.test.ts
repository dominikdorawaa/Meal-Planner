import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteMeals,
  entityId,
  findConflicts,
  mealCopyPayload,
  mealsOfDay,
  parseSlotKey,
  placeDayOnDates,
  placeMealInSlots,
  slotKey,
  transferMeals,
  undoTransfer,
  type PlanMeal,
} from './planTransfer';

const mocks = vi.hoisted(() => ({ add: vi.fn(), delete: vi.fn() }));

vi.mock('./apiClient', () => ({
  api: { meals: { add: mocks.add, delete: mocks.delete } },
}));

const recipeMeal: PlanMeal = { id: 'meal-1', meal_date: '2026-10-12', meal_type: 'breakfast', recipe: { id: 'recipe-1' }, portions_consumed: 2 };
const productMeal: PlanMeal = { id: 'meal-2', meal_date: '2026-10-12', meal_type: 'snack_after_training', product: 'product-1', portions_consumed: 150 };
const manualMeal: PlanMeal = { id: 'meal-3', meal_date: '2026-10-13', meal_type: 'breakfast', manual_name: 'Coffee', manual_kcal: 20, manual_protein: 1, manual_fat: 0, manual_carbs: 3 };
const meals = [recipeMeal, productMeal, manualMeal];

afterEach(() => {
  vi.resetAllMocks();
});

describe('planTransfer', () => {
  it('builds and parses slot keys for meal types that contain underscores', () => {
    const key = slotKey('2026-10-12', 'snack_after_training');

    expect(key).toBe('2026-10-12_snack_after_training');
    expect(parseSlotKey(key)).toEqual({ meal_date: '2026-10-12', meal_type: 'snack_after_training' });
  });

  it('reads entity ids from objects and plain ids', () => {
    expect(entityId({ id: 'recipe-1' })).toBe('recipe-1');
    expect(entityId('product-1')).toBe('product-1');
    expect(entityId(null)).toBeNull();
    expect(entityId({})).toBeNull();
  });

  it('copies every meal field into a new slot', () => {
    expect(mealCopyPayload(recipeMeal, '2026-10-20', 'dinner')).toEqual({
      recipe: { id: 'recipe-1' },
      product: null,
      meal_date: '2026-10-20',
      meal_type: 'dinner',
      portions_consumed: 2,
      measure_code: undefined,
      measure_amount: undefined,
      manual_name: undefined,
      manual_kcal: undefined,
      manual_protein: undefined,
      manual_fat: undefined,
      manual_carbs: undefined,
    });
    expect(mealCopyPayload(productMeal, '2026-10-20', 'lunch')).toMatchObject({ recipe: null, product: { id: 'product-1' } });
    expect(mealCopyPayload({ ...productMeal, measure_code: 'piece', measure_amount: 2 }, '2026-10-20', 'lunch'))
      .toMatchObject({ portions_consumed: 150, measure_code: 'piece', measure_amount: 2 });
    expect(mealCopyPayload(manualMeal, '2026-10-20', 'lunch')).toMatchObject({ recipe: null, product: null, manual_name: 'Coffee', manual_kcal: 20 });
  });

  it('places one meal in each selected slot', () => {
    expect(placeMealInSlots(recipeMeal, ['2026-10-14_lunch', '2026-10-15_dinner'])).toEqual([
      { meal: recipeMeal, meal_date: '2026-10-14', meal_type: 'lunch' },
      { meal: recipeMeal, meal_date: '2026-10-15', meal_type: 'dinner' },
    ]);
  });

  it('places every meal of a day on each target date and keeps meal types', () => {
    expect(mealsOfDay(meals, '2026-10-12')).toEqual([recipeMeal, productMeal]);
    expect(placeDayOnDates(meals, '2026-10-12', ['2026-10-13', '2026-10-14'])).toEqual([
      { meal: recipeMeal, meal_date: '2026-10-13', meal_type: 'breakfast' },
      { meal: productMeal, meal_date: '2026-10-13', meal_type: 'snack_after_training' },
      { meal: recipeMeal, meal_date: '2026-10-14', meal_type: 'breakfast' },
      { meal: productMeal, meal_date: '2026-10-14', meal_type: 'snack_after_training' },
    ]);
    expect(placeDayOnDates(meals, '2026-10-20', ['2026-10-21'])).toEqual([]);
  });

  it('finds only meals in the target slots and skips ignored meals', () => {
    const placements = placeDayOnDates(meals, '2026-10-12', ['2026-10-13']);

    expect(findConflicts(meals, placements)).toEqual([manualMeal]);
    expect(findConflicts(meals, placeMealInSlots(recipeMeal, ['2026-10-12_breakfast']), [recipeMeal])).toEqual([]);
    expect(findConflicts(meals, placeMealInSlots(recipeMeal, ['2026-10-13_lunch']))).toEqual([]);
  });

  it('appends copies without removing existing meals', async () => {
    mocks.add.mockResolvedValueOnce({ id: 'copy-1' });

    const result = await transferMeals(placeMealInSlots(recipeMeal, ['2026-10-13_breakfast']), [manualMeal], 'append');

    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-13', meal_type: 'breakfast', recipe: { id: 'recipe-1' } }));
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ created: [{ id: 'copy-1' }], removed: [], complete: true });
  });

  it('removes conflicts and moved sources after adding the copies', async () => {
    const calls: string[] = [];
    mocks.add.mockImplementation(async () => { calls.push('add'); return { id: 'copy-1' }; });
    mocks.delete.mockImplementation(async (id: string) => { calls.push(`delete ${id}`); });

    const result = await transferMeals(placeMealInSlots(recipeMeal, ['2026-10-13_breakfast']), [manualMeal], 'overwrite', [recipeMeal]);

    expect(calls).toEqual(['add', 'delete meal-3', 'delete meal-1']);
    expect(result).toEqual({ created: [{ id: 'copy-1' }], removed: [manualMeal, recipeMeal], complete: true });
  });

  it('removes the copies that were added and nothing else when one copy fails', async () => {
    mocks.add.mockResolvedValueOnce({ id: 'copy-1' }).mockRejectedValueOnce(new Error('Server error (500)'));

    await expect(
      transferMeals(placeMealInSlots(recipeMeal, ['2026-10-13_breakfast', '2026-10-14_breakfast']), [manualMeal], 'overwrite')
    ).rejects.toThrow('Could not add every meal copy');
    expect(mocks.delete.mock.calls).toEqual([['copy-1']]);
  });

  it('reports an incomplete transfer with what was really removed when a delete fails', async () => {
    mocks.add.mockResolvedValueOnce({ id: 'copy-1' });
    mocks.delete.mockImplementation(async (id: string) => {
      if (id === 'meal-1') throw new Error('Server error (500)');
    });

    const result = await transferMeals(placeMealInSlots(recipeMeal, ['2026-10-13_breakfast']), [manualMeal], 'overwrite', [recipeMeal]);

    expect(result).toEqual({ created: [{ id: 'copy-1' }], removed: [manualMeal], complete: false });
  });

  it('undoes a transfer by restoring removed meals and deleting the copies', async () => {
    mocks.add.mockResolvedValue({ id: 'restored' });

    await undoTransfer({ created: [{ ...recipeMeal, id: 'copy-1' }], removed: [manualMeal], complete: true });

    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-13', meal_type: 'breakfast', manual_name: 'Coffee' }));
    expect(mocks.delete).toHaveBeenCalledWith('copy-1');
  });

  it('still removes the copies but reports a failure when a restore fails', async () => {
    mocks.add.mockRejectedValueOnce(new Error('Server error (500)'));

    await expect(undoTransfer({ created: [{ ...recipeMeal, id: 'copy-1' }], removed: [manualMeal], complete: true })).rejects.toThrow('Could not undo every change');
    expect(mocks.delete).toHaveBeenCalledWith('copy-1');
  });

  it('deletes all given meals', async () => {
    await deleteMeals([recipeMeal, productMeal]);

    expect(mocks.delete.mock.calls).toEqual([['meal-1'], ['meal-2']]);
  });
});
