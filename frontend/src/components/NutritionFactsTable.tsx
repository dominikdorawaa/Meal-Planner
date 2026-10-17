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
  title: string;
  columns: NutritionFactsColumn[];
  facts?: readonly NutritionFact[];
}

export function NutritionFactsTable({ title, columns, facts = NUTRITION_FACTS }: NutritionFactsTableProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <th scope="col" className="sr-only">{t('nutrients.name')}</th>
            {columns.map(column => (
              <th key={column.label} scope="col" className="py-2 pl-2 text-right font-black whitespace-nowrap">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {facts.map(fact => {
            const parent = NUTRITION_FACT_PARENTS[fact];
            const nested = parent !== undefined && facts.includes(parent);
            return (
              <tr key={fact} className="border-t border-outline-variant/10">
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
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
