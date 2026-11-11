import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t, type MessageKey } from '../i18n';
import { useBottomSheet } from '../lib/bottomSheet';
import { formatCompactNumber } from '../lib/compactNumber';
import { macroFillClass } from '../lib/macroColors';
import { COMPACT_KCAL_SIZES, COMPACT_MACRO_SIZES, fitTextClass } from '../lib/fitText';
import {
  buildDaySummary,
  type DayConsumed,
  type SummaryMetric,
  type SummaryMetricKey,
  type SummaryStatus,
  type SummaryTargets,
} from '../lib/daySummary';

type DaySummaryProps = {
  consumed: DayConsumed;
  targets: SummaryTargets;
  dayLabel: string;
  interactive: boolean;
};

const shortLabel: Record<SummaryMetricKey, MessageKey> = {
  kcal: 'plan.summary.kcalShort',
  protein: 'plan.summary.proteinShort',
  fat: 'plan.summary.fatShort',
  carbs: 'plan.summary.carbsShort',
};

const fullLabel: Record<SummaryMetricKey, MessageKey> = {
  kcal: 'plan.summary.kcal',
  protein: 'plan.summary.protein',
  fat: 'plan.summary.fat',
  carbs: 'plan.summary.carbs',
};

const fillTone: Record<SummaryMetricKey, string> = {
  kcal: 'bg-primary',
  ...macroFillClass,
};

const valueTone: Record<SummaryStatus, string> = {
  under: 'text-on-surface',
  ok: 'text-primary',
  over: 'text-error',
};

function ProgressBar({ metric, className = '' }: { metric: SummaryMetric; className?: string }) {
  return (
    <span className={`block h-1 w-full bg-surface-container-highest rounded-full overflow-hidden relative ${className}`}>
      <span data-testid={`${metric.key}-fill`} className={`absolute top-0 left-0 h-full ${fillTone[metric.key]} rounded-full transition-all duration-1000`} style={{ width: `${metric.fillPercent}%` }}></span>
      <span data-testid={`${metric.key}-overflow`} className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-1000" style={{ width: `${metric.overflowPercent}%` }}></span>
    </span>
  );
}

function CompactSummary({ metrics }: { metrics: SummaryMetric[] }) {
  const [kcal, ...macros] = metrics;
  const kcalValue = formatCompactNumber(kcal.value);
  return (
    <span className="flex flex-col gap-2 w-full whitespace-nowrap">
      <span className="flex flex-col gap-1.5">
        <span className="flex flex-col gap-0.5 leading-none">
          <span className="flex items-baseline gap-1 min-w-0 font-headline font-extrabold">
            <span data-testid="kcal-compact-value" className={`${fitTextClass(kcalValue, COMPACT_KCAL_SIZES, 5)} tracking-tight tabular-nums truncate ${valueTone[kcal.status]}`}>{kcalValue}</span>
            <span className={`text-[clamp(12px,3.9vw,14px)] font-bold shrink-0 ${valueTone[kcal.status]}`}>{t(shortLabel.kcal).toLowerCase()}</span>
          </span>
          <span className="text-[clamp(9px,2.8vw,10px)] font-medium text-on-surface-variant tabular-nums">{t('plan.summary.ofGoal', { goal: formatCompactNumber(kcal.goal) })}</span>
        </span>
        <ProgressBar metric={kcal} className="h-1.5" />
      </span>
      <span className="flex flex-col gap-1">
        {macros.map(metric => {
          const value = formatCompactNumber(metric.value);
          const goal = formatCompactNumber(metric.goal);
          return (
            <span key={metric.key} className="grid grid-cols-[9px_minmax(0,1fr)_44px] items-center gap-1 leading-none">
              <span className="text-[9px] font-bold text-on-surface-variant">{t(shortLabel[metric.key])}</span>
              <ProgressBar metric={metric} />
              <span className={`${fitTextClass(`${value}/${goal}`, COMPACT_MACRO_SIZES, 7)} text-right tabular-nums truncate`}>
                <span data-testid={`${metric.key}-compact-value`} className={`font-bold ${valueTone[metric.status]}`}>{value}</span>
                <span className="text-on-surface-variant">/{goal}</span>
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function statusLabel(metric: SummaryMetric) {
  const amount = `${formatCompactNumber(metric.distance)} ${metric.unit}`;
  if (metric.distance === 0) return t('plan.summary.onTarget');
  return t(metric.exceeded ? 'plan.summary.over' : 'plan.summary.missing', { amount });
}

export function SummaryMetricRow({ metric }: { metric: SummaryMetric }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-on-surface">{t(fullLabel[metric.key])}</span>
        <span className="text-sm tabular-nums whitespace-nowrap">
          <span className={`font-extrabold ${valueTone[metric.status]}`}>{formatCompactNumber(metric.value)}</span>
          <span className="text-on-surface-variant"> / {metric.target} {metric.unit}</span>
        </span>
      </div>
      <ProgressBar metric={metric} className="h-1.5" />
      <span className={`text-xs font-semibold ${metric.status === 'over' ? 'text-error' : 'text-on-surface-variant'}`}>{statusLabel(metric)}</span>
    </div>
  );
}

const dotTone: Record<SummaryMetricKey, string> = {
  kcal: 'bg-primary',
  ...macroFillClass,
};

function detailStatus(metric: SummaryMetric) {
  const amount = `${formatCompactNumber(metric.distance)} ${metric.unit}`;
  if (metric.distance === 0) return t('plan.summary.onTarget');
  return t(metric.exceeded ? 'plan.summary.overShort' : 'plan.summary.missingShort', { amount });
}

function DetailRow({ metric }: { metric: SummaryMetric }) {
  return (
    <div className="py-2.5 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotTone[metric.key]}`}></span>
          {t(fullLabel[metric.key])}
        </span>
        <span className="text-sm font-bold text-on-surface tabular-nums whitespace-nowrap">
          {formatCompactNumber(metric.value)} / {formatCompactNumber(metric.goal)} {metric.unit}
        </span>
      </div>
      <ProgressBar metric={metric} className="h-1.5" />
      <span className={`text-xs font-semibold ${metric.status === 'over' ? 'text-error' : 'text-primary'}`}>{detailStatus(metric)}</span>
    </div>
  );
}

function SummaryDetails({ metrics, dayLabel, onClose }: { metrics: SummaryMetric[]; dayLabel: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useBottomSheet(true, onClose);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div data-scroll-lock className="fixed inset-0 bg-black/20 z-[200] flex flex-col justify-end items-center animate-fade-in" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('plan.summary.title')}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[600px] bg-surface-container-low rounded-t-[28px] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-ambient border-t border-outline-variant/10 animate-slide-up"
      >
        <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-3"></div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="font-headline font-bold text-lg text-on-surface tracking-tight">{dayLabel}</h3>
          <button
            ref={closeRef}
            type="button"
            aria-label={t('plan.summary.close')}
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex flex-col divide-y divide-outline-variant/10">
          {metrics.map(metric => <DetailRow key={metric.key} metric={metric} />)}
        </div>
      </div>
    </div>
  );
}

export function DaySummary({ consumed, targets, dayLabel, interactive }: DaySummaryProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const metrics = buildDaySummary(consumed, targets);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  if (!interactive) {
    return <div className="w-full"><CompactSummary metrics={metrics} /></div>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('plan.summary.open', { day: dayLabel })}
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="w-full rounded-lg text-left cursor-pointer hover:bg-surface-container-highest/40 active:bg-surface-container-highest/60 transition-colors"
      >
        <CompactSummary metrics={metrics} />
      </button>
      {open && createPortal(<SummaryDetails metrics={metrics} dayLabel={dayLabel} onClose={close} />, document.body)}
    </>
  );
}
