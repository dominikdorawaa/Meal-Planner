import { useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { calorieTarget, macroRanges } from '../../lib/calorieTarget';
import { PROFILE_LIMITS, acceptsLimitedNumber, isPositiveWithinLimit, numberFieldProps } from '../../lib/inputLimits';
import { macroFillClass, type MacroKey } from '../../lib/macroColors';
import { PrimaryButton, SettingsGroup, SettingsPage, SettingsSectionLabel } from './SettingsUi';
import { formatDecimal } from './settingsFormat';
import { manualRange, readManualTargets, storeManualTargets, type SettingsProfile } from './settingsProfile';

type DailyTargetsPageProps = {
  profile: SettingsProfile;
  depth: number;
  onBack: () => void;
  onSave: (patch: Partial<SettingsProfile>) => Promise<boolean>;
  onExplain?: () => void;
  manualOnly?: { lead: string; saveLabel: string };
};

type ManualDraft = { kcal: string; protein: string; fat: string; carbs: string };

const MACROS: { key: MacroKey; label: MessageKey; kcalPerGram: number }[] = [
  { key: 'protein', label: 'plan.summary.protein', kcalPerGram: 4 },
  { key: 'fat', label: 'plan.summary.fat', kcalPerGram: 9 },
  { key: 'carbs', label: 'plan.summary.carbs', kcalPerGram: 4 },
];

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function share(grams: number, kcalPerGram: number, kcal: number): number {
  return kcal > 0 ? Math.round(((grams * kcalPerGram) / kcal) * 100) : 0;
}

export function DailyTargetsPage({ profile, depth, onBack, onSave, onExplain, manualOnly }: DailyTargetsPageProps) {
  const [manual, setManual] = useState(profile.is_manual_macros);
  const [draft, setDraft] = useState<ManualDraft>({
    kcal: String(profile.target_kcal),
    protein: String(profile.target_protein),
    fat: String(profile.target_fat),
    carbs: String(profile.target_carbs),
  });
  const auto = calorieTarget(profile);
  const kcal = manual ? toNumber(draft.kcal) : auto.kcal;
  const grams: Record<MacroKey, number> = manual
    ? { protein: toNumber(draft.protein), fat: toNumber(draft.fat), carbs: toNumber(draft.carbs) }
    : { protein: auto.protein, fat: auto.fat, carbs: auto.carbs };
  const shares = MACROS.map(macro => share(grams[macro.key], macro.kcalPerGram, kcal));
  const totalShare = shares.reduce((sum, value) => sum + value, 0);
  const manualInvalid = manual && (totalShare !== 100 || !isPositiveWithinLimit(draft.kcal, PROFILE_LIMITS.targetKcal));

  const switchMode = () => {
    if (manual) {
      setManual(false);
      return;
    }
    const remembered = readManualTargets() ?? auto;
    setDraft({ kcal: String(remembered.kcal), protein: String(remembered.protein), fat: String(remembered.fat), carbs: String(remembered.carbs) });
    setManual(true);
  };

  const changeGrams = (key: MacroKey, value: string) => {
    const next = { ...draft, [key]: value };
    const total = MACROS.reduce((sum, macro) => sum + toNumber(next[macro.key]) * macro.kcalPerGram, 0);
    setDraft({ ...next, kcal: String(Math.round(total)) });
  };

  const changeShare = (key: MacroKey, kcalPerGram: number, value: string) => {
    const gramsForShare = Math.round((toNumber(draft.kcal) * toNumber(value)) / 100 / kcalPerGram);
    setDraft({ ...draft, [key]: String(gramsForShare) });
  };

  const save = async () => {
    const patch: Partial<SettingsProfile> = manual
      ? {
          is_manual_macros: true,
          target_kcal: toNumber(draft.kcal),
          target_protein: grams.protein,
          target_fat: grams.fat,
          target_carbs: grams.carbs,
          target_protein_min: manualRange(grams.protein).min,
          target_protein_max: manualRange(grams.protein).max,
          target_fat_min: manualRange(grams.fat).min,
          target_fat_max: manualRange(grams.fat).max,
          target_carbs_min: manualRange(grams.carbs).min,
          target_carbs_max: manualRange(grams.carbs).max,
        }
      : { is_manual_macros: false };
    const saved = await onSave(patch);
    if (!saved) return;
    if (manual) storeManualTargets({ kcal: toNumber(draft.kcal), ...grams });
    else if (profile.is_manual_macros) storeManualTargets({ kcal: profile.target_kcal, protein: profile.target_protein, fat: profile.target_fat, carbs: profile.target_carbs });
    onBack();
  };

  const fieldClass =
    'w-full h-10 rounded-xl bg-surface-container text-center font-headline font-extrabold text-base tabular-nums text-on-surface outline-none border-[1.5px] border-transparent focus:border-primary caret-primary';

  return (
    <SettingsPage
      title={t('settings.dailyGoal')}
      onBack={onBack}
      depth={depth}
      footer={<PrimaryButton onClick={save} disabled={manualInvalid}>{manualOnly ? manualOnly.saveLabel : t('settings.save')}</PrimaryButton>}
    >
      {manualOnly && <p className="mt-1 mb-3 px-1 text-[15px] leading-relaxed text-on-surface-variant">{manualOnly.lead}</p>}
      <section className="relative mt-2 rounded-[22px] bg-primary/[0.08] px-4 pt-5 pb-5 flex flex-col items-center text-center">
        {onExplain && (
        <button
          type="button"
          onClick={onExplain}
          aria-label={t('settings.targets.why', { kcal: profile.is_manual_macros ? profile.target_kcal : auto.kcal })}
          className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">info</span>
        </button>
        )}
        <label htmlFor="settings-target-kcal" className="text-[13.5px] font-semibold text-on-surface-variant">{t('settings.targets.kcalLabel')}</label>
        <div className="mt-2 flex items-baseline justify-center gap-1.5">
          {manual ? (
            <input
              id="settings-target-kcal"
              {...numberFieldProps(PROFILE_LIMITS.targetKcal, 0)}
              value={draft.kcal}
              onChange={event => acceptsLimitedNumber(event.target.value, PROFILE_LIMITS.targetKcal, 0) && setDraft({ ...draft, kcal: event.target.value })}
              className="w-36 text-center bg-transparent font-headline font-extrabold tracking-tight text-[40px] leading-none text-primary tabular-nums outline-none caret-primary border-b-2 border-primary/30 focus:border-primary"
            />
          ) : (
            <output id="settings-target-kcal" className="font-headline font-extrabold tracking-tight text-[40px] leading-none text-primary tabular-nums">{auto.kcal}</output>
          )}
          <span className="text-[15px] font-semibold text-on-surface-variant">kcal</span>
        </div>
      </section>

      {!manualOnly && (
        <SettingsGroup className="mt-2">
          <div className="min-h-[64px] flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-on-surface">{t('settings.targets.auto')}</p>
              <p className="mt-0.5 text-[13px] text-on-surface-variant">{t('settings.targets.autoHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!manual}
              aria-label={t('settings.targets.auto')}
              onClick={switchMode}
              className={`w-[52px] h-8 shrink-0 rounded-full p-1 transition-colors ${manual ? 'bg-surface-container-highest' : 'bg-primary'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform ${manual ? '' : 'translate-x-5'}`}></span>
            </button>
          </div>
        </SettingsGroup>
      )}

      <SettingsSectionLabel>{t('settings.targets.macros')}</SettingsSectionLabel>
      <SettingsGroup>
        {MACROS.map((macro, index) => {
          const label = t(macro.label);
          const min = auto[`${macro.key}Min` as const];
          const max = auto[`${macro.key}Max` as const];
          return (
            <div key={macro.key} className="py-3.5 flex items-center gap-3">
              <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full shrink-0 ${macroFillClass[macro.key]}`}></span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-on-surface">{label}</p>
                {!manualOnly && (
                <p className="mt-0.5 text-[13px] text-on-surface-variant tabular-nums">
                  {manual
                    ? t('settings.targets.gramsPerKg', { value: formatDecimal(grams[macro.key] / (profile.weight || 1), 1) })
                    : t('settings.targets.gramsPerKgRange', { min: formatDecimal(macroRanges(auto.goal)[macro.key][0], 1), max: formatDecimal(macroRanges(auto.goal)[macro.key][1], 1) })}
                </p>
                )}
              </div>
              {manual ? (
                <div className="flex items-center gap-1.5">
                  <label className="w-[68px] flex flex-col items-center gap-0.5">
                    <input
                      {...numberFieldProps(PROFILE_LIMITS.macroGrams, 0)}
                      aria-label={t('settings.targets.grams', { macro: label })}
                      value={draft[macro.key]}
                      onChange={event => acceptsLimitedNumber(event.target.value, PROFILE_LIMITS.macroGrams, 0) && changeGrams(macro.key, event.target.value)}
                      className={fieldClass}
                    />
                    <span className="text-xs text-on-surface-variant">g</span>
                  </label>
                  <label className="w-[58px] flex flex-col items-center gap-0.5">
                    <input
                      {...numberFieldProps(PROFILE_LIMITS.macroPercent, 0)}
                      aria-label={t('settings.targets.percent', { macro: label })}
                      value={shares[index]}
                      onChange={event => acceptsLimitedNumber(event.target.value, PROFILE_LIMITS.macroPercent, 0) && changeShare(macro.key, macro.kcalPerGram, event.target.value)}
                      className={fieldClass}
                    />
                    <span className="text-xs text-on-surface-variant">%</span>
                  </label>
                </div>
              ) : (
                <div className="text-right tabular-nums">
                  <p className="font-headline font-extrabold text-base text-on-surface">{t('settings.targets.range', { min, max })}</p>
                  <p className="mt-0.5 text-[13px] text-on-surface-variant">
                    {t('settings.targets.share', { min: share(min, macro.kcalPerGram, auto.kcal), max: share(max, macro.kcalPerGram, auto.kcal) })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </SettingsGroup>

      {manual && (
        <div className={`mt-2 rounded-2xl px-4 py-3 flex items-center justify-between text-[15px] ${totalShare === 100 ? 'bg-surface-container-low text-on-surface-variant' : 'bg-error/10 text-error'}`}>
          <span>{totalShare === 100 ? t('settings.targets.sum') : t('settings.targets.sumInvalid')}</span>
          <b className="font-headline font-extrabold text-base tabular-nums">{totalShare}%</b>
        </div>
      )}
    </SettingsPage>
  );
}
