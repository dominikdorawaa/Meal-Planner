type ChoiceListProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function ChoiceList<T extends string>({ label, value, options, onChange }: ChoiceListProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-surface-container-low rounded-[22px] px-3.5 divide-y divide-outline-variant/10">
      {options.map(option => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="w-full min-h-[56px] flex items-center gap-3.5 text-left transition-opacity active:opacity-60"
          >
            <span className="flex-1 text-base font-medium text-on-surface">{option.label}</span>
            <span aria-hidden="true" className={`material-symbols-outlined text-[22px] text-primary transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}>check</span>
          </button>
        );
      })}
    </div>
  );
}
