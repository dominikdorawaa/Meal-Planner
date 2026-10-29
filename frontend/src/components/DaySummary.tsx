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
  return (
    <span className="flex flex-col gap-2 w-full whitespace-nowrap">
      <span className="flex flex-col gap-1">
        <span className="flex items-baseline justify-between gap-1 leading-none">
          <span className="flex items-baseline gap-[3px] min-w-0">
            <span className="uppercase text-[clamp(6px,2vw,7px)] font-extrabold text-on-surface-variant">{t(shortLabel.kcal)}</span>
            <span data-testid="kcal-compact-value" className={`font-headline ${fitTextClass(formatCompactNumber(kcal.value), COMPACT_KCAL_SIZES, 5)} font-extrabold tabular-nums truncate ${valueTone[kcal.status]}`}>{formatCompactNumber(kcal.value)}</span>
          </span>
          <span className="text-[clamp(7px,2.3vw,8px)] font-bold text-on-surface-variant tabular-nums shrink-0">/{kcal.target}</span>
        </span>
        <ProgressBar metric={kcal} />
      </span>
      {macros.map(metric => (
        <span key={metric.key} className="flex flex-col gap-[3px]">
          <span className="flex items-baseline justify-between gap-1 leading-none">
            <span className="flex items-baseline gap-1 min-w-0">
              <span className="text-[8px] font-extrabold text-on-surface-variant w-2">{t(shortLabel[metric.key])}</span>
              <span data-testid={`${metric.key}-compact-value`} className={`${fitTextClass(formatCompactNumber(metric.value), COMPACT_MACRO_SIZES, 5)} font-extrabold tabular-nums truncate ${valueTone[metric.status]}`}>{formatCompactNumber(metric.value)}</span>
            </span>
            <span className="text-[clamp(7px,2.3vw,8px)] font-semibold text-on-surface-variant tabular-nums shrink-0">{metric.target}</span>
          </span>
          <ProgressBar metric={metric} />
        </span>
      ))}
    </span>
  );
}

function statusLabel(metric: SummaryMetric) {
  const amount = `${formatCompactNumber(metric.distance)} ${metric.unit}`;
  if (metric.status === 'over') return t('plan.summary.over', { amount });
  if (metric.status === 'under') return t('plan.summary.missing', { amount });
  return t('plan.summary.onTarget');
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
    <div data-scroll-lock className="fixed inset-0 bg-black/10 z-[200] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-6 animate-fade-in" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={t('plan.summary.title')} className="bg-surface-container-lowest rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-ambient w-full max-w-sm border-t sm:border border-outline-variant/10 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-6 sm:hidden"></div>
        <h3 className="font-headline font-bold text-xl text-on-surface tracking-tight text-center">{t('plan.summary.title')}</h3>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant text-center mt-1 mb-6">{dayLabel}</p>
        <div className="flex flex-col gap-4 mb-6">
          {metrics.map(metric => (
            <div key={metric.key} className="flex flex-col gap-1.5">
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
          ))}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className="w-full py-4 bg-surface-container-low hover:bg-surface-container-highest text-on-surface font-bold rounded-2xl transition-colors active:scale-95">
          {t('plan.summary.close')}
        </button>
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
    return <div className="mt-1.5 w-full"><CompactSummary metrics={metrics} /></div>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('plan.summary.open', { day: dayLabel })}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="mt-1.5 w-full rounded-lg text-left cursor-pointer hover:bg-surface-container-highest/40 active:bg-surface-container-highest/60 transition-colors"
      >
        <CompactSummary metrics={metrics} />
      </button>
      {open && createPortal(<SummaryDetails metrics={metrics} dayLabel={dayLabel} onClose={close} />, document.body)}
    </>
  );
}
