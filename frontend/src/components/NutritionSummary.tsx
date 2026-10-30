import { useId, useState, type ReactNode } from 'react';
import { t, type MessageKey } from '../i18n';
import { formatCompactNumber } from '../lib/compactNumber';
import { KCAL_HERO_SIZES, RING_VALUE_SIZES, fitTextClass } from '../lib/fitText';
import { macroRingBackground, type MacroKey } from '../lib/macroColors';
import { macroEnergyPercents, type MacroGrams, type MacroValues } from '../lib/macros';
import { NUTRITION_TABLE_FACTS, type NutritionFact } from '../lib/nutrients';
import { NutritionFactsTable, type NutritionFactsColumn } from './NutritionFactsTable';

interface NutritionSummaryProps {
  title: string;
  values: MacroValues;
  macroSplit: MacroGrams;
  tableColumns: NutritionFactsColumn[];
  tableNotes?: Partial<Record<NutritionFact, string>>;
  notice?: ReactNode;
}

const MACRO_LABELS: Record<MacroKey, MessageKey> = {
  protein: 'nutrients.summary.protein',
  fat: 'nutrients.summary.fat',
  carbs: 'nutrients.summary.carbs',
};

const CIRCLE_SIZE = 'w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]';
const CAPTION_CLASS = 'text-[11px] font-black text-on-surface uppercase tracking-widest leading-none';

function gramsLabel(value: number): string {
  return `${formatCompactNumber(value, 1)}g`;
}

function MacroRing({ macro, grams, percent }: { macro: MacroKey; grams: number; percent: number }) {
  const label = gramsLabel(grams);
  return (
    <span className="flex flex-col items-center gap-3">
      <span className={`relative block ${CIRCLE_SIZE}`}>
        <span data-testid={`${macro}-ring`} className="absolute inset-0 rounded-full" style={{ background: macroRingBackground(macro, percent) }} />
        <span className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
          <span data-testid={`${macro}-value`} className={`font-black ${fitTextClass(label, RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{label}</span>
        </span>
      </span>
      <span className={CAPTION_CLASS}>{t(MACRO_LABELS[macro])}</span>
    </span>
  );
}

export function NutritionSummary({ title, values, macroSplit, tableColumns, tableNotes, notice }: NutritionSummaryProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const percents = macroEnergyPercents(macroSplit);
  const kcal = formatCompactNumber(values.kcal);

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">{title}</h2>
      {notice}

      <div className="flex items-center justify-between gap-1 sm:gap-4 px-2">
        <div className="flex flex-col items-center gap-3">
          <div className={`${CIRCLE_SIZE} flex items-center justify-center`}>
            <span data-testid="kcal-value" className={`font-black ${fitTextClass(kcal, KCAL_HERO_SIZES, 3)} text-on-surface leading-none text-center max-w-full break-words`}>{kcal}</span>
          </div>
          <span className={CAPTION_CLASS}>{t('nutrients.summary.kcal')}</span>
        </div>

        <MacroRing macro="protein" grams={values.protein} percent={percents.protein} />
        <MacroRing macro="fat" grams={values.fat} percent={percents.fat} />

        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          aria-label={t(showTable ? 'nutrients.hideTable' : 'nutrients.showTable', { value: gramsLabel(values.carbs) })}
          onClick={() => setShowTable(open => !open)}
          className="flex items-start"
        >
          <MacroRing macro="carbs" grams={values.carbs} percent={percents.carbs} />
          <span aria-hidden="true" className={`material-symbols-outlined h-16 min-[360px]:h-[72px] flex items-center -mr-2 text-[28px] text-primary transition-transform ${showTable ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
      </div>

      {showTable && (
        <div id={tableId}>
          <NutritionFactsTable columns={tableColumns} facts={NUTRITION_TABLE_FACTS} notes={tableNotes} />
        </div>
      )}
    </section>
  );
}
