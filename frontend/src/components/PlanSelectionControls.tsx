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
      className="w-11 h-11 -my-1 rounded-full flex items-center justify-center active:scale-90 transition-transform"
    >
      <span
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary text-on-primary' : 'border-on-surface-variant/40'}`}
      >
        {checked && <span className="material-symbols-outlined text-[18px] font-black">check</span>}
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
    <div className="fixed bottom-0 inset-x-0 z-[60] pointer-events-none">
      <div className="max-w-xl mx-auto px-4 pt-3 pb-safe pointer-events-auto">
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="w-full py-4 bg-primary text-on-primary font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          {t('addFood.addSelected', { count })}
        </button>
      </div>
    </div>
  );
}
