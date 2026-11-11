import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { KCAL_PER_KG_WEEKLY, type CalorieTarget } from '../../lib/calorieTarget';
import { macroFillClass, type MacroKey } from '../../lib/macroColors';
import { formatDecimal, formatPace } from './settingsFormat';

type CalorieBreakdownProps = {
  target: CalorieTarget;
  pace: number;
  weight: number;
  manualTarget: MacroTarget | null;
  onEditTargets: () => void;
  onEditData: () => void;
  onEditActivity: () => void;
  onEditGoal: () => void;
};

function EditLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1.5 -ml-1 px-1 py-1 inline-flex items-center gap-0.5 text-[13.5px] font-semibold text-primary rounded-lg">
      {children}
      <span aria-hidden="true" className="material-symbols-outlined text-base">chevron_right</span>
    </button>
  );
}

type StepProps = {
  marker: ReactNode;
  markerClass: string;
  title: string;
  value: string;
  valueClass?: string;
  text: string;
  children: ReactNode;
};

function Step({ marker, markerClass, title, value, valueClass = 'text-on-surface', text, children }: StepProps) {
  return (
    <li className="relative pb-5">
      <span aria-hidden="true" className={`absolute -left-11 -top-0.5 w-8 h-8 rounded-[10px] flex items-center justify-center font-headline font-extrabold text-[15px] shadow-[0_0_0_5px_rgb(var(--color-surface))] ${markerClass}`}>{marker}</span>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-on-surface">{title}</h3>
        <span className={`font-headline font-extrabold text-lg tabular-nums ${valueClass}`}>{value}</span>
      </div>
      <p className="mt-1 max-w-[280px] text-sm leading-snug text-on-surface-variant">{text}</p>
      {children}
    </li>
  );
}

const MACROS: { key: MacroKey; kcalPerGram: number }[] = [
  { key: 'protein', kcalPerGram: 4 },
  { key: 'fat', kcalPerGram: 9 },
  { key: 'carbs', kcalPerGram: 4 },
];

const MACRO_LABEL = {
  protein: 'plan.summary.protein',
  fat: 'plan.summary.fat',
  carbs: 'plan.summary.carbs',
} as const;

const MACRO_WHY = {
  protein: 'settings.breakdown.whyProtein',
  fat: 'settings.breakdown.whyFat',
  carbs: 'settings.breakdown.whyCarbs',
} as const;

type MacroTarget = Pick<CalorieTarget, 'kcal' | 'protein' | 'fat' | 'carbs'>;

function MacroSplit({ target, weight }: { target: MacroTarget; weight: number }) {
  const rows = MACROS.map(macro => ({ ...macro, grams: target[macro.key], kcal: target[macro.key] * macro.kcalPerGram }));
  const total = rows.reduce((sum, row) => sum + row.kcal, 0) || 1;

  return (
    <section className="mt-1 rounded-[22px] bg-surface-container-low p-4">
      <h3 className="text-base font-semibold text-on-surface">{t('settings.breakdown.splitTitle', { kcal: target.kcal })}</h3>
      <div aria-hidden="true" className="mt-3 flex h-2.5 gap-1 overflow-hidden rounded-full">
        {rows.map(row => (
          <span key={row.key} className={`rounded-full ${macroFillClass[row.key]}`} style={{ width: `${(row.kcal / total) * 100}%` }}></span>
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-3.5">
        {rows.map(row => (
          <li key={row.key} className="flex gap-3">
            <span aria-hidden="true" className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-full ${macroFillClass[row.key]}`}></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold text-on-surface">{t(MACRO_LABEL[row.key])}</span>
                <span className="text-[15px] tabular-nums text-on-surface">
                  <b className="font-bold">{row.grams} g</b>
                  <span className="ml-1.5 text-sm text-on-surface-variant">{Math.round((row.kcal / total) * 100)}%</span>
                </span>
              </div>
              <p className="mt-0.5 text-[13.5px] leading-snug text-on-surface-variant">
                {t(MACRO_WHY[row.key], { perKg: formatDecimal(weight > 0 ? row.grams / weight : 0, 1) })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Equals({ children, tone }: { children: ReactNode; tone: 'neutral' | 'result' }) {
  return (
    <li className={`relative mb-5 flex items-center justify-between rounded-2xl ${tone === 'result' ? 'bg-primary/10 p-3.5' : 'bg-surface-container-low px-3 py-2.5'}`}>
      <span aria-hidden="true" className={`absolute -left-11 w-8 text-center bg-surface font-headline font-extrabold text-lg ${tone === 'result' ? 'text-primary' : 'text-on-surface-variant'}`}>=</span>
      {children}
    </li>
  );
}

export function CalorieBreakdown({ target, pace, weight, manualTarget, onEditData, onEditActivity, onEditGoal, onEditTargets }: CalorieBreakdownProps) {
  const movement = target.maintenance - target.resting;
  const movementPercent = Math.round((target.activityFactor - 1) * 100);
  const adjustment = Math.abs(target.adjustment);
  const paceText =
    target.goal === 'reduce'
      ? t('settings.breakdown.paceReduce', { pace: formatPace(pace), kcal: adjustment })
      : target.goal === 'build'
        ? t('settings.breakdown.paceBuild', { pace: formatPace(pace), kcal: adjustment })
        : t('settings.breakdown.paceMaintain');

  const manualDifference = manualTarget ? manualTarget.kcal - target.maintenance : 0;
  const manualPacePerWeek = formatDecimal(Math.abs(manualDifference) / KCAL_PER_KG_WEEKLY, 1);
  const manualText =
    manualDifference < 0
      ? t('settings.breakdown.manualLess', { kcal: -manualDifference, pace: manualPacePerWeek })
      : manualDifference > 0
        ? t('settings.breakdown.manualMore', { kcal: manualDifference, pace: manualPacePerWeek })
        : t('settings.breakdown.manualSame');
  const result = manualTarget ?? target;

  return (
    <div>
      <p className="mt-1 px-1 text-[15px] leading-relaxed text-on-surface-variant">{manualTarget ? t('settings.breakdown.manual') : t('settings.breakdown.lead')}</p>
      <ol className="relative mt-5 ml-11 before:absolute before:-left-[29px] before:top-4 before:bottom-8 before:w-0.5 before:bg-surface-container-highest">
        <Step marker="1" markerClass="bg-surface-container-highest text-on-surface" title={t('settings.breakdown.resting')} value={String(target.resting)} text={t('settings.breakdown.restingText')}>
          <EditLink onClick={onEditData}>{t('settings.breakdown.editData')}</EditLink>
        </Step>
        <Step marker="2" markerClass="bg-primary text-on-primary" title={t('settings.breakdown.movement')} value={`+${movement}`} text={t('settings.breakdown.movementText', { percent: movementPercent })}>
          <EditLink onClick={onEditActivity}>{t('settings.breakdown.editActivity')}</EditLink>
        </Step>
        <Equals tone="neutral">
          <span className="text-sm text-on-surface-variant">{t('settings.breakdown.maintenance')}</span>
          <b className="text-sm text-on-surface tabular-nums">{target.maintenance} kcal</b>
        </Equals>
        {manualTarget ? (
          <Step
            marker={<span className="material-symbols-outlined text-[18px]">lock</span>}
            markerClass="bg-surface border-[1.5px] border-dashed border-error text-error"
            title={t('settings.breakdown.manualStep')}
            value={manualDifference < 0 ? `−${-manualDifference}` : manualDifference > 0 ? `+${manualDifference}` : '0'}
            valueClass={manualDifference < 0 ? 'text-error' : 'text-on-surface'}
            text={manualText}
          >
            <EditLink onClick={onEditTargets}>{t('settings.manual.openTargets')}</EditLink>
          </Step>
        ) : (
          <Step
            marker="3"
            markerClass="bg-surface border-[1.5px] border-dashed border-error text-error"
            title={t('settings.breakdown.pace')}
            value={target.goal === 'reduce' ? `−${adjustment}` : target.goal === 'build' ? `+${adjustment}` : '0'}
            valueClass={target.goal === 'reduce' ? 'text-error' : 'text-on-surface'}
            text={paceText}
          >
            <EditLink onClick={onEditGoal}>{t('settings.breakdown.editGoal')}</EditLink>
          </Step>
        )}
        <Equals tone="result">
          <span className="text-[15px] font-semibold text-on-surface">{t('settings.breakdown.result')}</span>
          <b className="font-headline font-extrabold text-[26px] leading-none text-primary tabular-nums">
            {result.kcal}
            <span className="ml-1 font-body text-sm font-semibold text-on-surface-variant">kcal</span>
          </b>
        </Equals>
      </ol>
      <MacroSplit target={result} weight={weight} />
    </div>
  );
}
