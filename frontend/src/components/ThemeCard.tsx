import { useRef, useState, type KeyboardEvent } from 'react';
import { t, type MessageKey } from '../i18n';
import { getThemePreference, setThemePreference, type ThemePreference } from '../lib/theme';

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp'];

const OPTIONS: { value: ThemePreference; icon: string; label: MessageKey }[] = [
  { value: 'dark', icon: 'dark_mode', label: 'theme.dark' },
  { value: 'light', icon: 'light_mode', label: 'theme.light' },
  { value: 'system', icon: 'contrast', label: 'theme.system' },
];

export function ThemeCard() {
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (value: ThemePreference) => {
    setThemePreference(value);
    setPreference(value);
  };

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREVIOUS_KEYS.includes(event.key) ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const currentIndex = OPTIONS.findIndex((option) => option.value === preference);
    const nextIndex = (currentIndex + step + OPTIONS.length) % OPTIONS.length;
    choose(OPTIONS[nextIndex].value);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={t('theme.title')} onKeyDown={moveSelection} className="bg-surface-container-low rounded-[22px] px-3.5 divide-y divide-outline-variant/10">
      {OPTIONS.map((option, index) => {
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(option.value)}
            className="w-full min-h-[56px] flex items-center gap-3.5 text-left transition-opacity active:opacity-60"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">{option.icon}</span>
            <span className="flex-1 text-base font-medium text-on-surface">{t(option.label)}</span>
            <span aria-hidden="true" className={`material-symbols-outlined text-[22px] text-primary transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}>check</span>
          </button>
        );
      })}
    </div>
  );
}
