import { useState } from 'react';
import { t } from '../../i18n';
import { activityLevelKcal } from '../../lib/calorieTarget';
import { ActivityChoice } from './ActivityChoice';
import { ManualGoalNotice } from './ManualGoalNotice';
import { PrimaryButton, SettingsPage } from './SettingsUi';
import type { SettingsProfile } from './settingsProfile';

type ActivityPageProps = {
  profile: SettingsProfile;
  depth: number;
  onBack: () => void;
  onSave: (patch: Partial<SettingsProfile>) => Promise<boolean>;
  onOpenTargets: () => void;
};

export function ActivityPage({ profile, depth, onBack, onSave, onOpenTargets }: ActivityPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [day, setDay] = useState(profile.lifestyle_activity);
  const [training, setTraining] = useState(profile.exercise_activity);
  const kcalPerLevel = activityLevelKcal(profile, 0.1);
  const manual = profile.is_manual_macros;

  const save = async () => {
    const saved = await onSave({ lifestyle_activity: day, exercise_activity: training });
    if (saved) onBack();
  };

  const question = step === 1 ? t('settings.activity.dayQuestion') : t('settings.activity.trainingQuestion');

  return (
    <SettingsPage
      title={t('settings.activity')}
      onBack={step === 2 ? () => setStep(1) : onBack}
      depth={depth}
      footer={
        step === 1 ? (
          <PrimaryButton onClick={() => setStep(2)} icon="arrow_forward">{t('settings.activity.next')}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={save}>{t('settings.save')}</PrimaryButton>
        )
      }
    >
      {manual && (
        <ManualGoalNotice
          className="mt-1 mb-4"
          title={t('settings.activity.locked')}
          text={t('settings.activity.lockedWhy', { kcal: profile.target_kcal })}
          action={t('settings.manual.openTargets')}
          onAction={onOpenTargets}
        />
      )}
      <p className="mt-1 px-1 text-[13.5px] font-semibold text-primary">{t('settings.activity.step', { step })}</p>
      <h3 className="mt-2 px-1 font-headline font-extrabold tracking-tight text-2xl leading-tight text-on-surface text-balance">{question}</h3>
      <p className="mt-2.5 px-1 text-[15px] leading-relaxed text-on-surface-variant">
        {step === 1 ? t('settings.activity.dayWhy', { kcal: kcalPerLevel }) : t('settings.activity.trainingWhy', { kcal: kcalPerLevel })}
      </p>
      <div className="mt-5">
        {step === 1 ? (
          <ActivityChoice kind="day" label={question} value={day} onChange={setDay} kcalPerLevel={kcalPerLevel} showKcal={!manual} />
        ) : (
          <ActivityChoice kind="training" label={question} value={training} onChange={setTraining} kcalPerLevel={kcalPerLevel} showKcal={!manual} />
        )}
      </div>
    </SettingsPage>
  );
}
