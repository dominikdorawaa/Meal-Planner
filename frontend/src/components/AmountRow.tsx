import { formatCompactNumber } from '../lib/compactNumber';
import { acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';

interface AmountRowProps {
  label: string;
  max: number;
  unit: string;
  value: number | '';
  kcal: number;
  active: boolean;
  onActivate: () => void;
  onChange: (value: number | '') => void;
}

export function AmountRow({ label, max, unit, value, kcal, active, onActivate, onChange }: AmountRowProps) {
  return (
    <div
      data-amount-row
      className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${active ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}
    >
      <div className="flex items-center gap-2 pl-0.5 min-w-0">
        <input
          {...numberFieldProps(max)}
          aria-label={label}
          value={value}
          onFocus={onActivate}
          onChange={event => {
            if (!acceptsLimitedNumber(event.target.value, max)) return;
            onActivate();
            onChange(event.target.value === '' ? '' : Number(event.target.value));
          }}
          className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${active ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
        />
        <span className="font-bold text-on-surface-variant text-sm whitespace-nowrap truncate">{unit}</span>
      </div>
      <div className="flex items-baseline gap-1 ml-auto shrink-0">
        <span className={`font-black text-xl tabular-nums whitespace-nowrap transition-colors ${active ? 'text-primary' : 'text-on-surface'}`}>{formatCompactNumber(kcal)}</span>
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
      </div>
    </div>
  );
}
