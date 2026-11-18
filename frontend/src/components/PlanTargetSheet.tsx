import { useCallback, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { useBottomSheet } from '../lib/bottomSheet';
import { useDialogFocus } from '../lib/dialog';
import type { DayConsumed, SummaryTargets } from '../lib/daySummary';
import { addDaysToIsoDate, parseIsoDate, todayIsoDate } from '../lib/planDates';
import { addToMealLabel, fullDayLabel, shortDayLabel, weekdayShort, weekStartOf } from '../lib/planTarget';
import { DayBalanceCard } from './DayBalanceCard';

export interface PlanTargetMeal {
  id: string;
  name: string;
  color: string;
}

interface PlanTargetSheetProps {
  mode: 'set' | 'add';
  title: string;
  meta?: string;
  leading?: ReactNode;
  date: string;
  mealType: string | null;
  meals: PlanTargetMeal[];
  item: DayConsumed;
  targets: SummaryTargets | null;
  consumedForDay: (date: string) => DayConsumed;
  busy?: boolean;
  onConfirm: (date: string, mealType: string) => void;
  onClose: () => void;
}

function weekLabel(start: string): string {
  const locale = t('recipeDetails.locale');
  const first = parseIsoDate(start)!;
  const last = parseIsoDate(addDaysToIsoDate(start, 6))!;
  const lastLabel = last.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const firstLabel = first.getMonth() === last.getMonth() ? String(first.getDate()) : first.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return `${firstLabel} – ${lastLabel}`;
}

export function PlanTargetSheet({ mode, title, meta, leading, date, mealType, meals, item, targets, consumedForDay, busy = false, onConfirm, onClose }: PlanTargetSheetProps) {
  const [selectedDate, setSelectedDate] = useState(date);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(mealType);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(date));
  const swipeRef = useBottomSheet(true, onClose);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useCallback((sheet: HTMLDivElement | null) => {
    dialogRef.current = sheet;
    return swipeRef(sheet);
  }, [swipeRef]);
  useDialogFocus(dialogRef, onClose);

  const today = todayIsoDate();
  const days = Array.from({ length: 7 }, (_, index) => addDaysToIsoDate(weekStart, index));
  const meal = meals.find(option => option.id === selectedMeal) ?? null;
  const confirmLabel = mode === 'set'
    ? t('planTarget.set', { meal: meal?.name ?? '', day: shortDayLabel(selectedDate, today) })
    : meal ? `${addToMealLabel(meal.id, meals)}, ${shortDayLabel(selectedDate, today)}` : t('planTarget.chooseMeal');

  return (
    <div data-scroll-lock className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'set' ? t('planTarget.whereTitle') : title}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        className="w-full max-w-[600px] max-h-[92dvh] overflow-y-auto overscroll-contain bg-surface-container-low rounded-t-[28px] pt-3 shadow-ambient outline-hidden animate-slide-up"
      >
        <div className="w-9 h-1 bg-surface-container-highest rounded-full mx-auto mb-4"></div>
        <div className="flex items-center gap-3 px-5 pb-3">
          {leading && <div className="w-12 h-12 shrink-0">{leading}</div>}
          <div className="flex-1 min-w-0">
            <h3 className={`font-headline font-extrabold tracking-tight text-on-surface leading-tight line-clamp-2 ${mode === 'set' ? 'text-lg' : 'text-base'}`}>{mode === 'set' ? t('planTarget.whereTitle') : title}</h3>
            {meta && <p className="mt-1 text-[12.5px] text-on-surface-variant">{meta}</p>}
          </div>
          <button
            type="button"
            aria-label={t('plan.summary.close')}
            onClick={onClose}
            className="w-10 h-10 self-start shrink-0 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center active:scale-95 transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex items-center px-3 pb-1">
          <button type="button" aria-label={t('planTarget.previousWeek')} onClick={() => setWeekStart(start => addDaysToIsoDate(start, -7))} className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant active:scale-95">
            <span aria-hidden="true" className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="flex-1 text-center text-sm font-semibold text-on-surface">{weekLabel(weekStart)}</span>
          <button type="button" aria-label={t('planTarget.nextWeek')} onClick={() => setWeekStart(start => addDaysToIsoDate(start, 7))} className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant active:scale-95">
            <span aria-hidden="true" className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 px-4">
          {days.map(day => {
            const isToday = day === today;
            const selected = day === selectedDate;
            const target = Number(targets?.target_kcal) || 0;
            const fill = target > 0 ? Math.min(100, (consumedForDay(day).kcal / target) * 100) : 0;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                aria-label={fullDayLabel(day, today)}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center gap-1.5 pt-2 pb-2.5 rounded-2xl transition-colors ${selected ? 'bg-surface-container-highest' : ''} ${day < today ? 'opacity-45' : ''}`}
              >
                <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>{isToday ? t('recipeDetails.today') : weekdayShort(day)}</span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-headline font-extrabold text-[15px] tabular-nums ${isToday ? 'bg-today text-on-today' : 'text-on-surface'}`}>{parseIsoDate(day)?.getDate()}</span>
                {target > 0 && (
                  <span aria-hidden="true" className={`w-6 h-1 rounded-full overflow-hidden ${selected ? 'bg-surface-container' : 'bg-surface-container-highest'}`}>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${fill}%` }}></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {targets && (
          <div className="mx-4 mt-3">
            <DayBalanceCard key={selectedDate} dayWithoutItem={consumedForDay(selectedDate)} item={item} targets={targets} />
          </div>
        )}

        <h4 className="font-headline font-extrabold text-[15px] tracking-tight text-on-surface px-5 mt-4 mb-2.5">{t('recipeDetails.mealTime')}</h4>
        <div className="flex flex-wrap gap-2 px-4">
          {meals.map(option => {
            const selected = option.id === selectedMeal;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedMeal(option.id)}
                className={`h-11 pl-3.5 pr-4 rounded-full inline-flex items-center gap-2 text-[14.5px] font-semibold transition-colors ${selected ? 'bg-primary/15 text-primary ring-[1.5px] ring-inset ring-primary' : 'bg-surface-container-lowest text-on-surface'}`}
              >
                <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: option.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${option.color} 18%, transparent)` }}></span>
                {option.name}
              </button>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-1 bg-surface-container-low px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!meal || busy}
            onClick={() => meal && onConfirm(selectedDate, meal.id)}
            className="w-full h-[52px] rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-base flex items-center justify-center active:scale-[0.98] transition-transform disabled:bg-surface-container-high disabled:text-on-surface-variant"
          >
            {busy ? <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
