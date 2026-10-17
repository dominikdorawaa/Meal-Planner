import { useState } from 'react';
import { createPortal } from 'react-dom';
import { t, type MessageKey } from '../i18n';
import {
  buildDaySummary,
  distanceToTarget,
  type DayConsumed,
  type SummaryMetric,
  type SummaryStatus,
  type SummaryTargets,
} from '../lib/daySummary';

type DaySummaryProps = {
  consumed: DayConsumed;
  targets: SummaryTargets;
  dayLabel: string;
  interactive: boolean;
};

const valueTone: Record<SummaryStatus, string> = {
  under: 'text-on-surface',
  ok: 'text-primary',
  over: 'text-error',
};

function ProgressBar({ metric, className = '' }: { metric: SummaryMetric; className?: string }) {
  return (
    <div className={`h-1 w-full bg-surface-container-highest rounded-full overflow-hidden relative ${className}`}>
      <div data-testid={`${metric.key}-fill`} className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${metric.fillPercent}%` }}></div>
      <div data-testid={`${metric.key}-overflow`} className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-1000" style={{ width: `${metric.overflowPercent}%` }}></div>
    </div>
  );
}

function CompactSummary({ metrics }: { metrics: SummaryMetric[] }) {
  const [kcal, ...macros] = metrics;
  return (
    <div className="flex flex-col gap-2 w-full whitespace-nowrap">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-1 leading-none">
          <span className="flex items-baseline gap-[3px] min-w-0">
            <span className="uppercase text-[clamp(6px,2vw,7px)] font-extrabold text-on-surface-variant">{t('plan.summary.kcalShort')}</span>
            <span className={`font-headline text-[clamp(10px,3.3vw,12px)] font-extrabold tabular-nums ${valueTone[kcal.status]}`}>{kcal.value}</span>
          </span>
          <span className="text-[clamp(7px,2.3vw,8px)] font-bold text-on-surface-variant tabular-nums">/{kcal.target}</span>
        </div>
        <ProgressBar metric={kcal} />
      </div>
      {macros.map(metric => (
        <div key={metric.key} className="flex flex-col gap-[3px]">
          <div className="flex items-baseline justify-between gap-1 leading-none">
            <span className="flex items-baseline gap-1 min-w-0">
              <span className="text-[8px] font-extrabold text-on-surface-variant w-2">{t(`plan.summary.${metric.key}Short` as MessageKey)}</span>
              <span className={`text-[clamp(9px,2.9vw,10px)] font-extrabold tabular-nums ${valueTone[metric.status]}`}>{metric.value}</span>
            </span>
            <span className="text-[clamp(7px,2.3vw,8px)] font-semibold text-on-surface-variant tabular-nums">{metric.target}</span>
          </div>
          <ProgressBar metric={metric} />
        </div>
      ))}
    </div>
  );
}

function statusLabel(metric: SummaryMetric) {
  const amount = `${distanceToTarget(metric)} ${metric.unit}`;
  if (metric.status === 'over') return t('plan.summary.over', { amount });
  if (metric.status === 'under') return t('plan.summary.missing', { amount });
  return t('plan.summary.onTarget');
}

function SummaryDetails({ metrics, dayLabel, onClose }: { metrics: SummaryMetric[]; dayLabel: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/10 z-[200] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-6 animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('plan.summary.title')} className="bg-surface-container-lowest rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-ambient w-full max-w-sm border-t sm:border border-outline-variant/10 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-6 sm:hidden"></div>
        <h3 className="font-headline font-bold text-xl text-on-surface tracking-tight text-center">{t('plan.summary.title')}</h3>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant text-center mt-1 mb-6">{dayLabel}</p>
        <div className="flex flex-col gap-4 mb-6">
          {metrics.map(metric => (
            <div key={metric.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-on-surface">{t(`plan.summary.${metric.key}` as MessageKey)}</span>
                <span className="text-sm tabular-nums">
                  <span className={`font-extrabold ${valueTone[metric.status]}`}>{metric.value}</span>
                  <span className="text-on-surface-variant"> / {metric.target} {metric.unit}</span>
                </span>
              </div>
              <ProgressBar metric={metric} className="h-1.5" />
              <span className={`text-xs font-semibold ${metric.status === 'over' ? 'text-error' : 'text-on-surface-variant'}`}>{statusLabel(metric)}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-4 bg-surface-container-low hover:bg-surface-container-highest text-on-surface font-bold rounded-2xl transition-colors active:scale-95">
          {t('plan.summary.close')}
        </button>
      </div>
    </div>
  );
}

export function DaySummary({ consumed, targets, dayLabel, interactive }: DaySummaryProps) {
  const [open, setOpen] = useState(false);
  const metrics = buildDaySummary(consumed, targets);

  if (!interactive) {
    return <div className="mt-1.5 w-full"><CompactSummary metrics={metrics} /></div>;
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('plan.summary.open', { day: dayLabel })}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="mt-1.5 w-full rounded-lg text-left cursor-pointer hover:bg-surface-container-highest/40 active:bg-surface-container-highest/60 transition-colors"
      >
        <CompactSummary metrics={metrics} />
      </button>
      {open && createPortal(<SummaryDetails metrics={metrics} dayLabel={dayLabel} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
