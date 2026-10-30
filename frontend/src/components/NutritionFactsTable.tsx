import { Fragment } from 'react';
import { t } from '../i18n';
import {
  NUTRITION_FACT_PARENTS,
  NUTRITION_FACT_LABELS,
  NUTRITION_FACTS,
  formatNutritionFact,
  type NutritionFact,
  type NutritionFactValues,
} from '../lib/nutrients';

export interface NutritionFactsColumn {
  label: string;
  values: NutritionFactValues;
}

interface NutritionFactsTableProps {
  title?: string;
  columns: NutritionFactsColumn[];
  facts?: readonly NutritionFact[];
  notes?: Partial<Record<NutritionFact, string>>;
}

export function NutritionFactsTable({ title, columns, facts = NUTRITION_FACTS, notes = {} }: NutritionFactsTableProps) {
  return (
    <section className="flex flex-col gap-3">
      {title && <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">{title}</h2>}
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
          {facts.map(fact => {
            const parent = NUTRITION_FACT_PARENTS[fact];
            const nested = parent !== undefined && facts.includes(parent);
            const note = notes[fact];
            return (
              <Fragment key={fact}>
                <tr className="border-t border-outline-variant/10">
                  <th
                    scope="row"
                    className={`py-2.5 text-left ${nested ? 'pl-4 font-medium text-on-surface-variant' : 'font-bold text-on-surface'}`}
                  >
                    {t(NUTRITION_FACT_LABELS[fact])}
                  </th>
                  {columns.map(column => {
                    const value = formatNutritionFact(fact, column.values[fact]);
                    return (
                      <td
                        key={column.label}
                        className={`py-2.5 pl-2 text-right whitespace-nowrap ${value ? 'font-bold text-on-surface' : 'text-on-surface-variant/60'}`}
                      >
                        {value ?? t('nutrients.missing')}
                      </td>
                    );
                  })}
                </tr>
                {note && (
                  <tr>
                    <td colSpan={columns.length + 1} className="pb-2.5 text-right text-[11px] font-medium text-on-surface-variant">
                      {note}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
