import { formatCompactNumber } from '../lib/compactNumber';
import { AMOUNT_DECIMALS, acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { t } from '../i18n';

export interface AmountUnitOption {
  value: string;
  label: string;
}

interface AmountFieldProps {
  label: string;
  value: number | '';
  max: number;
  unit: string;
  unitLabel: string;
  units: AmountUnitOption[];
  note?: string;
  kcal: number;
  onChange: (value: number | '') => void;
  onUnitChange: (unit: string) => void;
}

export function AmountField({ label, value, max, unit, unitLabel, units, note, kcal, onChange, onUnitChange }: AmountFieldProps) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface-container-high p-1.5 pr-4 min-w-0">
      <input
        {...numberFieldProps(max, AMOUNT_DECIMALS)}
        aria-label={label}
        value={value}
        onChange={event => {
          if (!acceptsLimitedNumber(event.target.value, max)) return;
          onChange(event.target.value === '' ? '' : Number(event.target.value));
        }}
        className="w-[72px] h-11 shrink-0 rounded-xl bg-surface ring-[1.5px] ring-inset ring-primary text-on-surface font-bold text-base text-center outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {units.length > 1 ? (
        <label className="relative h-11 shrink min-w-0 flex items-center rounded-xl bg-surface-container-highest pl-3 pr-8 text-[14.5px] font-semibold text-on-surface">
          <span aria-hidden="true" className="truncate">{unitLabel}</span>
          <select
            aria-label={t('amount.unit')}
            value={unit}
            onChange={event => onUnitChange(event.target.value)}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          >
            {units.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span aria-hidden="true" className="material-symbols-outlined absolute right-2 text-[18px] text-on-surface-variant">expand_more</span>
        </label>
      ) : (
        <span className="px-1 text-[14.5px] font-semibold text-on-surface-variant whitespace-nowrap">{unitLabel}</span>
      )}
      {note && <span className="min-w-0 truncate text-[13px] text-on-surface-variant">{note}</span>}
      <span className="ml-auto shrink-0 flex items-baseline gap-1 pl-1">
        <span data-testid="amount-kcal" className="font-headline font-extrabold text-xl text-primary tabular-nums">{formatCompactNumber(kcal)}</span>
        <span className="text-xs font-semibold text-on-surface-variant">kcal</span>
      </span>
    </div>
  );
}
