import { useId } from 'react';
import { t } from '../i18n';
import { MEAL_LIMITS } from '../lib/inputLimits';
import { MacroInputs, UnitInput } from './FormFields';
import { FIELD_CLASS, LABEL_CLASS } from '../lib/formFields';

export interface QuickMealForm {
  name: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
}

interface QuickMealFieldsProps {
  form: QuickMealForm;
  onChange: (form: QuickMealForm) => void;
}

export function QuickMealFields({ form, onChange }: QuickMealFieldsProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3.5 pt-1 pb-1">
      <div>
        <label htmlFor={`${id}-name`} className={LABEL_CLASS}>{t('quickAdd.name')}</label>
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="off"
          value={form.name}
          onChange={event => onChange({ ...form, name: event.target.value })}
          placeholder={t('quickAdd.namePlaceholder')}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor={`${id}-kcal`} className={LABEL_CLASS}>{t('quickAdd.kcal')}</label>
        <UnitInput
          id={`${id}-kcal`}
          unit="kcal"
          size="large"
          value={form.kcal}
          max={MEAL_LIMITS.kcal}
          decimals={0}
          placeholder="0"
          onValueChange={kcal => onChange({ ...form, kcal })}
        />
      </div>
      <MacroInputs
        values={{ protein: form.protein, fat: form.fat, carbs: form.carbs }}
        max={() => MEAL_LIMITS.grams}
        onChange={(macro, value) => onChange({ ...form, [macro]: value })}
      />
    </div>
  );
}
