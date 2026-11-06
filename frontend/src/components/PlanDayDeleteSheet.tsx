import { useState } from 'react';
import { pluralForm, t } from '../i18n';
import { ConfirmSheet } from './ConfirmSheet';

export type PlanDayDeleteItem = { id: string; title: string; detail: string };

interface PlanDayDeleteSheetProps {
  dayLabel: string;
  items: PlanDayDeleteItem[];
  onConfirm: (ids: string[]) => void;
  onCancel: () => void;
}

export function PlanDayDeleteSheet({ dayLabel, items, onConfirm, onCancel }: PlanDayDeleteSheetProps) {
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());
  const selectedItems = items.filter(item => !unchecked.has(item.id));
  const count = selectedItems.length;

  const toggle = (id: string) => {
    setUnchecked(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ConfirmSheet
      question={t('plan.deleteDay.question')}
      title={dayLabel}
      description={t('plan.deleteDay.description')}
      confirmLabel={count === 0 ? t('plan.deleteDay.confirm') : t(`plan.deleteDay.${pluralForm(count)}`, { count })}
      confirmDisabled={count === 0}
      onConfirm={() => onConfirm(selectedItems.map(item => item.id))}
      onCancel={onCancel}
    >
      <ul className="flex flex-col -mx-2">
        {items.map(item => {
          const checked = !unchecked.has(item.id);
          return (
            <li key={item.id}>
              <label className="flex items-center gap-4 px-2 py-3 rounded-2xl cursor-pointer active:bg-surface-container-low transition-colors">
                <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${checked ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant/40'}`}
                >
                  {checked && <span className="material-symbols-outlined text-[18px] font-bold">check</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold text-[15px] truncate transition-colors ${checked ? 'text-on-surface' : 'text-on-surface-variant'}`}>{item.title}</span>
                  <span className="block text-sm text-on-surface-variant truncate">{item.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </ConfirmSheet>
  );
}
