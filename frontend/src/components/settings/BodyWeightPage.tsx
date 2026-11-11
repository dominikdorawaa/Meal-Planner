import { useState } from 'react';
import { t } from '../../i18n';
import { NumberStepper } from './NumberStepper';
import { PrimaryButton, SettingsGroup, SettingsPage } from './SettingsUi';
import type { SettingsProfile } from './settingsProfile';

type BodyWeightPageProps = {
  profile: SettingsProfile;
  depth: number;
  onBack: () => void;
  onSave: (patch: Partial<SettingsProfile>) => Promise<boolean>;
};

export function BodyWeightPage({ profile, depth, onBack, onSave }: BodyWeightPageProps) {
  const [weight, setWeight] = useState(profile.weight);

  const save = async () => {
    const saved = await onSave({ weight });
    if (saved) onBack();
  };

  return (
    <SettingsPage
      title={t('settings.bodyWeight')}
      onBack={onBack}
      depth={depth}
      footer={<PrimaryButton onClick={save}>{t('settings.save')}</PrimaryButton>}
    >
      <p className="mt-1 mb-4 px-1 text-[15px] leading-relaxed text-on-surface-variant">{t('settings.bodyWeight.lead')}</p>
      <SettingsGroup>
        <div className="min-h-[66px] flex items-center justify-between gap-3">
          <span className="text-base font-medium text-on-surface">{t('settings.weight.current')}</span>
          <NumberStepper label={t('settings.weight.current')} value={weight} onChange={setWeight} min={30} max={300} step={0.5} decimals={1} unit={t('settings.unit.kg')} />
        </div>
      </SettingsGroup>
      <p className="mt-2 px-1 text-[13px] text-on-surface-variant">{t('settings.weight.typeHint')}</p>
    </SettingsPage>
  );
}
