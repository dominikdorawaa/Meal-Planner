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
    <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex flex-col gap-4 border border-outline-variant/10">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 shrink-0 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">palette</span>
        </div>
        <span className="font-bold text-on-surface text-[15px]">{t('theme.title')}</span>
      </div>
      <div role="radiogroup" aria-label={t('theme.title')} onKeyDown={moveSelection} className="grid grid-cols-3 gap-2 p-1 bg-surface-container-highest/50 rounded-2xl">
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
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${selected ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-primary/5'}`}
            >
              <span className="material-symbols-outlined text-[20px]">{option.icon}</span>
              {t(option.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
