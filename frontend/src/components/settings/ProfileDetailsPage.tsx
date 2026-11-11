import { useState } from 'react';
import { t } from '../../i18n';
import { NumberStepper } from './NumberStepper';
import { cmToFeetInches, feetInchesToCm, formatHeight, readHeightUnit, type HeightUnit } from './settingsFormat';
import { PrimaryButton, SecondaryButton, SettingsGroup, SettingsPage, SettingsRow } from './SettingsUi';
import type { SettingsProfile } from './settingsProfile';

type ProfileDetailsPageProps = {
  profile: SettingsProfile;
  accountName: string;
  depth: number;
  onBack: () => void;
  onSave: (patch: Partial<SettingsProfile>) => Promise<boolean>;
};

export function ProfileDetailsPage({ profile, accountName, depth, onBack, onSave }: ProfileDetailsPageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [heightUnit] = useState<HeightUnit>(readHeightUnit);
  const { feet, inches } = cmToFeetInches(draft.height);
  const update = (patch: Partial<SettingsProfile>) => setDraft(current => ({ ...current, ...patch }));
  const sexLabel = (sex: string) => (sex === 'male' ? t('settings.profile.male') : t('settings.profile.female'));

  const cancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const save = async () => {
    const saved = await onSave({
      display_name: draft.display_name,
      gender: draft.gender,
      age: draft.age,
      height: draft.height,
    });
    if (saved) setEditing(false);
  };

  const editAction = !editing && (
    <button type="button" onClick={() => setEditing(true)} className="h-10 px-3.5 rounded-full text-base font-semibold text-primary hover:bg-surface-container transition-colors">
      {t('settings.profile.edit')}
    </button>
  );

  const footer = editing && (
    <>
      <SecondaryButton onClick={cancel}>{t('common.cancel')}</SecondaryButton>
      <PrimaryButton onClick={save}>{t('settings.save')}</PrimaryButton>
    </>
  );

  return (
    <SettingsPage title={t('settings.profile')} onBack={editing ? cancel : onBack} action={editAction} footer={footer || undefined} depth={depth}>
      {!editing ? (
        <SettingsGroup className="mt-2">
          <SettingsRow label={t('settings.profile.name')} value={profile.display_name.trim() || accountName || t('settings.profile.noName')} chevron={false} />
          <SettingsRow label={t('settings.profile.sex')} value={sexLabel(profile.gender)} chevron={false} />
          <SettingsRow label={t('settings.profile.age')} value={t('settings.profile.ageValue', { age: profile.age })} chevron={false} />
          <SettingsRow label={t('settings.profile.height')} value={formatHeight(profile.height, heightUnit)} chevron={false} />
        </SettingsGroup>
      ) : (
        <>
          <SettingsGroup className="mt-2 py-3">
            <label className="block">
              <span className="block text-base font-medium text-on-surface">{t('settings.profile.name')}</span>
              <input
                autoComplete="off"
                type="text"
                maxLength={80}
                value={draft.display_name}
                placeholder={accountName || t('settings.profile.namePlaceholder')}
                onChange={event => update({ display_name: event.target.value })}
                className="mt-2 w-full h-11 rounded-[14px] bg-surface-container px-3.5 text-base text-on-surface placeholder:text-on-surface-variant/60 outline-none border-[1.5px] border-transparent focus:border-primary caret-primary"
              />
            </label>
          </SettingsGroup>
          <SettingsGroup className="mt-2">
            <div className="min-h-[64px] flex items-center justify-between gap-3">
              <span className="text-base font-medium text-on-surface">{t('settings.profile.sex')}</span>
              <div role="radiogroup" aria-label={t('settings.profile.sex')} className="flex rounded-full bg-surface-container-high p-1">
                {(['female', 'male'] as const).map(sex => (
                  <button
                    key={sex}
                    type="button"
                    role="radio"
                    aria-checked={draft.gender === sex}
                    onClick={() => update({ gender: sex })}
                    className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors ${draft.gender === sex ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                  >
                    {sexLabel(sex)}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-[66px] flex items-center justify-between gap-3">
              <span className="text-base font-medium text-on-surface">{t('settings.profile.age')}</span>
              <NumberStepper label={t('settings.profile.age')} value={draft.age} onChange={age => update({ age })} min={1} max={100} step={1} unit={t('settings.unit.years')} />
            </div>
            <div className="min-h-[66px] py-2.5 flex items-center justify-between gap-3">
              <span className="text-base font-medium text-on-surface">{t('settings.profile.height')}</span>
              {heightUnit === 'cm' ? (
                <NumberStepper label={t('settings.profile.height')} value={draft.height} onChange={height => update({ height })} min={100} max={250} step={1} decimals={0} unit={t('settings.unit.cm')} />
              ) : (
                <div className="flex flex-col gap-2">
                  <NumberStepper label={t('settings.profile.heightFeet')} value={feet} onChange={next => update({ height: feetInchesToCm(next, inches) })} min={3} max={8} step={1} unit="ft" />
                  <NumberStepper label={t('settings.profile.heightInches')} value={inches} onChange={next => update({ height: feetInchesToCm(feet, next) })} min={0} max={11} step={1} unit="in" />
                </div>
              )}
            </div>
          </SettingsGroup>
        </>
      )}
      <p className="mt-3 px-1 text-[13px] leading-relaxed text-on-surface-variant">{t('settings.profile.why')}</p>
    </SettingsPage>
  );
}
