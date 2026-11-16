import { t } from '../i18n';

interface ShoppingItemRowProps {
  name: string;
  amount: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  onRemove?: () => void;
}

const TEXT = 'transition-colors';

export function ShoppingItemRow({ name, amount, checked, disabled = false, onToggle, onOpen, onRemove }: ShoppingItemRowProps) {
  const circle = (
    <>
      <input type="checkbox" aria-label={name} checked={checked} disabled={disabled} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-container-low ${checked ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant/45'}`}
      >
        {checked && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
      </span>
    </>
  );
  const text = (
    <>
      <span className={`flex-1 min-w-0 truncate text-[15px] ${TEXT} ${checked ? 'text-on-surface-variant/70 line-through' : 'text-on-surface'}`}>{name}</span>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${TEXT} ${checked ? 'text-on-surface-variant/70 line-through' : 'text-on-surface-variant'}`}>{amount}</span>
    </>
  );

  return (
    <li className={`flex items-center border-t border-outline-variant/10 first:border-t-0 ${disabled ? 'opacity-50' : ''}`}>
      {onOpen ? (
        <>
          <label className="w-11 h-[52px] -ml-[11px] shrink-0 flex items-center justify-center cursor-pointer">{circle}</label>
          <button
            type="button"
            onClick={onOpen}
            aria-label={t('shopping.moveItem', { name })}
            className="flex-1 min-w-0 min-h-[52px] pl-0.5 flex items-center gap-3.5 text-left"
          >
            {text}
          </button>
        </>
      ) : (
        <label className={`flex-1 min-w-0 min-h-[52px] flex items-center gap-3.5 ${disabled ? '' : 'cursor-pointer'}`}>
          {circle}
          {text}
        </label>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('shopping.removeItem', { name })}
          className="w-11 h-11 -mr-3 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </li>
  );
}
