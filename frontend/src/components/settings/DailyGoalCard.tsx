import { t, type MessageKey } from '../../i18n';
import { macroFillClass, type MacroKey } from '../../lib/macroColors';

type DailyGoalCardProps = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  onOpen: () => void;
};

const MACROS: { key: MacroKey; label: MessageKey }[] = [
  { key: 'protein', label: 'plan.summary.protein' },
  { key: 'fat', label: 'plan.summary.fat' },
  { key: 'carbs', label: 'settings.carbsShort' },
];

export function DailyGoalCard({ kcal, protein, fat, carbs, onOpen }: DailyGoalCardProps) {
  const grams: Record<MacroKey, number> = { protein, fat, carbs };

  return (
    <button type="button" onClick={onOpen} className="w-full text-left bg-surface-container-lowest rounded-[22px] p-4 active:scale-[0.99] transition-transform">
      <span className="flex items-center justify-between text-[13.5px] font-semibold text-on-surface-variant">
        {t('settings.dailyGoal')}
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant/50">chevron_right</span>
      </span>
      <span className="mt-1.5 block font-headline font-extrabold tracking-tight text-[32px] leading-none tabular-nums text-primary">
        {kcal}
        <span className="ml-1 font-body text-[15px] font-semibold tracking-normal text-on-surface-variant">kcal</span>
      </span>
      <span className="mt-3 grid grid-cols-3 gap-2.5">
        {MACROS.map(macro => (
          <span key={macro.key} className="text-[13px] text-on-surface-variant tabular-nums">
            <span aria-hidden="true" className={`block h-1 rounded-full mb-1.5 ${macroFillClass[macro.key]}`}></span>
            {t(macro.label)} <b className="font-bold text-on-surface">{grams[macro.key]} g</b>
          </span>
        ))}
      </span>
    </button>
  );
}
