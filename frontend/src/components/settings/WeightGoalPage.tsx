import { useState } from 'react';
import { t } from '../../i18n';
import { PACE_MAX, PACE_MIN, manualPace, weightGoal } from '../../lib/calorieTarget';
import { ManualGoalNotice } from './ManualGoalNotice';
import { NumberStepper } from './NumberStepper';
import { GoalEtaSummary, PaceChoice, PaceHint } from './WeightGoal';
import { PrimaryButton, SettingsGroup, SettingsPage, SettingsSectionLabel } from './SettingsUi';
import { formatWeight } from './settingsFormat';
import type { SettingsProfile } from './settingsProfile';

type WeightGoalPageProps = {
  profile: SettingsProfile;
  depth: number;
  onBack: () => void;
  onSave: (patch: Partial<SettingsProfile>) => Promise<boolean>;
  onOpenTargets: () => void;
};

function roundPace(pace: number): number {
  return Math.min(PACE_MAX, Math.max(PACE_MIN, Math.round(pace * 10) / 10));
}

export function WeightGoalPage({ profile, depth, onBack, onSave, onOpenTargets }: WeightGoalPageProps) {
  const [draft, setDraft] = useState(() => ({ ...profile, change_speed: roundPace(profile.change_speed) }));
  const update = (patch: Partial<SettingsProfile>) => setDraft(current => ({ ...current, ...patch }));
  const goal = weightGoal(draft.weight, draft.target_weight);
  const manual = profile.is_manual_macros;
  const etaPace = manual ? manualPace(draft, profile.target_kcal) : draft.change_speed;

  const save = async () => {
    const saved = await onSave({ target_weight: draft.target_weight, change_speed: draft.change_speed });
    if (saved) onBack();
  };

  return (
    <SettingsPage
      title={t('settings.goalPace')}
      onBack={onBack}
      depth={depth}
      footer={<PrimaryButton onClick={save}>{t('settings.save')}</PrimaryButton>}
    >
      <p className="mt-1 mb-4 px-1 text-[15px] leading-relaxed text-on-surface-variant">
        {t('settings.goalPace.lead', { weight: formatWeight(draft.weight) })}
      </p>
      <SettingsGroup>
        <div className="min-h-[66px] flex items-center justify-between gap-3">
          <span className="text-base font-medium text-on-surface">{t('settings.weight.target')}</span>
          <NumberStepper label={t('settings.weight.target')} value={draft.target_weight} onChange={target_weight => update({ target_weight })} min={30} max={300} step={0.5} decimals={1} unit={t('settings.unit.kg')} accent />
        </div>
      </SettingsGroup>
      <p className="mt-2 px-1 text-[13px] text-on-surface-variant">{t('settings.weight.typeHint')}</p>

      {goal === 'maintain' ? (
        <p className="mt-5 px-1 text-sm leading-relaxed text-on-surface-variant">{t('settings.weight.maintainHint')}</p>
      ) : (
        <>
          <SettingsSectionLabel>{t('settings.weight.pace')}</SettingsSectionLabel>
          {manual && (
            <ManualGoalNotice
              className="mb-2"
              title={t('settings.weight.paceLocked')}
              text={t('settings.weight.paceLockedWhy', { kcal: profile.target_kcal })}
              action={t('settings.manual.openTargets')}
              onAction={onOpenTargets}
            />
          )}
          <SettingsGroup>
            <div>
              <PaceChoice value={manual ? Math.round(etaPace * 10) / 10 : draft.change_speed} onChange={change_speed => update({ change_speed })} disabled={manual} />
              {!manual && <PaceHint goal={goal} />}
            </div>
          </SettingsGroup>
          <GoalEtaSummary weight={draft.weight} targetWeight={draft.target_weight} pace={etaPace} />
        </>
      )}
    </SettingsPage>
  );
}
