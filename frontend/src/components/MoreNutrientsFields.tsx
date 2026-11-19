import { useId, useState } from 'react';
import { t } from '../i18n';
import { EXTRA_NUTRIENTS, NUTRITION_FACT_LABELS, type ExtraNutrient } from '../lib/nutrients';
import { NUTRITION_DECIMALS, NUTRITION_LIMITS } from '../lib/inputLimits';
import { UnitInput } from './FormFields';

export type ExtraNutrientInputs = Record<ExtraNutrient, string>;

interface MoreNutrientsFieldsProps {
  values: ExtraNutrientInputs;
  onChange: (nutrient: ExtraNutrient, value: string) => void;
  limited?: boolean;
}

export function MoreNutrientsFields({ values, onChange, limited = true }: MoreNutrientsFieldsProps) {
  const [open, setOpen] = useState(() => EXTRA_NUTRIENTS.some(nutrient => values[nutrient].trim() !== ''));
  const panelId = useId();

  return (
    <div className="bg-surface-container rounded-[20px]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(previous => !previous)}
        className="flex items-center justify-between gap-3 w-full h-[52px] px-4 text-left text-[15px] font-medium text-on-surface rounded-[20px] outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span>{t('nutrients.more')}</span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div id={panelId} className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 pb-4">
          {EXTRA_NUTRIENTS.map(nutrient => (
            <div key={nutrient} className="flex flex-col min-w-0">
              <label htmlFor={`${panelId}-${nutrient}`} className="mb-1.5 px-1 text-[13px] font-semibold leading-tight text-on-surface-variant">
                {t(NUTRITION_FACT_LABELS[nutrient])}
              </label>
              <UnitInput
                id={`${panelId}-${nutrient}`}
                unit="g"
                tone="raised"
                value={values[nutrient]}
                max={limited ? NUTRITION_LIMITS[nutrient] : Number.MAX_SAFE_INTEGER}
                decimals={NUTRITION_DECIMALS}
                placeholder="0"
                onValueChange={value => onChange(nutrient, value)}
                size="compact"
                className="mt-auto"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
