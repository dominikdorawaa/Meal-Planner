import { Fragment, useId, useState } from 'react';
import { t } from '../i18n';
import {
  EXTRA_NUTRIENTS,
  NUTRITION_FACT_LABELS,
  formatNutritionFact,
  type NutritionFact,
  type NutritionFactValues,
} from '../lib/nutrients';
import type { NutritionFactsColumn } from './NutritionFactsTable';

const MAIN_FACTS: readonly NutritionFact[] = ['kcal', 'fat', 'carbs', 'protein'];

interface ProductNutritionTableProps {
  title: string;
  unit: string;
  per100: NutritionFactValues;
  columns: NutritionFactsColumn[];
}

function ValueCell({ fact, value }: { fact: NutritionFact; value: number | null | undefined }) {
  const formatted = formatNutritionFact(fact, value);
  return (
    <td className={`py-2.5 pl-2 text-right whitespace-nowrap ${formatted ? 'font-bold text-on-surface' : 'text-on-surface-variant/60'}`}>
      {formatted ?? t('nutrients.noData')}
    </td>
  );
}

export function ProductNutritionTable({ title, unit, per100, columns }: ProductNutritionTableProps) {
  const [showExtras, setShowExtras] = useState(false);
  const extrasId = useId();
  const someMissing = [...MAIN_FACTS, ...EXTRA_NUTRIENTS].some(fact => per100[fact] == null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <th scope="col" className="sr-only">{t('nutrients.name')}</th>
            {columns.map(column => (
              <th key={column.label} scope="col" className="py-2 pl-2 text-right font-black align-bottom">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MAIN_FACTS.map(fact => (
            <Fragment key={fact}>
              <tr className="border-t border-outline-variant/10">
                <th scope="row" className="py-2.5 text-left font-bold text-on-surface">
                  {fact === 'carbs' ? (
                    <button
                      type="button"
                      aria-expanded={showExtras}
                      aria-controls={extrasId}
                      aria-label={showExtras ? t('nutrients.showLess') : t('nutrients.showMore', { unit })}
                      onClick={() => setShowExtras(open => !open)}
                      className="flex items-center gap-1 font-bold text-on-surface active:scale-95 transition-transform"
                    >
                      {t(NUTRITION_FACT_LABELS[fact])}
                      <span aria-hidden="true" className={`material-symbols-outlined text-[18px] text-primary transition-transform ${showExtras ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                  ) : t(NUTRITION_FACT_LABELS[fact])}
                </th>
                {columns.map(column => <ValueCell key={column.label} fact={fact} value={column.values[fact]} />)}
              </tr>
              {fact === 'carbs' && showExtras && (
                <tr id={extrasId}>
                  <td colSpan={columns.length + 1} className="pb-2">
                    <div className="rounded-xl bg-surface-container-low px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('nutrients.per100', { unit })}</p>
                    <dl>
                      {EXTRA_NUTRIENTS.map(nutrient => {
                        const formatted = formatNutritionFact(nutrient, per100[nutrient]);
                        return (
                          <div key={nutrient} className="flex justify-between gap-2 py-1.5 text-[13px]">
                            <dt className="font-medium text-on-surface-variant">{t(NUTRITION_FACT_LABELS[nutrient])}</dt>
                            <dd className={formatted ? 'font-bold text-on-surface' : 'text-on-surface-variant/60'}>
                              {formatted ?? t('nutrients.noData')}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {someMissing && <p className="text-[11px] font-medium text-on-surface-variant/60">{t('nutrients.someMissing')}</p>}
    </section>
  );
}
