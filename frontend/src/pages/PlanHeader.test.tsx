import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Plan } from './Plan';

vi.mock('../lib/apiClient', () => ({ api: { meals: { add: vi.fn(), delete: vi.fn() } } }));

const APP_DATA = {
  recipes: [],
  profile: { target_kcal: 2000, target_protein: 120, target_fat: 70, target_carbs: 250 },
  userMeals: [],
  setUserMeals: vi.fn(),
  loading: false,
  refreshMeals: vi.fn(),
  getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
};

vi.mock('../lib/AppDataContext', () => ({ useAppData: () => APP_DATA }));

afterEach(cleanup);

function renderPlan() {
  return render(
    <MemoryRouter>
      <Plan />
    </MemoryRouter>
  );
}

describe('Plan screen top', () => {
  it('has no title bar or shopping list button', () => {
    const { container } = renderPlan();

    expect(screen.queryByText('Twój Plan')).toBeNull();
    expect(container.querySelector('header')).toBeNull();
    expect(screen.queryByText('shopping_cart_checkout')).toBeNull();
  });

  it('pins the week navigation to the top of the screen', () => {
    renderPlan();

    const weekBar = screen.getByText('Dzisiaj', { selector: 'button' }).closest('.fixed');
    expect(weekBar?.className.split(' ')).toEqual(expect.arrayContaining(['top-0', 'pt-safe']));
  });
});
