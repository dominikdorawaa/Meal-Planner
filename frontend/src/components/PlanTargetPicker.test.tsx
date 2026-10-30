import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanTargetPicker } from './PlanTargetPicker';

function renderPicker(mealType: string) {
  render(
    <PlanTargetPicker
      meals={[{ id: 'breakfast', name: 'Rano' }]}
      mealType={mealType}
      date="2026-10-17"
      editing={false}
      onMealTypeChange={() => {}}
      onDateChange={() => {}}
    />
  );
}

describe('PlanTargetPicker', () => {
  it('shows the meal name from the settings', () => {
    renderPicker('breakfast');

    expect(screen.getByRole('button', { name: /Dodajesz do: Rano/ })).toBeTruthy();
  });

  it('shows the Polish name of a meal missing from the settings instead of its id', () => {
    renderPicker('snack1');

    expect(screen.getByRole('button', { name: /Dodajesz do: Przekąska/ })).toBeTruthy();
    expect(screen.queryByText(/snack1/)).toBeNull();
  });
});
