import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { BottomNav } from '../components/BottomNav';
import { InstallAppCard } from '../components/InstallAppCard';
import { ThemeCard } from '../components/ThemeCard';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { SettingsGroup, SettingsPage, SettingsRow } from '../components/settings/SettingsUi';
import { AppSettingsPage } from '../components/settings/AppSettingsPage';
import { WeightGoalCard } from '../components/settings/WeightGoal';
import { DailyGoalCard } from '../components/settings/DailyGoalCard';
import { ProfileDetailsPage } from '../components/settings/ProfileDetailsPage';
import { WeightGoalPage } from '../components/settings/WeightGoalPage';
import { BodyWeightPage } from '../components/settings/BodyWeightPage';
import { ActivityPage } from '../components/settings/ActivityPage';
import { DailyTargetsPage } from '../components/settings/DailyTargetsPage';
import { MealsPage } from '../components/settings/MealsPage';
import { CalorieBreakdown } from '../components/settings/CalorieBreakdown';
import { activityLabel, formatWeight } from '../components/settings/settingsFormat';
import { toSettingsProfile, withCalculatedTargets, type SettingsProfile } from '../components/settings/settingsProfile';
import { t, type MessageKey } from '../i18n';
import { calorieTarget, manualPace } from '../lib/calorieTarget';
import type { MealSetting } from '../lib/mealSettings';
import { mealColor, profileMealTypes } from '../lib/mealTypes';
import { getThemePreference } from '../lib/theme';

type Page = 'profile' | 'weight' | 'goal' | 'activity' | 'targets' | 'breakdown' | 'meals' | 'appearance' | 'app';

const THEME_LABEL: Record<string, MessageKey> = {
  dark: 'theme.dark',
  light: 'theme.light',
  system: 'theme.system',
};

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mealsFrom(data: Record<string, unknown>): MealSetting[] {
  return profileMealTypes({ meal_config: parseJson(data.meal_config), visible_meals: parseJson(data.visible_meals) });
}

export function Profile() {
  const navigate = useNavigate();
  const { user, profile: cachedProfile, onLogout, saveProfile } = useAppData();
  const [savedProfile, setSavedProfile] = useState<SettingsProfile | null>(null);
  const [savedMeals, setSavedMeals] = useState<MealSetting[] | null>(null);
  const [fetched, setFetched] = useState<Record<string, unknown> | null>(null);
  const [stack, setStack] = useState<Page[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [themeLabel, setThemeLabel] = useState(() => t(THEME_LABEL[getThemePreference()]));
  const toastTimer = useRef<number | undefined>(undefined);
  const source = cachedProfile ?? fetched;

  useEffect(() => {
    if (cachedProfile || !api.auth.getUser()) return;
    let active = true;
    api.profile.get().catch(() => null).then(data => {
      if (active && data) setFetched(data);
    });
    return () => {
      active = false;
    };
  }, [cachedProfile]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const accountName = user?.name?.trim() || '';
  const current = savedProfile ?? toSettingsProfile(source);
  const meals = savedMeals ?? (source ? mealsFrom(source) : []);
  const target = calorieTarget(current);
  const open = (page: Page) => setStack(pages => [...pages, page]);
  const close = () => setStack(pages => pages.slice(0, -1));
  const replaceTop = (page: Page) => setStack(pages => [...pages.slice(0, -1), page]);

  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  };

  const save = async (patch: Partial<SettingsProfile>) => {
    if (!api.auth.getUser()) return false;
    const next = withCalculatedTargets({ ...current, ...patch });
    const result = await Promise.resolve(saveProfile({ ...next })).catch((error: unknown) => ({ error }));
    if (result && typeof result === 'object' && 'error' in result && result.error) return false;
    setSavedProfile(next);
    const change = next.target_kcal - current.target_kcal;
    showToast(change !== 0 ? t('settings.savedKcal', { kcal: next.target_kcal, change: change > 0 ? `+${change}` : `−${-change}` }) : t('settings.saved'));
    return true;
  };

  const saveMeals = async (nextMeals: MealSetting[]) => {
    if (!api.auth.getUser()) return false;
    const result = await Promise.resolve(saveProfile({ meal_config: nextMeals, visible_meals: nextMeals.filter(meal => meal.visible).map(meal => meal.id) })).catch(
      (error: unknown) => ({ error })
    );
    if (result && typeof result === 'object' && 'error' in result && result.error) return false;
    setSavedMeals(nextMeals);
    showToast(t('settings.saved'));
    return true;
  };

  const confirmLogout = () => {
    api.auth.logout();
    onLogout?.();
    navigate('/login');
  };

  const visibleMeals = meals.filter(meal => meal.visible).length;

  const renderPage = (page: Page, depth: number) => {
    const pageProps = { profile: current, depth, onBack: close, onSave: save };
    switch (page) {
      case 'profile':
        return <ProfileDetailsPage key={page} {...pageProps} accountName={accountName} />;
      case 'weight':
        return <BodyWeightPage key={page} {...pageProps} />;
      case 'goal':
        return <WeightGoalPage key={page} {...pageProps} onOpenTargets={() => replaceTop('targets')} />;
      case 'activity':
        return <ActivityPage key={page} {...pageProps} onOpenTargets={() => replaceTop('targets')} />;
      case 'targets':
        return <DailyTargetsPage key={page} {...pageProps} onExplain={() => open('breakdown')} />;
      case 'breakdown':
        return (
          <SettingsPage key={page} title={t('settings.targets.why', { kcal: current.is_manual_macros ? current.target_kcal : target.kcal })} onBack={close} depth={depth}>
            <CalorieBreakdown
              target={target}
              pace={current.change_speed}
              weight={current.weight}
              manualTarget={current.is_manual_macros ? { kcal: current.target_kcal, protein: current.target_protein, fat: current.target_fat, carbs: current.target_carbs } : null}
              onEditTargets={() => (stack[stack.length - 2] === 'targets' ? close() : replaceTop('targets'))}
              onEditData={() => replaceTop('profile')}
              onEditActivity={() => replaceTop('activity')}
              onEditGoal={() => replaceTop('goal')}
            />
          </SettingsPage>
        );
      case 'meals':
        return <MealsPage key={page} meals={meals} depth={depth} onBack={close} onSave={saveMeals} />;
      case 'app':
        return <AppSettingsPage key={page} depth={depth} onBack={close} />;
      case 'appearance':
        return (
          <SettingsPage
            key={page}
            title={t('settings.appearance')}
            onBack={() => {
              setThemeLabel(t(THEME_LABEL[getThemePreference()]));
              close();
            }}
            depth={depth}
          >
            <div className="mt-2">
              <ThemeCard />
            </div>

          </SettingsPage>
        );
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-bottom-nav">
      <main className="pt-[calc(1rem+env(safe-area-inset-top))] max-w-xl mx-auto px-4">
        <h1 className="px-1 pb-3 font-headline font-extrabold text-xl tracking-tight text-on-surface">{t('settings.title')}</h1>

        <div className="flex flex-col gap-2">
          <WeightGoalCard weight={current.weight} targetWeight={current.target_weight} pace={current.is_manual_macros ? manualPace(current, current.target_kcal) : current.change_speed} onOpen={() => open('goal')} />
          <DailyGoalCard kcal={current.target_kcal} protein={current.target_protein} fat={current.target_fat} carbs={current.target_carbs} onOpen={() => open('targets')} />
        </div>

        <SettingsGroup className="mt-3">
          <SettingsRow
            icon="monitor_weight"
            label={t('settings.bodyWeight')}
            value={t('settings.bodyWeight.value', { weight: formatWeight(current.weight) })}
            onClick={() => open('weight')}
          />
          <SettingsRow
            icon="directions_run"
            label={t('settings.activity')}
            value={activityLabel('day', current.lifestyle_activity)}
            onClick={() => open('activity')}
          />
          <SettingsRow
            icon="person"
            label={t('settings.profile')}
            value={current.display_name.trim() || accountName || t('settings.profile.ageValue', { age: current.age })}
            onClick={() => open('profile')}
          />
          <SettingsRow
            icon="restaurant"
            label={t('settings.meals')}
            value={
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="inline-flex gap-1">
                  {meals.map((meal, index) => (
                    <span
                      key={meal.id}
                      className={`w-2 h-2 rounded-full ${meal.visible ? '' : 'border-[1.5px] border-dashed border-on-surface-variant/50'}`}
                      style={meal.visible ? { backgroundColor: mealColor(index) } : undefined}
                    ></span>
                  ))}
                </span>
                {t('settings.mealsVisible', { visible: visibleMeals, total: meals.length })}
              </span>
            }
            onClick={() => open('meals')}
          />
        </SettingsGroup>

        <SettingsGroup className="mt-3">
          <SettingsRow icon="dark_mode" label={t('settings.appearance')} value={themeLabel} onClick={() => open('appearance')} />
          <SettingsRow icon="tune" label={t('settings.app')} onClick={() => open('app')} />
          <InstallAppCard />
          <SettingsRow icon="logout" label={t('settings.logout')} onClick={() => setShowLogoutConfirm(true)} danger />
        </SettingsGroup>
      </main>
      <BottomNav />

      {stack.map((page, index) => renderPage(page, index))}

      <div
        role="status"
        aria-live="polite"
        className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[300] transition-[opacity,transform] duration-300 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
      >
        {toast && (
          <div className="flex items-center gap-2 rounded-full bg-surface-container-highest pl-3 pr-4 h-11 shadow-ambient text-[15px] font-semibold text-on-surface whitespace-nowrap">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">check_circle</span>
            {toast}
          </div>
        )}
      </div>

      {showLogoutConfirm && (
        <ConfirmSheet
          question={t('profile.logoutQuestion')}
          title={user?.email || accountName || t('profile.logoutQuestion')}
          description={t('profile.logoutText')}
          confirmLabel={t('profile.logoutConfirm')}
          tone="neutral"
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}
