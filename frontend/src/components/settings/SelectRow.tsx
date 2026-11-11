type SelectRowProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function SelectRow<T extends string>({ label, value, options, onChange }: SelectRowProps<T>) {
  return (
    <div className="min-h-[56px] flex items-center gap-3">
      <span aria-hidden="true" className="shrink-0 text-base font-medium text-on-surface">{label}</span>
      <span className="relative flex-1 min-w-0 flex justify-end">
        <select
          aria-label={label}
          value={value}
          onChange={event => onChange(event.target.value as T)}
          className="appearance-none max-w-full h-10 rounded-xl bg-surface-container pl-3.5 pr-9 text-[15px] font-medium text-on-surface outline-none border-[1.5px] border-transparent focus:border-primary truncate"
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-on-surface-variant">expand_more</span>
      </span>
    </div>
  );
}
