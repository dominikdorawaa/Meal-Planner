import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from './Profile';
import { api } from '../lib/apiClient';

const mocks = vi.hoisted(() => ({
  profile: {} as Record<string, unknown> | null,
  saveProfile: vi.fn(),
  user: { userId: 'user-1' } as { userId: string } | null,
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    auth: { getUser: () => mocks.user, logout: vi.fn() },
    profile: { get: vi.fn().mockResolvedValue(null), update: vi.fn() },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    user: { userId: 'user-1', name: 'Ola', email: 'ola@example.com' },
    profile: mocks.profile,
    onLogout: vi.fn(),
    saveProfile: mocks.saveProfile,
  }),
}));

vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('../components/InstallAppCard', () => ({ InstallAppCard: () => null }));
vi.mock('../components/ProductDataAttribution', () => ({ ProductDataAttribution: () => <p>Product data attribution</p> }));
vi.mock('../components/MealSettingsList', () => ({
  MealSettingsList: ({ meals, renderMeal }: { meals: { id: string; name: string; visible: boolean }[]; renderMeal: (meal: unknown, index: number, handle: null) => React.ReactNode }) => (
    <ul aria-label="meals">
      {meals.map((meal, index) => (
        <li key={meal.id} data-name={`${meal.name}${meal.visible ? '' : ' (hidden)'}`}>
          {renderMeal(meal, index, null)}
        </li>
      ))}
    </ul>
  ),
}));

const baseProfile = {
  display_name: 'Ola',
  gender: 'male',
  age: 23,
  height: 182,
  weight: 78,
  target_weight: 74,
  lifestyle_activity: 0.2,
  exercise_activity: 0.2,
  change_speed: 0.5,
  is_manual_macros: false,
  target_kcal: 2392,
  target_protein: 172,
  target_fat: 70,
  target_carbs: 269,
};

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
}

function page(name: string) {
  return within(screen.getByRole('region', { name }));
}

function lastSaved() {
  return mocks.saveProfile.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  mocks.profile = { ...baseProfile };
  mocks.user = { userId: 'user-1' };
  mocks.saveProfile.mockReset().mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  localStorage.removeItem('mp_manual_targets');
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Profile overview', () => {
  it('shows the weight goal, the daily goal and the settings categories', () => {
    renderProfile();
    expect(screen.queryByText('Product data attribution')).toBeNull();

    const weight = screen.getByRole('button', { name: /Cel wagi/ });
    expect(weight.textContent).toContain('78');
    expect(weight.textContent).toContain('74');
    expect(weight.textContent).toContain('Redukcja');
    expect(weight.textContent).toContain('(8 tyg.)');
    expect(screen.getByRole('button', { name: /Dzienny cel/ }).textContent).toContain('2392');
    expect(screen.getByRole('button', { name: /Aktywność/ }).textContent).toContain('Umiarkowany');
    expect(screen.getByRole('button', { name: /Posiłki/ }).textContent).toContain('6 z 6');
    expect(screen.getByRole('button', { name: /Wygląd/ }).textContent).toContain('Ciemny');
  });

  it('says the weight is kept when the goal equals the current weight', () => {
    mocks.profile = { ...baseProfile, target_weight: 78 };
    renderProfile();

    expect(screen.getByRole('button', { name: /Cel wagi/ }).textContent).toContain('Utrzymujesz obecną wagę');
  });

  it('loads the profile from the server when nothing is cached', async () => {
    mocks.profile = null;
    vi.mocked(api.profile.get).mockResolvedValueOnce({ ...baseProfile, weight: 90, target_weight: 80 });
    renderProfile();

    expect((await screen.findByText('90')).closest('button')?.textContent).toContain('80');
  });
});

describe('Profile weight goal', () => {
  it('saves a typed goal and the pace and recalculates the daily goal', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Cel wagi/ }));
    const goalPage = page('Cel i tempo');

    expect(goalPage.getByText(/Teraz ważysz 78 kg/)).toBeTruthy();
    expect(goalPage.queryByLabelText('Teraz')).toBeNull();
    const target = goalPage.getByLabelText('Cel') as HTMLInputElement;
    fireEvent.focus(target);
    fireEvent.change(target, { target: { value: '72,5' } });
    fireEvent.blur(target);
    expect(target.value).toBe('72,5');
    fireEvent.click(goalPage.getByRole('button', { name: 'Zmniejsz: Tempo na tydzień' }));
    fireEvent.click(goalPage.getByRole('button', { name: 'Zmniejsz: Tempo na tydzień' }));
    expect((goalPage.getByLabelText('Tempo na tydzień') as HTMLInputElement).value).toBe('0,3');
    expect(goalPage.getByText('−300')).toBeTruthy();

    await act(async () => {
      fireEvent.click(goalPage.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ weight: 78, target_weight: 72.5, change_speed: 0.3, goal: 'reduce', target_kcal: 2592 });
    expect(screen.queryByRole('region', { name: 'Cel i tempo' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Dzienny cel: 2592 kcal (+200 kcal)');
  });

  it('saves the current weight on its own page', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /^Waga/ }));
    const weightPage = page('Waga');

    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Teraz' }));
    expect(weightPage.queryByLabelText('Cel')).toBeNull();

    await act(async () => {
      fireEvent.click(weightPage.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ weight: 78.5, target_weight: 74 });
    expect(screen.getByRole('button', { name: /^Waga/ }).textContent).toContain('78,5 kg');
  });

  it('marks the recommended pace and hides the pace when keeping the weight', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Cel wagi/ }));
    const weightPage = page('Cel i tempo');

    expect(weightPage.getByText('Zalecamy 0,5 kg na tydzień.')).toBeTruthy();
    expect(weightPage.getByText(/chudniesz bez dużego głodu/)).toBeTruthy();
    expect((weightPage.getByLabelText('Tempo na tydzień') as HTMLInputElement).value).toBe('0,5');
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));
    fireEvent.click(weightPage.getByRole('button', { name: 'Zwiększ: Cel' }));

    expect(weightPage.queryByLabelText('Tempo na tydzień')).toBeNull();
    expect(weightPage.getByText(/jesz tyle, ile spalasz/)).toBeTruthy();
  });

  it('locks the pace and explains why when the daily goal is set by hand', () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000 };
    renderProfile();
    expect(screen.getByRole('button', { name: /Cel wagi/ }).textContent).toContain('(5 tyg.)');
    fireEvent.click(screen.getByRole('button', { name: /Cel wagi/ }));
    const goalPage = page('Cel i tempo');

    expect(goalPage.getByText('Tempo jest zablokowane')).toBeTruthy();
    expect(goalPage.getByText(/ustawiony ręcznie na 2000 kcal/)).toBeTruthy();
    expect((goalPage.getByLabelText('Tempo na tydzień') as HTMLInputElement).disabled).toBe(true);
    expect((goalPage.getByLabelText('Tempo na tydzień') as HTMLInputElement).value).toBe('0,9');
    expect((goalPage.getByRole('button', { name: 'Zwiększ: Tempo na tydzień' }) as HTMLButtonElement).disabled).toBe(true);
    expect(goalPage.queryByText(/Zalecamy/)).toBeNull();
    expect(goalPage.getByText('5 tyg.')).toBeTruthy();

    fireEvent.click(goalPage.getByRole('button', { name: /Zmień dzienny cel/ }));
    expect(screen.queryByRole('region', { name: 'Cel i tempo' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Dzienny cel' })).toBeTruthy();
  });

  it('keeps the page open when saving fails', async () => {
    mocks.saveProfile.mockRejectedValueOnce(new Error('offline'));
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Cel wagi/ }));

    await act(async () => {
      fireEvent.click(page('Cel i tempo').getByRole('button', { name: 'Zapisz' }));
    });

    expect(screen.getByRole('region', { name: 'Cel i tempo' })).toBeTruthy();
  });

  it('does not save without a signed in user', async () => {
    mocks.user = null;
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Cel wagi/ }));

    await act(async () => {
      fireEvent.click(page('Cel i tempo').getByRole('button', { name: 'Zapisz' }));
    });

    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});

describe('Profile activity', () => {
  it('warns that activity does not change a hand set goal and hides the calories', () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000 };
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Aktywność/ }));
    const activity = page('Aktywność');

    expect(activity.getByText('Aktywność nie zmienia kalorii')).toBeTruthy();
    expect(activity.getByText(/ustawiony ręcznie na 2000 kcal/)).toBeTruthy();
    expect(activity.queryByText('+181 kcal')).toBeNull();
    fireEvent.click(activity.getByRole('button', { name: /Zmień dzienny cel/ }));
    expect(screen.getByRole('region', { name: 'Dzienny cel' })).toBeTruthy();
  });

  it('asks about the usual day and workouts in two steps and explains the calories', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Aktywność/ }));
    const activity = page('Aktywność');

    expect(activity.getByText('Krok 1 z 2')).toBeTruthy();
    expect(activity.getByText(/około 181 kcal dziennie różnicy/)).toBeTruthy();
    expect(activity.getByRole('radio', { name: /Umiarkowany/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(activity.getByRole('radio', { name: /Lekki/ }));
    expect(activity.getByRole('radio', { name: /Lekki/ }).textContent).toContain('+181 kcal');
    fireEvent.click(activity.getByRole('button', { name: /Dalej: treningi/ }));

    expect(activity.getByText('Krok 2 z 2')).toBeTruthy();
    fireEvent.click(activity.getByRole('button', { name: 'Wróć' }));
    expect(activity.getByText('Krok 1 z 2')).toBeTruthy();
    fireEvent.click(activity.getByRole('button', { name: /Dalej: treningi/ }));
    fireEvent.click(activity.getByRole('radio', { name: /5 i więcej/ }));

    await act(async () => {
      fireEvent.click(activity.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ lifestyle_activity: 0.1, exercise_activity: 0.3 });
  });
});

describe('Profile details', () => {
  it('shows the data and edits everything after tapping edit', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Profil/ }));
    const details = page('Profil');

    expect(details.getByText('Mężczyzna')).toBeTruthy();
    expect(details.getByText('23 lat')).toBeTruthy();
    expect(details.getByText('182 cm')).toBeTruthy();
    fireEvent.click(details.getByRole('button', { name: 'Edytuj' }));

    fireEvent.change(details.getByPlaceholderText('Ola'), { target: { value: 'Ania' } });
    fireEvent.click(details.getByRole('radio', { name: 'Kobieta' }));
    fireEvent.click(details.getByRole('button', { name: 'Zmniejsz: Wiek' }));
    fireEvent.click(details.getByRole('button', { name: 'Zwiększ: Wzrost' }));

    await act(async () => {
      fireEvent.click(details.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ display_name: 'Ania', gender: 'female', age: 22, height: 183 });
    expect(screen.getByRole('status').textContent).toMatch(/Dzienny cel: \d+ kcal \(−\d+ kcal\)/);
    expect(details.getByText('Kobieta')).toBeTruthy();
  });

  it('shows the height in feet and inches when that unit is chosen in more settings', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Więcej ustawień' }));
    const settings = page('Więcej ustawień');
    expect(settings.getByRole('radio', { name: 'Centymetry (cm)' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(settings.getByRole('radio', { name: 'Stopy i cale (ft, in)' }));
    expect(localStorage.getItem('mp_height_unit')).toBe('ft');
    fireEvent.click(settings.getByRole('button', { name: 'Wróć' }));

    fireEvent.click(screen.getByRole('button', { name: /Profil/ }));
    const details = page('Profil');
    expect(details.getByText('6′ 0″')).toBeTruthy();
    fireEvent.click(details.getByRole('button', { name: 'Edytuj' }));
    expect((details.getByLabelText('Wzrost: stopy') as HTMLInputElement).value).toBe('6');
    expect((details.getByLabelText('Wzrost: cale') as HTMLInputElement).value).toBe('0');
    fireEvent.click(details.getByRole('button', { name: 'Zwiększ: Wzrost: cale' }));
    fireEvent.click(details.getByRole('button', { name: 'Zmniejsz: Wzrost: stopy' }));

    await act(async () => {
      fireEvent.click(details.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ height: 154.9 });
    expect(details.getByText('5′ 1″')).toBeTruthy();
    localStorage.removeItem('mp_height_unit');
  });

  it('drops unsaved edits on cancel', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Profil/ }));
    const details = page('Profil');
    fireEvent.click(details.getByRole('button', { name: 'Edytuj' }));
    fireEvent.click(details.getByRole('radio', { name: 'Kobieta' }));

    fireEvent.click(details.getByRole('button', { name: 'Anuluj' }));

    expect(details.getByText('Mężczyzna')).toBeTruthy();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});

describe('Profile daily goal', () => {
  function openTargets() {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Dzienny cel/ }));
    return page('Dzienny cel');
  }

  it('shows the automatic goal with macro ranges', () => {
    const targets = openTargets();

    expect(targets.getByRole('switch', { name: 'Licz automatycznie' }).getAttribute('aria-checked')).toBe('true');
    expect(targets.getByText('156-187 g')).toBeTruthy();
    expect(targets.getByText('2,0-2,4 g/kg')).toBeTruthy();
    expect(targets.getByText('0,8-1,0 g/kg')).toBeTruthy();
    fireEvent.click(targets.getByRole('switch', { name: 'Licz automatycznie' }));
    expect(targets.getByText('2,2 g/kg')).toBeTruthy();
    expect(targets.getAllByRole('button', { name: 'Skąd 2392 kcal?' })).toHaveLength(1);
  });

  it('switches to manual goals and saves them with tolerance ranges', async () => {
    const targets = openTargets();
    fireEvent.click(targets.getByRole('switch', { name: 'Licz automatycznie' }));

    const protein = targets.getByLabelText('Białko (g)') as HTMLInputElement;
    expect(protein.value).toBe('172');
    fireEvent.change(protein, { target: { value: '160' } });
    expect((targets.getByLabelText('Twój cel kaloryczny') as HTMLInputElement).value).toBe('2346');
    fireEvent.change(targets.getByLabelText('Białko (%)'), { target: { value: '30' } });
    expect(protein.value).toBe('176');
    fireEvent.change(protein, { target: { value: '160' } });

    await act(async () => {
      fireEvent.click(targets.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ is_manual_macros: true, target_kcal: 2346, target_protein: 160, target_protein_min: 152, target_protein_max: 168 });
  });

  it('does not accept a calorie goal above 10000 and blocks saving without one', () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000, target_protein: 150, target_fat: 67, target_carbs: 199 };
    const targets = openTargets();
    const save = targets.getByRole('button', { name: 'Zapisz' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    const kcal = targets.getByLabelText('Twój cel kaloryczny') as HTMLInputElement;
    fireEvent.change(kcal, { target: { value: '10001' } });
    expect(kcal.value).toBe('2000');
    expect(kcal.getAttribute('inputmode')).toBe('numeric');
    fireEvent.change(kcal, { target: { value: '0' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(kcal, { target: { value: '' } });
    expect(save.disabled).toBe(true);
  });

  it('does not accept macro grams above 1000 or a share above 100 percent and warns about the total', () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000, target_protein: 150, target_fat: 67, target_carbs: 199 };
    const targets = openTargets();

    const grams = targets.getByLabelText('Białko (g)') as HTMLInputElement;
    fireEvent.change(grams, { target: { value: '1001' } });
    expect(grams.value).toBe('150');
    const percent = targets.getByLabelText('Białko (%)') as HTMLInputElement;
    fireEvent.change(percent, { target: { value: '101' } });
    expect(percent.value).toBe('30');
    fireEvent.change(percent, { target: { value: '35' } });

    expect(targets.getByText('Udziały muszą dawać razem 100%.')).toBeTruthy();
    expect((targets.getByRole('button', { name: 'Zapisz' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('goes back to automatic goals', async () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000 };
    const targets = openTargets();
    fireEvent.click(targets.getByRole('switch', { name: 'Licz automatycznie' }));

    await act(async () => {
      fireEvent.click(targets.getByRole('button', { name: 'Zapisz' }));
    });

    expect(lastSaved()).toMatchObject({ is_manual_macros: false, target_kcal: 2392 });
  });

  it('brings back the hand set numbers after switching automatic off again', async () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000, target_protein: 150, target_fat: 60, target_carbs: 215 };
    const first = openTargets();
    fireEvent.click(first.getByRole('switch', { name: 'Licz automatycznie' }));
    await act(async () => {
      fireEvent.click(first.getByRole('button', { name: 'Zapisz' }));
    });
    expect(localStorage.getItem('mp_manual_targets')).toBe(JSON.stringify({ kcal: 2000, protein: 150, fat: 60, carbs: 215 }));
    cleanup();

    mocks.profile = { ...baseProfile };
    const second = openTargets();
    fireEvent.click(second.getByRole('switch', { name: 'Licz automatycznie' }));
    expect((second.getByLabelText('Twój cel kaloryczny') as HTMLInputElement).value).toBe('2000');
    expect((second.getByLabelText('Białko (g)') as HTMLInputElement).value).toBe('150');

    localStorage.removeItem('mp_manual_targets');
    await act(async () => {
      fireEvent.click(second.getByRole('button', { name: 'Zapisz' }));
    });
    expect(lastSaved()).toMatchObject({ is_manual_macros: true, target_kcal: 2000, target_protein: 150 });
    expect(JSON.parse(localStorage.getItem('mp_manual_targets') ?? '{}')).toEqual({ kcal: 2000, protein: 150, fat: 60, carbs: 215 });
  });

  it('ignores remembered numbers that cannot be read', () => {
    localStorage.setItem('mp_manual_targets', '{broken');
    const targets = openTargets();
    fireEvent.click(targets.getByRole('switch', { name: 'Licz automatycznie' }));
    expect((targets.getByLabelText('Twój cel kaloryczny') as HTMLInputElement).value).toBe('2392');
    cleanup();

    localStorage.setItem('mp_manual_targets', JSON.stringify({ kcal: 'x' }));
    const again = openTargets();
    fireEvent.click(again.getByRole('switch', { name: 'Licz automatycznie' }));
    expect((again.getByLabelText('Twój cel kaloryczny') as HTMLInputElement).value).toBe('2392');
  });

  it('explains the goal step by step and opens the right settings', () => {
    const targets = openTargets();
    fireEvent.click(targets.getAllByRole('button', { name: 'Skąd 2392 kcal?' })[0]);
    const breakdown = page('Skąd 2392 kcal?');

    expect(breakdown.getByText('1808')).toBeTruthy();
    expect(breakdown.getByText('+1084')).toBeTruthy();
    expect(breakdown.getByText('2892 kcal')).toBeTruthy();
    expect(breakdown.getByText('−500')).toBeTruthy();
    expect(breakdown.getByText(/chudnąć 0,5 kg na tydzień/)).toBeTruthy();
    expect(breakdown.getByText('Na co dzielimy 2392 kcal')).toBeTruthy();
    expect(breakdown.getByText('172 g')).toBeTruthy();
    expect(breakdown.getByText(/2,2 g na każdy kg wagi/)).toBeTruthy();
    expect(breakdown.getByText(/0,9 g na kg wagi/)).toBeTruthy();

    fireEvent.click(breakdown.getByRole('button', { name: /Zmień aktywność/ }));
    expect(screen.queryByRole('region', { name: 'Skąd 2392 kcal?' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Aktywność' })).toBeTruthy();
  });

  it('explains a building goal and a kept weight', () => {
    mocks.profile = { ...baseProfile, target_weight: 82 };
    const building = openTargets();
    fireEvent.click(building.getAllByRole('button', { name: /Skąd/ })[0]);
    expect(screen.getByText(/przybierać 0,5 kg na tydzień/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Zmień cel i tempo/ }));
    expect(page('Cel i tempo').getByText(/przybywa więcej tłuszczu/)).toBeTruthy();
    cleanup();

    mocks.profile = { ...baseProfile, target_weight: 78 };
    const keeping = openTargets();
    fireEvent.click(keeping.getAllByRole('button', { name: /Skąd/ })[0]);
    expect(screen.getByText(/nic nie dodajemy ani nie odejmujemy/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Zmień dane/ }));
    expect(screen.getByRole('region', { name: 'Profil' })).toBeTruthy();
  });

  it('compares a hand set goal with maintenance in the explanation', () => {
    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2000, target_protein: 150, target_fat: 60, target_carbs: 215 };
    const targets = openTargets();
    fireEvent.click(targets.getByRole('button', { name: 'Skąd 2000 kcal?' }));
    const breakdown = page('Skąd 2000 kcal?');

    expect(breakdown.getByText(/Twój cel jest ustawiony ręcznie/)).toBeTruthy();
    expect(breakdown.getByText('Twój ręczny cel')).toBeTruthy();
    expect(breakdown.getByText('−892')).toBeTruthy();
    expect(breakdown.getByText(/chudniesz około 0,9 kg na tydzień/)).toBeTruthy();
    expect(breakdown.getByText('150 g')).toBeTruthy();
    expect(breakdown.queryByText('Tempo')).toBeNull();
    fireEvent.click(breakdown.getByRole('button', { name: /Zmień dzienny cel/ }));
    expect(screen.getByRole('region', { name: 'Dzienny cel' })).toBeTruthy();
    cleanup();

    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 3092 };
    fireEvent.click(openTargets().getByRole('button', { name: 'Skąd 3092 kcal?' }));
    expect(screen.getByText(/przybierasz około 0,2 kg na tydzień/)).toBeTruthy();
    cleanup();

    mocks.profile = { ...baseProfile, is_manual_macros: true, target_kcal: 2892 };
    fireEvent.click(openTargets().getByRole('button', { name: 'Skąd 2892 kcal?' }));
    expect(screen.getByText(/Jesz tyle, ile spalasz/)).toBeTruthy();
  });
});

describe('Profile more settings', () => {
  it('offers Polish for the app and the product database', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Więcej ustawień' }));
    const settings = page('Więcej ustawień');

    const appLanguage = settings.getByLabelText('Aplikacja') as HTMLSelectElement;
    expect(appLanguage.value).toBe('pl');
    expect(Array.from(appLanguage.options).map(option => option.textContent)).toEqual(['Polski']);
    fireEvent.change(appLanguage, { target: { value: 'pl' } });
    expect(localStorage.getItem('mp_language')).toBe('pl');
    const productLanguage = settings.getByLabelText('Baza produktów') as HTMLSelectElement;
    fireEvent.change(productLanguage, { target: { value: 'pl' } });
    expect(productLanguage.value).toBe('pl');
    expect(settings.getByText(/tylko polski/)).toBeTruthy();
    expect(settings.getByText('Product data attribution')).toBeTruthy();
    localStorage.removeItem('mp_language');
  });
});

describe('Profile meals', () => {
  it('shows the default Polish meal names when the profile has no saved meal settings', () => {
    mocks.profile = { ...baseProfile, visible_meals: ['breakfast', 'snack1'] };
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Posiłki/ }));

    expect(screen.getAllByRole('listitem').map(item => item.getAttribute('data-name'))).toEqual([
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
      visible_meals: 'not json',
    });
    renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Posiłki/ }));

    expect((await screen.findAllByRole('listitem')).map(item => item.getAttribute('data-name'))).toEqual(['Owoce']);
  });

  it('renames, hides and saves meals', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Posiłki/ }));
    const meals = page('Posiłki');

    fireEvent.click(meals.getByRole('button', { name: 'Zmień nazwę: Obiad' }));
    const input = meals.getByRole('textbox', { name: 'Zmień nazwę: Obiad' });
    fireEvent.change(input, { target: { value: 'Lunch' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    fireEvent.click(meals.getByRole('switch', { name: 'Pokaż w planie: Kolacja' }));
    fireEvent.click(meals.getByRole('button', { name: 'Zmień nazwę: Śniadanie' }));
    fireEvent.change(meals.getByRole('textbox', { name: 'Zmień nazwę: Śniadanie' }), { target: { value: 'Rano' } });

    await act(async () => {
      fireEvent.click(meals.getByRole('button', { name: 'Zapisz' }));
    });

    const saved = lastSaved() as { meal_config: { name: string; visible: boolean }[]; visible_meals: string[] };
    expect(saved.meal_config.map(meal => meal.name)).toEqual(['Rano', 'II śniadanie', 'Lunch', 'Przekąska', 'Podwieczorek', 'Kolacja']);
    expect(saved.visible_meals).not.toContain('supper');
    expect(screen.getByRole('button', { name: /Posiłki/ }).textContent).toContain('5 z 6');
  });

  it('switches to reordering and back', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Posiłki/ }));
    const meals = page('Posiłki');

    fireEvent.click(meals.getByRole('button', { name: 'Zmień kolejność' }));
    expect(meals.getByText('Przeciągnij posiłek za uchwyt.')).toBeTruthy();
    expect((meals.getByRole('switch', { name: 'Pokaż w planie: Obiad' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(meals.getByRole('button', { name: 'Gotowe' }));
    expect(meals.getByRole('button', { name: 'Zmień kolejność' })).toBeTruthy();
  });

  it('keeps the meals page open when saving fails', async () => {
    mocks.saveProfile.mockRejectedValueOnce(new Error('offline'));
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Posiłki/ }));

    await act(async () => {
      fireEvent.click(page('Posiłki').getByRole('button', { name: 'Zapisz' }));
    });

    expect(screen.getByRole('region', { name: 'Posiłki' })).toBeTruthy();
  });
});

describe('Profile appearance', () => {
  it('changes the theme and shows it on the overview', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /Wygląd/ }));
    fireEvent.click(page('Wygląd').getByRole('radio', { name: /Jasny/ }));
    fireEvent.click(page('Wygląd').getByRole('button', { name: 'Wróć' }));

    expect(screen.getByRole('button', { name: /Wygląd/ }).textContent).toContain('Jasny');
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });
});

describe('Profile logout', () => {
  it('asks before logging out and logs out after confirming', () => {
    renderProfile();

    fireEvent.click(screen.getByRole('button', { name: /Wyloguj się/ }));
    const sheet = within(screen.getByRole('alertdialog', { name: 'Wylogować się? ola@example.com' }));
    expect(sheet.getByText('Przepisy i plan zostaną na koncie.')).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.auth.logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Wyloguj się/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Wyloguj' }));

    expect(api.auth.logout).toHaveBeenCalledOnce();
  });
});
