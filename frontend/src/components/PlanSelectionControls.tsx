import { t } from '../i18n';

interface SelectionCheckboxProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
}

export function SelectionCheckbox({ checked, label, onToggle }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={t('addFood.selectItem', { name: label })}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
      className="w-11 h-11 rounded-full flex items-center justify-center outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-90 transition-transform"
    >
      <span
        aria-hidden="true"
        className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors ${checked ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant/45'}`}
      >
        {checked && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
      </span>
    </button>
  );
}

interface AddSelectedBarProps {
  count: number;
  adding: boolean;
  onAdd: () => void;
}

export function AddSelectedBar({ count, adding, onAdd }: AddSelectedBarProps) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] pointer-events-none bg-linear-to-t/srgb from-surface via-surface to-surface/0 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-xl mx-auto px-4 pointer-events-auto">
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="w-full h-[52px] bg-primary text-on-primary font-bold text-[15px] rounded-full active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center"
        >
          {t('addFood.addSelected', { count })}
        </button>
      </div>
    </div>
  );
}
