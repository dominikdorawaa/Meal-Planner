import { useId, useState, type ReactNode } from 'react';
import { t, type MessageKey } from '../i18n';
import { formatCompactNumber } from '../lib/compactNumber';
import { KCAL_HERO_SIZES, RING_VALUE_SIZES, fitTextClass } from '../lib/fitText';
import { macroRingBackground, type MacroKey } from '../lib/macroColors';
import { macroEnergyPercents, type MacroGrams, type MacroValues } from '../lib/macros';
import { NUTRITION_TABLE_FACTS, type NutritionFact } from '../lib/nutrients';
import { NutritionFactsTable, type NutritionFactsColumn } from './NutritionFactsTable';

export type NutritionToggle = 'rings' | 'header';

interface NutritionSummaryProps {
  title: string;
  subtitle?: string;
  values: MacroValues;
  macroSplit: MacroGrams;
  tableColumns: NutritionFactsColumn[];
  tableNotes?: Partial<Record<NutritionFact, string>>;
  notice?: ReactNode;
  toggle?: NutritionToggle;
}

const MACRO_LABELS: Record<MacroKey, MessageKey> = {
  protein: 'nutrients.summary.protein',
  fat: 'nutrients.summary.fat',
  carbs: 'nutrients.summary.carbs',
};

const MACRO_TEXT: Record<MacroKey, string> = {
  protein: 'text-macro-protein',
  fat: 'text-macro-fat',
  carbs: 'text-macro-carbs',
};

const CIRCLE_SIZE = 'w-16 h-16 min-[360px]:w-[68px] min-[360px]:h-[68px]';
const CAPTION_CLASS = 'text-[13px] font-bold leading-none';

function gramsLabel(value: number): string {
  return `${formatCompactNumber(value, 1)}g`;
}

function MacroRing({ macro, grams, percent }: { macro: MacroKey; grams: number; percent: number }) {
  const label = gramsLabel(grams);
  return (
    <span className="flex flex-col items-center gap-2.5">
      <span className={`relative block ${CIRCLE_SIZE}`}>
        <span data-testid={`${macro}-ring`} className="absolute inset-0 rounded-full" style={{ background: macroRingBackground(macro, percent) }} />
        <span className="absolute inset-[7px] bg-surface rounded-full flex items-center justify-center">
          <span data-testid={`${macro}-value`} className={`font-headline font-extrabold tabular-nums ${fitTextClass(label, RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{label}</span>
        </span>
      </span>
      <span className={`${CAPTION_CLASS} ${MACRO_TEXT[macro]}`}>{t(MACRO_LABELS[macro])}</span>
    </span>
  );
}

export function NutritionSummary({ title, subtitle, values, macroSplit, tableColumns, tableNotes, notice, toggle = 'rings' }: NutritionSummaryProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const percents = macroEnergyPercents(macroSplit);
  const kcal = formatCompactNumber(values.kcal);

  const toggleButton = (
    <button
      type="button"
      aria-expanded={showTable}
      aria-controls={tableId}
      aria-label={t(showTable ? 'nutrients.hideTable' : 'nutrients.showTable')}
      onClick={() => setShowTable(open => !open)}
      className={`shrink-0 flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform ${toggle === 'header' ? 'w-8 h-8 rounded-full bg-surface-container-high' : 'w-8 h-16 min-[360px]:h-[68px] -mr-1'}`}
    >
      <span aria-hidden="true" className={`material-symbols-outlined transition-transform ${toggle === 'header' ? 'text-[20px]' : 'text-[28px]'} ${showTable ? 'rotate-180' : ''}`}>expand_more</span>
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="font-headline font-extrabold text-lg tracking-tight text-on-surface flex-1 min-w-0">{title}</h2>
        {subtitle && <span className="text-[13px] text-on-surface-variant whitespace-nowrap">{subtitle}</span>}
        {toggle === 'header' && toggleButton}
      </div>
      {notice}

      <div className="flex items-start justify-between gap-1">
        <div className="flex flex-col items-center gap-2.5">
          <div className={`${CIRCLE_SIZE} flex items-center justify-center`}>
            <span data-testid="kcal-value" className={`font-headline font-extrabold tabular-nums text-primary ${fitTextClass(kcal, KCAL_HERO_SIZES, 3)} leading-none text-center max-w-full break-words`}>{kcal}</span>
          </div>
          <span className={`${CAPTION_CLASS} text-primary`}>{t('nutrients.summary.kcal')}</span>
        </div>

        <MacroRing macro="protein" grams={values.protein} percent={percents.protein} />
        <MacroRing macro="fat" grams={values.fat} percent={percents.fat} />
        <MacroRing macro="carbs" grams={values.carbs} percent={percents.carbs} />
        {toggle === 'rings' && toggleButton}
      </div>

      {showTable && (
        <div id={tableId} className="rounded-2xl bg-surface-container-lowest px-4 py-1">
          <NutritionFactsTable columns={tableColumns} facts={NUTRITION_TABLE_FACTS} notes={tableNotes} />
        </div>
      )}
    </section>
  );
}
