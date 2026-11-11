import { useState } from 'react';
import { getLanguage, setLanguage, t, type Language } from '../../i18n';
import { ProductDataAttribution } from '../ProductDataAttribution';
import { ChoiceList } from './ChoiceList';
import { SelectRow } from './SelectRow';
import { SettingsGroup, SettingsPage, SettingsSectionLabel } from './SettingsUi';
import { readHeightUnit, storeHeightUnit, type HeightUnit } from './settingsFormat';

const AVAILABLE_LANGUAGES: { value: Language; label: string }[] = [{ value: 'pl', label: 'Polski' }];

type AppSettingsPageProps = {
  depth: number;
  onBack: () => void;
};

export function AppSettingsPage({ depth, onBack }: AppSettingsPageProps) {
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(readHeightUnit);
  const [language, setChosenLanguage] = useState<Language>(getLanguage);
  const [productLanguage, setProductLanguage] = useState<Language>('pl');

  return (
    <SettingsPage title={t('settings.app')} onBack={onBack} depth={depth}>
      <SettingsSectionLabel>{t('settings.units.height')}</SettingsSectionLabel>
      <ChoiceList
        label={t('settings.units.height')}
        value={heightUnit}
        options={[
          { value: 'cm', label: t('settings.units.cm') },
          { value: 'ft', label: t('settings.units.ft') },
        ]}
        onChange={unit => {
          storeHeightUnit(unit);
          setHeightUnit(unit);
        }}
      />

      <SettingsSectionLabel>{t('settings.app.languages')}</SettingsSectionLabel>
      <SettingsGroup>
        <SelectRow
          label={t('settings.app.language')}
          value={language}
          options={AVAILABLE_LANGUAGES}
          onChange={next => {
            setLanguage(next);
            setChosenLanguage(next);
          }}
        />
        <SelectRow label={t('settings.app.productLanguage')} value={productLanguage} options={AVAILABLE_LANGUAGES} onChange={setProductLanguage} />
      </SettingsGroup>
      <p className="mt-2 px-1 text-[13px] leading-relaxed text-on-surface-variant">{t('settings.app.productLanguageHint')}</p>
      <div className="mt-10">
        <ProductDataAttribution />
      </div>
    </SettingsPage>
  );
}
