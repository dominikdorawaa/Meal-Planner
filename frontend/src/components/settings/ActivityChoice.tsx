import { t, type MessageKey } from '../../i18n';
import { ACTIVITY_LEVELS, type ActivityKind } from './settingsFormat';

type ActivityChoiceProps = {
  kind: ActivityKind;
  value: number;
  kcalPerLevel: number;
  onChange: (value: number) => void;
  label: string;
  showKcal?: boolean;
};

export function ActivityChoice({ kind, value, kcalPerLevel, onChange, label, showKcal = true }: ActivityChoiceProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {ACTIVITY_LEVELS[kind].map((level, index) => {
        const selected = Math.abs(level - value) < 0.001;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(level)}
            className={`w-full text-left flex items-center gap-3.5 rounded-2xl p-3.5 border-[1.5px] transition-colors ${selected ? 'border-primary bg-primary/[0.07]' : 'border-transparent bg-surface-container-lowest'}`}
          >
            <span aria-hidden="true" className={`w-5 h-5 shrink-0 rounded-full border-2 ${selected ? 'border-primary bg-primary shadow-[inset_0_0_0_3px_rgb(var(--color-surface-container-lowest))]' : 'border-on-surface-variant/40'}`}></span>
            <span className="flex-1 min-w-0">
              <span className="block text-base font-semibold text-on-surface">{t(`settings.activity.${kind}${index}` as MessageKey)}</span>
              <span className="block mt-0.5 text-[13.5px] leading-snug text-on-surface-variant">{t(`settings.activity.${kind}${index}Hint` as MessageKey)}</span>
            </span>
            {showKcal && (
              <span className={`shrink-0 text-sm font-bold tabular-nums ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>
                {t('settings.activity.kcal', { kcal: kcalPerLevel * index })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
