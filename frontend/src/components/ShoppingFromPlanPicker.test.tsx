import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShoppingFromPlanPicker } from './ShoppingFromPlanPicker';
import { t } from '../i18n';
import type { MealType } from '../lib/mealTypes';
import type { PlanMeal } from '../lib/shoppingFromPlan';

const MEAL_TYPES: MealType[] = [
  { id: 'breakfast', name: 'Śniadanie', icon: 'light_mode', visible: true },
  { id: 'snack1', name: '2 Śniadanie', icon: 'bakery_dining', visible: false },
  { id: 'dinner', name: 'Obiad', icon: 'restaurant', visible: true },
];

const RECIPES = [{ id: 'r1', name: 'Omlet' }, { id: 'r2', name: 'Spaghetti' }];

const MEALS: PlanMeal[] = [
  { id: 'm1', meal_date: '2026-10-17', meal_type: 'dinner', recipe: { id: 'r2' } },
  { id: 'm2', meal_date: '2026-10-17', meal_type: 'breakfast', recipe: 'r1' },
  { id: 'm3', meal_date: '2026-10-17', meal_type: 'snack1', recipe: 'r1' },
  { id: 'm4', meal_date: '2026-10-18', meal_type: 'breakfast', product: { id: 'p1', name: 'Jogurt', brand: 'Bio' } as never },
  { id: 'm5', meal_date: '2026-10-18', meal_type: 'dinner', manual_name: 'Pizza' },
  { id: 'm6', meal_date: '2026-10-18', meal_type: 'dinner' },
  { id: 'm7', meal_date: '2026-10-25', meal_type: 'dinner', recipe: 'r1' },
  { id: 'm8', meal_date: '2026-10-25', meal_type: 'breakfast', recipe: 'gone' },
];

const onConfirm = vi.fn();
const onClose = vi.fn();

function renderPicker(props: Partial<Parameters<typeof ShoppingFromPlanPicker>[0]> = {}) {
  return render(
    <ShoppingFromPlanPicker
      meals={MEALS}
      recipes={RECIPES}
      mealTypes={MEAL_TYPES}
      submitting={false}
      error={null}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />
  );
}

const dayCheckbox = (day: string) => screen.getByRole('checkbox', { name: t('shopping.selectDay', { day }) });
const mealCheckbox = (name: string) => screen.getByRole('checkbox', { name: t('shopping.selectMeal', { name }) });
const addButton = (count: number) => screen.getByRole('button', { name: new RegExp(`\\(${count}\\)`) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 17, 12));
  onConfirm.mockReset();
  onClose.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ShoppingFromPlanPicker', () => {
  it('lists a week from today with visible meals in the meal settings order', () => {
    renderPicker();

    expect(screen.getByText('17.10 - 23.10')).toBeTruthy();
    const todayMeals = screen
      .getAllByRole('checkbox')
      .map(box => box.getAttribute('aria-label'))
      .slice(0, 3);
    expect(todayMeals).toEqual([
      t('shopping.selectDay', { day: 'Dzisiaj' }),
      t('shopping.selectMeal', { name: 'Śniadanie: Omlet' }),
      t('shopping.selectMeal', { name: 'Obiad: Spaghetti' }),
    ]);
    expect(mealCheckbox('Śniadanie: Jogurt (Bio)')).toBeTruthy();
    expect(mealCheckbox('Obiad: Pizza')).toBeTruthy();
    expect(mealCheckbox(`Obiad: ${t('shopping.quickMeal')}`)).toBeTruthy();
    expect(screen.getAllByText(t('shopping.noMeals'))).toHaveLength(5);
    expect((dayCheckbox('Poniedziałek, 19 października') as HTMLButtonElement).disabled).toBe(true);
  });

  it('selects a whole day and confirms its meals', () => {
    renderPicker();

    fireEvent.click(dayCheckbox('Dzisiaj'));

    expect(dayCheckbox('Dzisiaj').getAttribute('aria-checked')).toBe('true');
    expect(mealCheckbox('Śniadanie: Omlet').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(addButton(2));
    expect(onConfirm).toHaveBeenCalledWith([MEALS[0], MEALS[1]]);
  });

  it('marks a partly selected day and clears it with the day checkbox', () => {
    renderPicker();

    fireEvent.click(mealCheckbox('Obiad: Pizza'));
    expect(dayCheckbox('Jutro').getAttribute('aria-checked')).toBe('mixed');

    fireEvent.click(dayCheckbox('Jutro'));
    expect(dayCheckbox('Jutro').getAttribute('aria-checked')).toBe('true');

    fireEvent.click(dayCheckbox('Jutro'));
    expect(dayCheckbox('Jutro').getAttribute('aria-checked')).toBe('false');
    expect((screen.getByRole('button', { name: new RegExp(`\\(0\\)`) }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('unchecks a single meal', () => {
    renderPicker();

    fireEvent.click(mealCheckbox('Obiad: Spaghetti'));
    fireEvent.click(mealCheckbox('Obiad: Spaghetti'));

    expect(mealCheckbox('Obiad: Spaghetti').getAttribute('aria-checked')).toBe('false');
  });

  it('keeps selections while moving between weeks', () => {
    renderPicker();

    fireEvent.click(mealCheckbox('Obiad: Spaghetti'));
    fireEvent.click(screen.getByRole('button', { name: t('shopping.nextWeek') }));

    expect(screen.getByText('24.10 - 30.10')).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: /^Zaznacz: / })).toHaveLength(1);
    fireEvent.click(mealCheckbox('Obiad: Omlet'));
    fireEvent.click(screen.getByRole('button', { name: t('shopping.previousWeek') }));
    fireEvent.click(screen.getByRole('button', { name: t('shopping.previousWeek') }));
    expect(screen.getByText('10.10 - 16.10')).toBeTruthy();

    fireEvent.click(addButton(2));
    expect(onConfirm).toHaveBeenCalledWith([MEALS[0], MEALS[6]]);
  });

  it('closes from the close button, cancel and the backdrop', () => {
    const { container } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: t('shopping.close') }));
    fireEvent.click(screen.getByRole('button', { name: t('shopping.cancel') }));
    fireEvent.click(container.firstElementChild!.firstElementChild!);

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('shows the error and blocks closing while saving', () => {
    const { container } = renderPicker({ submitting: true, error: 'Coś poszło nie tak' });

    expect(screen.getByText('Coś poszło nie tak')).toBeTruthy();
    fireEvent.click(container.firstElementChild!.firstElementChild!);
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: t('shopping.cancel') }) as HTMLButtonElement).disabled).toBe(true);
  });
});
