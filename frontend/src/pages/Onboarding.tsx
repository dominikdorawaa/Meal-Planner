import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { t, type MessageKey } from '../i18n';
import { PACE_MAX, PACE_MIN, activityLevelKcal, calorieTarget, goalEta, type WeightGoal } from '../lib/calorieTarget';
import { NumberStepper } from '../components/settings/NumberStepper';
import { ActivityChoice } from '../components/settings/ActivityChoice';
import { PaceChoice, PaceHint } from '../components/settings/WeightGoal';
import { CalorieBreakdown } from '../components/settings/CalorieBreakdown';
import { DailyTargetsPage } from '../components/settings/DailyTargetsPage';
import { PrimaryButton, SettingsGroup, SettingsPage } from '../components/settings/SettingsUi';
import { formatLongDate, formatWeight } from '../components/settings/settingsFormat';
import { readManualTargets, toSettingsProfile, withCalculatedTargets, type SettingsProfile } from '../components/settings/settingsProfile';
import { macroFillClass, type MacroKey } from '../lib/macroColors';

type Step = 'goal' | 'body' | 'target' | 'day' | 'training' | 'result';

type Draft = {
  step: Step;
  goal: WeightGoal;
  profile: SettingsProfile;
  targetTouched: boolean;
};

const DRAFT_KEY = 'mp_onboarding_draft';
const HEALTHY_BMI = 18.5;
const SUGGESTED_CHANGE = 0.05;

const GOALS: { value: WeightGoal; icon: string; title: MessageKey; hint: MessageKey }[] = [
  { value: 'reduce', icon: 'trending_down', title: 'onboarding.goal.reduce', hint: 'onboarding.goal.reduceHint' },
  { value: 'maintain', icon: 'balance', title: 'onboarding.goal.maintain', hint: 'onboarding.goal.maintainHint' },
  { value: 'build', icon: 'trending_up', title: 'onboarding.goal.build', hint: 'onboarding.goal.buildHint' },
];

const MACROS: { key: MacroKey; label: MessageKey }[] = [
  { key: 'protein', label: 'plan.summary.protein' },
  { key: 'fat', label: 'plan.summary.fat' },
  { key: 'carbs', label: 'plan.summary.carbs' },
];

function stepsFor(goal: WeightGoal): Step[] {
  return goal === 'maintain' ? ['goal', 'body', 'day', 'training', 'result'] : ['goal', 'body', 'target', 'day', 'training', 'result'];
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function suggestedTarget(goal: WeightGoal, weight: number): number {
  if (goal === 'reduce') return roundHalf(weight * (1 - SUGGESTED_CHANGE));
  if (goal === 'build') return roundHalf(weight * (1 + SUGGESTED_CHANGE));
  return weight;
}

function healthyMinimum(height: number): number {
  return Math.ceil(HEALTHY_BMI * (height / 100) ** 2);
}

function initialDraft(): Draft {
  const fallback: Draft = { step: 'goal', goal: 'reduce', profile: { ...toSettingsProfile({ weight: 70 }), is_manual_macros: false }, targetTouched: false };
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null;
    if (!stored || !stored.step || !stored.goal || !stored.profile) return fallback;
    return { step: stored.step, goal: stored.goal, profile: toSettingsProfile(stored.profile as unknown as Record<string, unknown>), targetTouched: stored.targetTouched === true };
  } catch {
    return fallback;
  }
}

function hasStoredDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

function storeDraft(draft: Draft | null): void {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

function manualStart(profile: SettingsProfile): Partial<SettingsProfile> {
  const remembered = readManualTargets();
  if (!remembered) return {};
  return { target_kcal: remembered.kcal, target_protein: remembered.protein, target_fat: remembered.fat, target_carbs: remembered.carbs, weight: profile.weight };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-h-[66px] flex items-center justify-between gap-3">
      <span className="text-base font-medium text-on-surface">{label}</span>
      {children}
    </div>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const { refreshProfile } = useAppData();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [overlay, setOverlay] = useState<'manual' | 'breakdown' | null>(null);
  const [loading, setLoading] = useState(false);
  const { step, goal, profile, targetTouched } = draft;

  useEffect(() => {
    if (hasStoredDraft() || !api.auth.getUser()) return;
    let active = true;
    api.profile
      .get()
      .catch(() => null)
      .then(record => {
        if (!active || !record) return;
        const loaded = { ...toSettingsProfile(record as Record<string, unknown>), is_manual_macros: false };
        const loadedGoal = calorieTarget(loaded).goal;
        setDraft(current => ({ ...current, goal: loadedGoal, profile: loaded, targetTouched: loadedGoal !== 'maintain' }));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    storeDraft(draft);
  }, [draft]);

  const steps = stepsFor(goal);
  const questionSteps = steps.length - 1;
  const position = steps.indexOf(step) + 1;
  const update = (patch: Partial<SettingsProfile>) => setDraft(current => ({ ...current, profile: { ...current.profile, ...patch } }));
  const goTo = (next: Step) => setDraft(current => ({ ...current, step: next }));
  const final = withCalculatedTargets({ ...profile, target_weight: goal === 'maintain' ? profile.weight : profile.target_weight, is_manual_macros: false });
  const target = calorieTarget(final);
  const eta = goal === 'maintain' ? null : goalEta(final.weight, final.target_weight, final.change_speed);
  const kcalPerLevel = activityLevelKcal(profile, 0.1);

  const next = () => {
    const following = steps[steps.indexOf(step) + 1];
    const wrongSide = goal === 'reduce' ? profile.target_weight >= profile.weight : profile.target_weight <= profile.weight;
    if (step === 'body' && goal !== 'maintain' && (!targetTouched || wrongSide)) {
      setDraft(current => ({ ...current, step: following, profile: { ...current.profile, target_weight: suggestedTarget(goal, current.profile.weight) } }));
      return;
    }
    goTo(following);
  };

  const back = () => goTo(steps[Math.max(0, steps.indexOf(step) - 1)]);

  const chooseGoal = (value: WeightGoal) => setDraft(current => ({ ...current, goal: value, targetTouched: value === current.goal ? current.targetTouched : false }));

  const save = async (data: SettingsProfile) => {
    const user = api.auth.getUser();
    if (!user) {
      alert(t('api.sessionExpired'));
      navigate('/login');
      return false;
    }
    setLoading(true);
    const result = await Promise.resolve(api.profile.update({ id: user.userId, ...data })).catch((error: unknown) => ({ error }));
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      console.error('Profile save failed:', result.error);
      alert(t('onboarding.profileSaveFailed'));
      setLoading(false);
      return false;
    }
    await refreshProfile();
    storeDraft(null);
    setLoading(false);
    navigate('/');
    return true;
  };

  const saveManual = async (patch: Partial<SettingsProfile>) => save({ ...final, ...patch });

  const goalStep = (
    <>
      <div role="radiogroup" aria-label={t('onboarding.goal.question')} className="mt-6 flex flex-col gap-2">
        {GOALS.map(option => {
          const selected = goal === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseGoal(option.value)}
              className={`w-full text-left flex items-center gap-3.5 rounded-2xl p-4 border-[1.5px] transition-colors ${selected ? 'border-primary bg-primary/[0.07]' : 'border-transparent bg-surface-container-lowest'}`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[28px] ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>{option.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-semibold text-on-surface">{t(option.title)}</span>
                <span className="block mt-0.5 text-[13.5px] text-on-surface-variant">{t(option.hint)}</span>
              </span>
              <span aria-hidden="true" className={`w-5 h-5 shrink-0 rounded-full border-2 ${selected ? 'border-primary bg-primary shadow-[inset_0_0_0_3px_rgb(var(--color-surface-container-lowest))]' : 'border-on-surface-variant/40'}`}></span>
            </button>
          );
        })}
      </div>
    </>
  );

  const bodyStep = (
    <>
      <div role="radiogroup" aria-label={t('settings.profile.sex')} className="mt-6 grid grid-cols-2 gap-2.5">
        {(['female', 'male'] as const).map(sex => {
          const selected = profile.gender === sex;
          return (
            <button
              key={sex}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ gender: sex })}
              className={`h-[84px] rounded-[22px] border-[1.5px] flex items-center justify-center gap-2 text-base font-semibold transition-colors ${selected ? 'border-primary bg-primary/[0.08] text-primary' : 'border-transparent bg-surface-container-lowest text-on-surface'}`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[28px]">{sex}</span>
              {sex === 'male' ? t('settings.profile.male') : t('settings.profile.female')}
            </button>
          );
        })}
      </div>
      <SettingsGroup className="mt-2.5">
        <Row label={t('settings.profile.age')}>
          <NumberStepper label={t('settings.profile.age')} value={profile.age} onChange={age => update({ age })} min={14} max={100} step={1} unit={t('settings.unit.years')} />
        </Row>
        <Row label={t('settings.profile.height')}>
          <NumberStepper label={t('settings.profile.height')} value={profile.height} onChange={height => update({ height })} min={100} max={250} step={1} unit={t('settings.unit.cm')} />
        </Row>
        <Row label={t('onboarding.body.weight')}>
          <NumberStepper label={t('onboarding.body.weight')} value={profile.weight} onChange={weight => update({ weight })} min={30} max={300} step={0.5} decimals={1} unit={t('settings.unit.kg')} />
        </Row>
      </SettingsGroup>
      <p className="mt-2 px-1 text-[13px] text-on-surface-variant">{t('settings.weight.typeHint')}</p>
    </>
  );

  const tooLow = goal === 'reduce' && profile.target_weight < healthyMinimum(profile.height);
  const targetStep = (
    <>
      <SettingsGroup className="mt-6">
        <Row label={t('settings.weight.target')}>
          <NumberStepper
            label={t('settings.weight.target')}
            value={profile.target_weight}
            onChange={target_weight => setDraft(current => ({ ...current, targetTouched: true, profile: { ...current.profile, target_weight } }))}
            min={goal === 'build' ? profile.weight + 0.5 : 30}
            max={goal === 'reduce' ? profile.weight - 0.5 : 300}
            step={0.5}
            decimals={1}
            unit={t('settings.unit.kg')}
            accent
          />
        </Row>
        <div>
          <PaceChoice value={profile.change_speed} onChange={change_speed => update({ change_speed: Math.min(PACE_MAX, Math.max(PACE_MIN, change_speed)) })} />
          <PaceHint goal={goal} />
        </div>
      </SettingsGroup>
      {tooLow && (
        <div role="note" className="mt-2.5 rounded-[18px] border-[1.5px] border-error/30 bg-error/[0.06] p-3.5 flex gap-3">
          <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-error">info</span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-on-surface">{t('onboarding.target.lowTitle')}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">
              {t('onboarding.target.lowText', { height: profile.height, weight: healthyMinimum(profile.height) })}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const result = (
    <>
      <section aria-label={t('onboarding.result.goal')} className="mt-5 rounded-[24px] bg-primary/[0.08] px-4 py-5">
        <p className="text-center text-[13.5px] font-semibold text-on-surface-variant">{t('onboarding.result.goal')}</p>
        <p className="mt-1.5 text-center font-headline font-extrabold tracking-tight text-[48px] leading-none text-primary tabular-nums">
          {target.kcal}
          <span className="ml-1.5 font-body text-base font-semibold tracking-normal text-on-surface-variant">kcal</span>
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-2.5">
          {MACROS.map(macro => (
            <div key={macro.key}>
              <span aria-hidden="true" className={`block h-[5px] rounded-full ${macroFillClass[macro.key]}`}></span>
              <dt className="mt-1.5 text-[13px] text-on-surface-variant">{t(macro.label)}</dt>
              <dd className="text-[14.5px] font-bold text-on-surface tabular-nums">
                {t('settings.targets.range', { min: target[`${macro.key}Min`], max: target[`${macro.key}Max`] })}
              </dd>
            </div>
          ))}
        </dl>
        {eta && (
          <p className="mt-4 pt-3.5 border-t border-primary/15 flex items-start gap-2 text-[14px] leading-snug text-on-surface-variant">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">event</span>
            <span>
              {t('onboarding.result.etaBefore')}
              <b className="font-semibold text-on-surface">{formatLongDate(eta.date)}</b>
              {t('onboarding.result.etaAfter', { weeks: eta.weeks, change: `${goal === 'reduce' ? '−' : '+'}${formatWeight(eta.kilograms)}` })}
            </span>
          </p>
        )}
      </section>
      <button type="button" onClick={() => setOverlay('breakdown')} className="mt-3 -ml-1 px-1 py-1 inline-flex items-center gap-0.5 text-[15px] font-semibold text-primary rounded-lg">
        {t('settings.targets.why', { kcal: target.kcal })}
        <span aria-hidden="true" className="material-symbols-outlined text-lg">chevron_right</span>
      </button>
      <section className="mt-4 rounded-[22px] bg-surface-container-low px-4 py-4">
        <h2 className="text-[15px] font-semibold text-on-surface">{t('onboarding.result.nextTitle')}</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {(['onboarding.result.next1', 'onboarding.result.next2', 'onboarding.result.next3'] as const).map((key, index) => (
            <li key={key} className="flex items-center gap-2.5 text-[14.5px] text-on-surface-variant">
              <span aria-hidden="true" className="w-[26px] h-[26px] shrink-0 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center text-[13px] font-bold">{index + 1}</span>
              {t(key)}
            </li>
          ))}
        </ol>
      </section>
    </>
  );

  const content: Record<Step, { question: string; why: string; body: ReactNode }> = {
    goal: { question: t('onboarding.goal.question'), why: t('onboarding.goal.why'), body: goalStep },
    body: { question: t('onboarding.body.question'), why: t('onboarding.body.why'), body: bodyStep },
    target: {
      question: t(goal === 'build' ? 'onboarding.target.questionBuild' : 'onboarding.target.questionReduce'),
      why: t(goal === 'build' ? 'onboarding.target.whyBuild' : 'onboarding.target.whyReduce', { weight: formatWeight(profile.weight) }),
      body: targetStep,
    },
    day: { question: t('settings.activity.dayQuestion'), why: t('onboarding.day.why'), body: <div className="mt-6"><ActivityChoice kind="day" label={t('settings.activity.dayQuestion')} value={profile.lifestyle_activity} onChange={lifestyle_activity => update({ lifestyle_activity })} kcalPerLevel={kcalPerLevel} /></div> },
    training: { question: t('settings.activity.trainingQuestion'), why: t('onboarding.training.why'), body: <div className="mt-6"><ActivityChoice kind="training" label={t('settings.activity.trainingQuestion')} value={profile.exercise_activity} onChange={exercise_activity => update({ exercise_activity })} kcalPerLevel={kcalPerLevel} /></div> },
    result: { question: t('onboarding.result.title'), why: t('onboarding.result.why'), body: result },
  };
  const current = content[step];

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen">
      <header className="pt-safe">
        <div className="h-16 max-w-xl mx-auto px-3 flex items-center gap-2">
          {step === 'goal' ? (
            <span className="w-11 h-11 shrink-0"></span>
          ) : (
            <button type="button" onClick={back} disabled={loading} aria-label={t('settings.back')} className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container disabled:opacity-50">
              <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          {step !== 'result' && (
            <div role="progressbar" aria-label={t('onboarding.progress', { step: position, total: questionSteps })} aria-valuemin={1} aria-valuemax={questionSteps} aria-valuenow={position} className="flex-1 flex gap-1 pr-11">
              {Array.from({ length: questionSteps }, (_, index) => (
                <span key={index} className={`flex-1 h-1.5 rounded-full transition-colors ${index < position ? 'bg-primary' : 'bg-surface-container-highest'}`}></span>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
        <p className="mt-3 px-1 text-[13.5px] font-semibold text-primary">
          {step === 'result' ? t('onboarding.result.done') : t('onboarding.progress', { step: position, total: questionSteps })}
        </p>
        <h1 className="mt-2 px-1 font-headline font-extrabold tracking-tight text-[28px] leading-tight text-on-surface text-balance">{current.question}</h1>
        <p className="mt-2.5 px-1 text-[15px] leading-relaxed text-on-surface-variant">{current.why}</p>
        {current.body}
      </main>

      <footer className="fixed inset-x-0 bottom-0 bg-surface/95 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
          {step === 'goal' && (
            <button type="button" onClick={() => setOverlay('manual')} className="self-center py-2 text-[15px] font-semibold text-primary">
              {t('onboarding.manual')}
            </button>
          )}
          <div className="flex">
          {step === 'result' ? (
            <PrimaryButton onClick={() => void save(final)} disabled={loading} icon="arrow_forward">
              {loading ? t('onboarding.saving') : t('onboarding.result.start')}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={next} icon="arrow_forward">
              {step === 'training' ? t('onboarding.showGoal') : t('onboarding.next')}
            </PrimaryButton>
          )}
          </div>
        </div>
      </footer>

      {overlay === 'breakdown' && (
        <SettingsPage title={t('settings.targets.why', { kcal: target.kcal })} onBack={() => setOverlay(null)}>
          <CalorieBreakdown
            target={target}
            pace={final.change_speed}
            weight={final.weight}
            manualTarget={null}
            onEditData={() => {
              setOverlay(null);
              goTo('body');
            }}
            onEditActivity={() => {
              setOverlay(null);
              goTo('day');
            }}
            onEditGoal={() => {
              setOverlay(null);
              goTo(goal === 'maintain' ? 'goal' : 'target');
            }}
            onEditTargets={() => setOverlay(null)}
          />
        </SettingsPage>
      )}
      {overlay === 'manual' && (
        <DailyTargetsPage
          profile={{ ...final, ...manualStart(final), is_manual_macros: true }}
          depth={0}
          onBack={() => setOverlay(null)}
          onSave={saveManual}
          manualOnly={{ lead: t('onboarding.manualLead'), saveLabel: t('onboarding.manualSave') }}
        />
      )}
    </div>
  );
}
