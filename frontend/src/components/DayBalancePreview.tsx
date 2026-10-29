import { useId, useState } from 'react';
import { t } from '../i18n';
import { addConsumed, buildDaySummary, type DayConsumed, type SummaryTargets } from '../lib/daySummary';
import { SummaryMetricRow } from './DaySummary';

type DayBalancePreviewProps = {
  dayLabel: string;
  dayWithoutItem: DayConsumed;
  item: DayConsumed;
  targets: SummaryTargets;
  editing: boolean;
};

type PreviewMode = 'before' | 'after';

export function DayBalancePreview({ dayLabel, dayWithoutItem, item, targets, editing }: DayBalancePreviewProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PreviewMode>('after');
  const panelId = useId();
  const shown = mode === 'after' ? addConsumed(dayWithoutItem, item) : dayWithoutItem;
  const metrics = buildDaySummary(shown, targets);
  const title = mode === 'after'
    ? t(editing ? 'dayBalance.afterEditTitle' : 'dayBalance.afterTitle')
    : t(editing ? 'dayBalance.beforeEditTitle' : 'dayBalance.beforeTitle');

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={`w-full py-4 px-6 rounded-3xl flex items-center justify-between transition-all duration-300 border ${open ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-highest/30 border-transparent hover:bg-surface-container-highest/50'}`}
      >
        <span className="flex items-center gap-3 text-primary">
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">{open ? 'visibility_off' : 'analytics'}</span>
          <span className="font-headline font-bold text-sm tracking-tight">{t(open ? 'dayBalance.hide' : 'dayBalance.show')}</span>
        </span>
        <span aria-hidden="true" className={`material-symbols-outlined transition-transform duration-300 ${open ? 'rotate-180 text-primary' : 'text-on-surface-variant'}`}>expand_more</span>
      </button>

      {open && (
        <div id={panelId} className="bg-surface-container-low rounded-[32px] p-6 border border-outline-variant/10 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <div aria-hidden="true" className="w-10 h-10 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-headline font-bold text-sm text-on-surface leading-tight">{title}</h3>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{dayLabel}</p>
              </div>
            </div>

            <div className="flex shrink-0 bg-surface-container-highest p-1 rounded-2xl border border-outline-variant/5">
              {(['before', 'after'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === option ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  {t(option === 'before' ? 'dayBalance.before' : 'dayBalance.after')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {metrics.map(metric => <SummaryMetricRow key={metric.key} metric={metric} />)}
          </div>
        </div>
      )}
    </section>
  );
}
