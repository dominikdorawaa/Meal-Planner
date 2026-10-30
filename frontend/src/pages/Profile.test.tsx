import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from './Profile';
import { api } from '../lib/apiClient';

const mocks = vi.hoisted(() => ({
  profile: {} as Record<string, unknown> | null,
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    auth: { getUser: () => ({ userId: 'user-1' }), logout: vi.fn() },
    profile: { get: vi.fn().mockResolvedValue(null), update: vi.fn() },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    user: { userId: 'user-1', name: 'Ola' },
    profile: mocks.profile,
    onLogout: vi.fn(),
    saveProfile: vi.fn(),
  }),
}));

vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('../components/InstallAppCard', () => ({ InstallAppCard: () => null }));
vi.mock('../components/ThemeCard', () => ({ ThemeCard: () => null }));
vi.mock('../components/ProductDataAttribution', () => ({ ProductDataAttribution: () => null }));
vi.mock('../components/MealSettingsList', () => ({
  MealSettingsList: ({ meals }: { meals: { id: string; name: string; visible: boolean }[] }) => (
    <ul aria-label="meals">
      {meals.map(meal => <li key={meal.id}>{`${meal.name}${meal.visible ? '' : ' (hidden)'}`}</li>)}
    </ul>
  ),
}));

function renderMacros() {
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText('Twoje Makroskładniki'));
}

function saveButton() {
  return screen.getByText('Zapisz Makroskładniki').closest('button') as HTMLButtonElement;
}

beforeEach(() => {
  mocks.profile = {
    gender: 'female',
    weight: 65,
    is_manual_macros: true,
    target_kcal: 2000,
    target_protein: 150,
    target_fat: 67,
    target_carbs: 200,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Profile manual macros limits', () => {
  it('does not accept a calorie goal above 10000', () => {
    renderMacros();

    const kcal = screen.getByLabelText('Twój cel kaloryczny') as HTMLInputElement;
    fireEvent.change(kcal, { target: { value: '10001' } });
    expect(kcal.value).toBe('2000');
    fireEvent.change(kcal, { target: { value: '1999.5' } });
    expect(kcal.value).toBe('2000');
    expect(kcal.getAttribute('inputmode')).toBe('numeric');
    expect(kcal.getAttribute('autocomplete')).toBe('off');
  });

  it('blocks saving when the calorie goal is zero or empty', () => {
    renderMacros();
    expect(saveButton().disabled).toBe(false);

    const kcal = screen.getByLabelText('Twój cel kaloryczny');
    fireEvent.change(kcal, { target: { value: '0' } });
    expect(saveButton().disabled).toBe(true);
    fireEvent.change(kcal, { target: { value: '' } });
    expect(saveButton().disabled).toBe(true);
  });

  it('does not accept macro grams above 1000 or a share above 100 percent', () => {
    renderMacros();

    const grams = screen.getByLabelText('Białko (g)') as HTMLInputElement;
    const before = grams.value;
    fireEvent.change(grams, { target: { value: '1001' } });
    expect(grams.value).toBe(before);

    const percent = screen.getByLabelText('Białko (%)') as HTMLInputElement;
    const percentBefore = percent.value;
    fireEvent.change(percent, { target: { value: '101' } });
    expect(percent.value).toBe(percentBefore);
    fireEvent.change(percent, { target: { value: '35' } });
    expect(percent.value).toBe('35');
  });
});

describe('Profile meal settings', () => {
  it('keeps the last meal above the save bar and the system navigation bar', () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Ustawienia Posiłków'));

    const list = screen.getByText('Dostosuj nazwy i wybierz aktywne posiłki.').closest('.overflow-y-auto') as HTMLElement;
    expect(list.className).toContain('pb-[calc(8rem+env(safe-area-inset-bottom))]');
    expect(list.className).not.toContain('pb-32');
  });

  it('shows the default Polish meal names when the profile has no saved meal settings', () => {
    mocks.profile = { ...mocks.profile, visible_meals: ['breakfast', 'snack1'] };
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Ustawienia Posiłków'));

    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Śniadanie',
      'II śniadanie (hidden)',
      'Obiad (hidden)',
      'Przekąska',
      'Podwieczorek (hidden)',
      'Kolacja (hidden)',
    ]);
  });

  it('uses the saved meal settings loaded from the server when nothing is cached', async () => {
    mocks.profile = null;
    vi.mocked(api.profile.get).mockResolvedValueOnce({
      meal_config: JSON.stringify([{ id: 'snack2', name: 'Owoce', icon: 'cookie', visible: true }]),
    });
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByText('Ustawienia Posiłków'));

    expect((await screen.findAllByRole('listitem')).map(item => item.textContent)).toEqual(['Owoce']);
  });
});
