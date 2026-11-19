import { useId, type InputHTMLAttributes } from 'react';
import { t } from '../i18n';
import { acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { macroTextClass, type MacroKey } from '../lib/macroColors';
import { blockNumberSigns } from '../lib/formStyles';

const NUMBER_INPUT_CLASS =
  'flex-1 min-w-0 w-full bg-transparent outline-hidden text-on-surface tabular-nums caret-primary placeholder:text-on-surface-variant/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

interface UnitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  unit: string;
  value: string;
  max: number;
  decimals?: number;
  size?: 'regular' | 'large' | 'compact';
  tone?: 'default' | 'raised';
  onValueChange: (value: string) => void;
}

const UNIT_INPUT_SIZE = { regular: 'h-12 px-4', large: 'h-14 px-4', compact: 'h-12 px-3' };

export function UnitInput({ unit, value, max, decimals, size = 'regular', tone = 'default', onValueChange, className = '', ...input }: UnitInputProps) {
  const large = size === 'large';
  return (
    <div className={`flex items-center gap-2 rounded-2xl border-[1.5px] border-transparent focus-within:border-primary transition-colors ${tone === 'raised' ? 'bg-surface-container-high' : 'bg-surface-container'} ${UNIT_INPUT_SIZE[size]} ${className}`}>
      <input
        {...numberFieldProps(max, decimals)}
        {...input}
        value={value}
        onKeyDown={blockNumberSigns}
        onChange={event => acceptsLimitedNumber(event.target.value, max, decimals) && onValueChange(event.target.value)}
        className={`${NUMBER_INPUT_CLASS} ${large ? 'font-headline font-extrabold text-xl' : 'font-semibold text-[15px]'}`}
      />
      <span aria-hidden="true" className="shrink-0 text-[13px] font-semibold text-on-surface-variant">{unit}</span>
    </div>
  );
}

export type MacroValues = Record<MacroKey, string>;

const MACRO_ORDER: MacroKey[] = ['protein', 'fat', 'carbs'];

const MACRO_LABELS = {
  protein: 'productForm.protein',
  fat: 'productForm.fat',
  carbs: 'productForm.carbs',
} as const;

interface MacroInputsProps {
  values: MacroValues;
  max: (macro: MacroKey) => number;
  decimals?: number;
  required?: boolean;
  onChange: (macro: MacroKey, value: string) => void;
}

export function MacroInputs({ values, max, decimals, required = false, onChange }: MacroInputsProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {MACRO_ORDER.map(macro => (
        <div key={macro} className="min-w-0">
          <label htmlFor={`${id}-${macro}`} className={`mb-1.5 px-1 flex items-center gap-1.5 text-[13px] font-semibold ${macroTextClass[macro]}`}>
            <span aria-hidden="true" className="w-2 h-2 shrink-0 rounded-full bg-current" />
            <span className="truncate">{t(MACRO_LABELS[macro])}</span>
          </label>
          <UnitInput
            id={`${id}-${macro}`}
            unit="g"
            value={values[macro]}
            max={max(macro)}
            decimals={decimals}
            placeholder="0"
            aria-required={required || undefined}
            size="compact"
            onValueChange={value => onChange(macro, value)}
          />
        </div>
      ))}
    </div>
  );
}

