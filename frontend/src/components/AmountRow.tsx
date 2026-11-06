import type { ReactNode } from 'react';
import { formatCompactNumber } from '../lib/compactNumber';
import { AMOUNT_DECIMALS, acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { t } from '../i18n';

interface AmountRowProps {
  label: string;
  max: number;
  unit: ReactNode;
  value: number | '';
  kcal: number;
  active: boolean;
  kcalTestId?: string;
  onActivate: () => void;
  onChange: (value: number | '') => void;
}

export function AmountRow({ label, max, unit, value, kcal, active, kcalTestId, onActivate, onChange }: AmountRowProps) {
  return (
    <div
      data-amount-row
      className={`relative flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${active ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={t('amount.chooseRow', { label })}
        onClick={onActivate}
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <div className="relative flex items-center gap-2 pl-0.5 min-w-0 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto">
        <input
          {...numberFieldProps(max, AMOUNT_DECIMALS, onActivate)}
          aria-label={label}
          value={value}
          onChange={event => {
            if (!acceptsLimitedNumber(event.target.value, max)) return;
            onActivate();
            onChange(event.target.value === '' ? '' : Number(event.target.value));
          }}
          className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${active ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
        />
        {typeof unit === 'string' ? <span className="font-bold text-on-surface-variant text-sm whitespace-nowrap truncate">{unit}</span> : unit}
      </div>
      <div className="relative flex items-baseline gap-1 ml-auto shrink-0 pointer-events-none">
        <span data-testid={kcalTestId} className={`font-black text-xl tabular-nums whitespace-nowrap transition-colors ${active ? 'text-primary' : 'text-on-surface'}`}>{formatCompactNumber(kcal)}</span>
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
      </div>
    </div>
  );
}
