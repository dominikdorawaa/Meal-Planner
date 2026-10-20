import { useState } from 'react';
import { t, type MessageKey } from '../i18n';
import { firstDayOfMonth, toIsoDate, todayIsoDate } from '../lib/planDates';

const WEEKDAY_KEYS: MessageKey[] = [
  'recipeDetails.weekday.mon',
  'recipeDetails.weekday.tue',
  'recipeDetails.weekday.wed',
  'recipeDetails.weekday.thu',
  'recipeDetails.weekday.fri',
  'recipeDetails.weekday.sat',
  'recipeDetails.weekday.sun',
];

interface MonthCalendarProps {
  selected: string;
  onSelect: (isoDate: string) => void;
}

export function MonthCalendar({ selected, onSelect }: MonthCalendarProps) {
  const [shown, setShown] = useState(() => ({ selected, month: firstDayOfMonth(selected || null) }));
  if (shown.selected !== selected) setShown({ selected, month: firstDayOfMonth(selected || null) });
  const month = shown.month;
  const setMonth = (next: Date) => setShown({ selected, month: next });
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = todayIsoDate();

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <button type="button" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label={t('recipeDetails.previousMonth')} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <span className="text-xs font-black text-on-surface uppercase tracking-widest">{month.toLocaleDateString(t('recipeDetails.locale'), { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label={t('recipeDetails.nextMonth')} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90">
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_KEYS.map(key => (
          <span key={key} className="text-center text-[9px] font-bold text-on-surface-variant/50 py-0.5">{t(key)}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const isoDate = toIsoDate(new Date(year, monthIndex, day));
          const active = selected === isoDate;
          return (
            <button
              key={isoDate}
              type="button"
              aria-pressed={active}
              aria-label={new Date(year, monthIndex, day).toLocaleDateString(t('recipeDetails.locale'), { day: 'numeric', month: 'long' })}
              onClick={() => onSelect(isoDate)}
              className={`w-full aspect-square flex items-center justify-center rounded-full text-xs font-bold transition-all active:scale-90 ${active ? 'bg-primary text-on-primary' : today === isoDate ? 'border border-primary text-primary' : 'text-on-surface hover:bg-surface-container'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
