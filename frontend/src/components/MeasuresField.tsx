import { t } from '../i18n';
import { acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { measureName, type MeasureKind, type MeasureNames } from '../lib/measures';
import { isValidMeasure, maxBaseAmount, type MeasureInput } from '../lib/measureInputs';

interface MeasuresFieldProps {
  rows: MeasureInput[];
  baseUnit: string;
  kinds: MeasureKind[];
  onChange: (rows: MeasureInput[]) => void;
}

function kindName(names: MeasureNames | null | undefined, code: string): string {
  return measureName(names, 1) ?? code;
}

export function MeasuresField({ rows, baseUnit, kinds, onChange }: MeasuresFieldProps) {
  const used = new Set(rows.map(row => row.code));
  const nextKind = kinds.find(kind => !used.has(kind.code));
  const update = (index: number, change: Partial<MeasureInput>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">{t('productForm.measures')}</span>
      <p className="text-[11px] font-medium text-on-surface-variant pl-1">{t('productForm.measuresHint', { unit: baseUnit })}</p>
      {rows.map((row, index) => {
        const options = kinds.filter(kind => kind.code === row.code || !used.has(kind.code));
        const known = options.some(kind => kind.code === row.code);
        const name = kindName(kinds.find(kind => kind.code === row.code)?.names ?? row.names, row.code);
        const valid = isValidMeasure(row, kinds);
        const max = maxBaseAmount(row.code, kinds);
        return (
          <div key={row.code} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 rounded-2xl bg-surface-container-low p-1.5 pl-3">
              <span className="text-sm font-bold text-on-surface-variant">1</span>
              <select
                aria-label={t('productForm.measureKind', { index: index + 1 })}
                value={row.code}
                onChange={event => update(index, { code: event.target.value, names: null })}
                className="min-w-0 flex-1 bg-surface-container-lowest rounded-xl py-2 px-1.5 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              >
                {!known && <option value={row.code}>{name}</option>}
                {options.map(kind => (
                  <option key={kind.code} value={kind.code}>{kindName(kind.names, kind.code)}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-on-surface-variant">=</span>
              <div className="relative flex items-center">
                <input
                  {...numberFieldProps(max)}
                  aria-label={t('productForm.measureAmount', { name, unit: baseUnit })}
                  aria-invalid={!valid}
                  onKeyDown={event => ['e', 'E', '+', '-'].includes(event.key) && event.preventDefault()}
                  value={row.amount}
                  onChange={event => acceptsLimitedNumber(event.target.value, max) && update(index, { amount: event.target.value })}
                  className="w-[72px] bg-surface-container-lowest rounded-xl py-2 pl-2 pr-7 text-sm font-bold text-on-surface text-right outline-none focus:ring-2 focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-2 text-[10px] font-black text-on-surface-variant/50 uppercase">{baseUnit}</span>
              </div>
              <button
                type="button"
                aria-pressed={row.isDefault}
                aria-label={t('productForm.measureDefault', { name })}
                onClick={() => onChange(rows.map((item, i) => ({ ...item, isDefault: i === index ? !item.isDefault : false })))}
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-colors ${row.isDefault ? 'text-primary bg-primary/10' : 'text-on-surface-variant/60'}`}
              >
                <span className="material-symbols-outlined text-[20px]" style={row.isDefault ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
              </button>
              <button
                type="button"
                aria-label={t('productForm.measureRemove', { name })}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant/60 active:scale-90"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {!valid && (
              <p className="rounded-xl px-3 py-2.5 text-xs font-medium bg-error/10 text-error">{t('productForm.measureInvalid', { max: max / 1000 })}</p>
            )}
          </div>
        );
      })}
      {nextKind && (
        <button
          type="button"
          onClick={() => onChange([...rows, { code: nextKind.code, amount: '', isDefault: false }])}
          className="self-start flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-4 py-2 text-xs font-bold active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('productForm.addMeasure')}
        </button>
      )}
    </div>
  );
}
