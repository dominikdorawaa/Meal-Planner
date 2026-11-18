import { useId, useState } from 'react';
import { t, type MessageKey } from '../i18n';
import { formatCompactNumber } from '../lib/compactNumber';
import { addConsumed, buildDaySummary, type DayConsumed, type SummaryMetricKey, type SummaryTargets } from '../lib/daySummary';

interface DayBalanceCardProps {
  dayWithoutItem: DayConsumed;
  item: DayConsumed;
  targets: SummaryTargets;
  editing?: boolean;
  defaultOpen?: boolean;
}

const LABELS: Record<SummaryMetricKey, MessageKey> = {
  kcal: 'plan.summary.kcal',
  protein: 'plan.summary.protein',
  fat: 'plan.summary.fat',
  carbs: 'plan.summary.carbs',
};

const COLORS: Record<SummaryMetricKey, { dot: string; fill: string; added: string; text: string }> = {
  kcal: { dot: 'bg-primary', fill: 'bg-primary', added: 'bg-primary/45', text: 'text-primary' },
  protein: { dot: 'bg-macro-protein', fill: 'bg-macro-protein', added: 'bg-macro-protein/45', text: 'text-macro-protein' },
  fat: { dot: 'bg-macro-fat', fill: 'bg-macro-fat', added: 'bg-macro-fat/45', text: 'text-macro-fat' },
  carbs: { dot: 'bg-macro-carbs', fill: 'bg-macro-carbs', added: 'bg-macro-carbs/45', text: 'text-macro-carbs' },
};

function share(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}

export function DayBalanceCard({ dayWithoutItem, item, targets, editing = false, defaultOpen = false }: DayBalanceCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [after, setAfter] = useState(true);
  const panelId = useId();
  const titleId = useId();
  const subtitleId = useId();
  const before = buildDaySummary(dayWithoutItem, targets);
  const withItem = buildDaySummary(addConsumed(dayWithoutItem, item), targets);

  return (
    <section className="rounded-2xl bg-surface-container-lowest">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={titleId}
        aria-describedby={open ? undefined : subtitleId}
        onClick={() => setOpen(value => !value)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex-1 min-w-0">
          <span id={titleId} className="block font-headline font-extrabold text-base tracking-tight text-on-surface">{t('dayBalance.title')}</span>
          {!open && <span id={subtitleId} className="block mt-0.5 text-[13px] text-on-surface-variant">{t(editing ? 'dayBalance.editSubtitle' : 'dayBalance.subtitle')}</span>}
        </span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[24px] text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {open && (
        <div id={panelId} className="px-4 pb-4">
          <div className="flex rounded-full bg-surface-container-low p-[3px]" role="group" aria-label={t('dayBalance.compare')}>
            {([false, true] as const).map(option => (
              <button
                key={String(option)}
                type="button"
                aria-pressed={after === option}
                onClick={() => setAfter(option)}
                className={`flex-1 h-9 rounded-full text-sm font-semibold transition-colors ${after === option ? 'bg-surface-container-highest text-on-surface' : 'text-on-surface-variant'}`}
              >
                {t(option ? 'dayBalance.after' : 'dayBalance.before')}
              </button>
            ))}
          </div>

          <div className="flex flex-col">
            {withItem.map((metric, index) => {
              const previous = before[index];
              const added = Math.round(metric.key === 'kcal' ? item.kcal : item[metric.key]);
              const shown = after ? metric : previous;
              const color = COLORS[metric.key];
              const baseWidth = share(previous.value, metric.max);
              const addedWidth = after ? Math.max(share(metric.value, metric.max) - baseWidth, added > 0 ? 1.5 : 0) : 0;
              return (
                <div key={metric.key} className="mt-3">
                  <div className="flex items-baseline gap-2 text-[13.5px]">
                    <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 self-center ${color.dot}`}></span>
                    <span className="font-semibold text-on-surface">{t(LABELS[metric.key])}</span>
                    <span className="flex-1"></span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span data-testid={`balance-${metric.key}`} className={`font-bold ${shown.status === 'over' ? 'text-error' : 'text-on-surface'}`}>{formatCompactNumber(shown.value)}</span>
                      <span className="text-on-surface-variant"> / {metric.target} {metric.unit}</span>
                    </span>
                    <span className={`w-11 text-right text-[12.5px] font-bold tabular-nums transition-opacity ${color.text} ${after && added > 0 ? 'opacity-100' : 'opacity-0'}`}>
                      {added > 0 ? `+${formatCompactNumber(added)}` : ''}
                    </span>
                  </div>
                  <div className="relative h-1.5 mt-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                    <i className={`absolute inset-y-0 left-0 rounded-full ${color.fill}`} style={{ width: `${baseWidth}%` }}></i>
                    <i
                      data-testid={`balance-${metric.key}-added`}
                      className={`absolute inset-y-0 rounded-full transition-[width] duration-500 ease-out ${color.added}`}
                      style={{ left: `${baseWidth}%`, width: `${Math.min(addedWidth, 100 - baseWidth)}%` }}
                    ></i>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
