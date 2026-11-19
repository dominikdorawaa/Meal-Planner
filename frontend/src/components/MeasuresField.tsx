import { t } from '../i18n';
import { acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { LABEL_CLASS, blockNumberSigns } from '../lib/formFields';
import { measureName, type MeasureKind, type MeasureNames } from '../lib/measures';
import { isValidMeasure, maxBaseAmount, type MeasureInput } from '../lib/measureInputs';

interface MeasuresFieldProps {
  rows: MeasureInput[];
  baseUnit: string;
  kinds: MeasureKind[];
  kindsFailed?: boolean;
  onRetryKinds?: () => void;
  onChange: (rows: MeasureInput[]) => void;
}

function kindName(names: MeasureNames | null | undefined, code: string): string {
  return measureName(names, 1) ?? code;
}

export function MeasuresField({ rows, baseUnit, kinds, kindsFailed = false, onRetryKinds, onChange }: MeasuresFieldProps) {
  const used = new Set(rows.map(row => row.code));
  const nextKind = kinds.find(kind => !used.has(kind.code));
  const update = (index: number, change: Partial<MeasureInput>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className={`${LABEL_CLASS} mb-0`}>{t('productForm.measures')}</span>
        {nextKind && (
          <button
            type="button"
            onClick={() => onChange([...rows, { code: nextKind.code, amount: '', isDefault: false }])}
            className="-my-2 h-10 px-1 flex items-center gap-0.5 text-[13px] font-semibold text-primary active:scale-95 transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
            {t('productForm.addMeasure')}
          </button>
        )}
      </div>
      <p className="-mt-1 px-1 text-[12px] leading-snug text-on-surface-variant">{t('productForm.measuresHint', { unit: baseUnit })}</p>
      {rows.map((row, index) => {
        const options = kinds.filter(kind => kind.code === row.code || !used.has(kind.code));
        const known = options.some(kind => kind.code === row.code);
        const name = kindName(kinds.find(kind => kind.code === row.code)?.names ?? row.names, row.code);
        const valid = isValidMeasure(row, kinds);
        const max = maxBaseAmount(row.code, kinds);
        return (
          <div key={row.code} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 rounded-2xl bg-surface-container h-12 pl-3.5 pr-1">
              <span className="text-[15px] font-semibold text-on-surface tabular-nums">1</span>
              <select
                aria-label={t('productForm.measureKind', { index: index + 1 })}
                value={row.code}
                onChange={event => update(index, { code: event.target.value, names: null })}
                className="min-w-0 flex-1 h-9 bg-transparent rounded-xl px-1 text-[15px] font-medium text-on-surface outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {!known && <option value={row.code}>{name}</option>}
                {options.map(kind => (
                  <option key={kind.code} value={kind.code}>{kindName(kind.names, kind.code)}</option>
                ))}
              </select>
              <span aria-hidden="true" className="text-[15px] text-on-surface-variant">=</span>
              <div className="relative flex items-center">
                <input
                  {...numberFieldProps(max)}
                  aria-label={t('productForm.measureAmount', { name, unit: baseUnit })}
                  aria-invalid={!valid}
                  onKeyDown={blockNumberSigns}
                  value={row.amount}
                  onChange={event => acceptsLimitedNumber(event.target.value, max) && update(index, { amount: event.target.value })}
                  className="w-[78px] h-9 bg-surface-container-high rounded-xl pl-2 pr-7 text-[15px] font-semibold text-on-surface text-right tabular-nums outline-hidden border-[1.5px] border-transparent focus:border-primary caret-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span aria-hidden="true" className="absolute right-2.5 text-[13px] font-semibold text-on-surface-variant">{baseUnit}</span>
              </div>
              <button
                type="button"
                aria-pressed={row.isDefault}
                aria-label={t('productForm.measureDefault', { name })}
                onClick={() => onChange(rows.map((item, i) => ({ ...item, isDefault: i === index ? !item.isDefault : false })))}
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-colors ${row.isDefault ? 'text-primary' : 'text-on-surface-variant/60'}`}
              >
                <span className="material-symbols-outlined text-[20px]" style={row.isDefault ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
              </button>
              <button
                type="button"
                aria-label={t('productForm.measureRemove', { name })}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant/70 active:scale-90"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {!valid && (
              <p className="rounded-2xl px-3.5 py-3 text-[13px] font-medium bg-error/10 text-error">{t('productForm.measureInvalid', { max, unit: baseUnit })}</p>
            )}
          </div>
        );
      })}
      {kindsFailed && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium bg-error/10 text-error">
          <span>{t('productForm.measureKindsFailed')}</span>
          <button type="button" onClick={onRetryKinds} className="shrink-0 font-bold underline active:scale-95">
            {t('productForm.measureKindsRetry')}
          </button>
        </div>
      )}
    </div>
  );
}
