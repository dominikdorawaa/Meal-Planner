import { useId, useState } from 'react';
import { t } from '../i18n';
import { EXTRA_NUTRIENTS, NUTRITION_FACT_LABELS, type ExtraNutrient } from '../lib/nutrients';

export type ExtraNutrientInputs = Record<ExtraNutrient, string>;

interface MoreNutrientsFieldsProps {
  values: ExtraNutrientInputs;
  onChange: (nutrient: ExtraNutrient, value: string) => void;
}

export function MoreNutrientsFields({ values, onChange }: MoreNutrientsFieldsProps) {
  const [open, setOpen] = useState(() => EXTRA_NUTRIENTS.some(nutrient => values[nutrient].trim() !== ''));
  const panelId = useId();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(previous => !previous)}
        className="flex items-center justify-between w-full rounded-2xl bg-surface-container-low px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest active:scale-[0.98] transition-transform"
      >
        <span>{t('nutrients.more')}</span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div id={panelId} className="grid grid-cols-2 gap-3">
          {EXTRA_NUTRIENTS.map(nutrient => (
            <div key={nutrient} className="flex flex-col gap-1.5">
              <label htmlFor={`${panelId}-${nutrient}`} className="text-xs font-bold text-on-surface-variant pl-1 leading-tight">
                {t(NUTRITION_FACT_LABELS[nutrient])}
              </label>
              <div className="mt-auto relative flex items-center rounded-xl overflow-hidden bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/30">
                <input
                  id={`${panelId}-${nutrient}`}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  onKeyDown={event => ['e', 'E', '+', '-'].includes(event.key) && event.preventDefault()}
                  value={values[nutrient]}
                  onChange={event => onChange(nutrient, event.target.value)}
                  className="flex-1 w-full bg-transparent py-3 pl-3 pr-8 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-3 text-[10px] font-black text-on-surface-variant/50 uppercase">g</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
