import { useState } from 'react';
import { t } from '../../i18n';
import { acceptsLimitedNumber } from '../../lib/inputLimits';
import { selectOnFocusProps } from '../../lib/selectOnFocus';
import { formatDecimal } from './settingsFormat';

type NumberStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  unit: string;
  accent?: boolean;
  disabled?: boolean;
};

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function NumberStepper({ label, value, onChange, min, max, step, decimals = 0, unit, accent = false, disabled = false }: NumberStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) => roundTo(Math.min(max, Math.max(min, next)), decimals);
  const safeValue = Number.isFinite(value) ? value : min;

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(',', '.'));
    if (draft.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed));
    setDraft(null);
  };

  const nudge = (direction: 1 | -1) => {
    setDraft(null);
    onChange(clamp(safeValue + direction * step));
  };

  const buttonClass =
    'w-10 h-10 shrink-0 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100';

  const shown = draft ?? formatDecimal(safeValue, decimals);

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label={t('settings.stepper.decrease', { label })} disabled={disabled || safeValue <= min} onClick={() => nudge(-1)} className={buttonClass}>
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">remove</span>
      </button>
      <label className={`w-[100px] h-11 rounded-[14px] bg-surface-container flex items-center justify-center gap-1 border-[1.5px] border-transparent focus-within:border-primary focus-within:bg-primary/[0.08] transition-colors cursor-text ${disabled ? 'opacity-40' : ''}`}>
        <input
          {...selectOnFocusProps}
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          aria-label={label}
          disabled={disabled}
          value={shown}
          onFocus={event => {
            setDraft(formatDecimal(safeValue, decimals));
            selectOnFocusProps.onFocus(event);
          }}
          onChange={event => {
            if (acceptsLimitedNumber(event.target.value, max, decimals)) setDraft(event.target.value);
          }}
          onBlur={event => {
            selectOnFocusProps.onBlur(event);
            commit();
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          style={{ width: `${Math.max(shown.length, 1) + 0.2}ch` }}
          className={`bg-transparent outline-none text-center font-headline font-extrabold text-xl tabular-nums caret-primary min-w-0 ${accent ? 'text-primary' : 'text-on-surface'}`}
        />
        <span className="text-[13px] font-semibold text-on-surface-variant">{unit}</span>
      </label>
      <button type="button" aria-label={t('settings.stepper.increase', { label })} disabled={disabled || safeValue >= max} onClick={() => nudge(1)} className={buttonClass}>
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
      </button>
    </div>
  );
}
