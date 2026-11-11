import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { formatMonthWithYear, formatShortWeekday, parseIsoDate } from '../lib/planDates';

export type StripDay = { date: string; isToday: boolean; goalMet: boolean };

type PlanWeekStripProps = {
  days: StripDay[];
  firstVisible: number;
  settledVisible: number;
  visibleCount: number;
  initialStart?: string;
  onSelectDay: (index: number) => void;
  onShownStartChange?: (date: string) => void;
};

const SHOWN_DAYS = 7;
const SWIPE_SETTLE_MS = 120;

const weekStartIndex = (index: number) => Math.floor(index / SHOWN_DAYS) * SHOWN_DAYS;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function scrollStripTo(strip: HTMLElement, left: number) {
  if (typeof strip.scrollTo === 'function') strip.scrollTo({ left, behavior: 'smooth' });
  else strip.scrollLeft = left;
}

function GoalLeaf() {
  return (
    <svg aria-hidden="true" data-testid="goal-leaf" viewBox="-2 -2 28 24" className="absolute -right-1.5 -top-1 w-[15px] h-[13px]">
      <path d="M2 18C2 8 8 2 22 2C22 12 16 18 2 18Z" className="fill-primary" stroke="rgb(var(--color-surface))" strokeWidth="3" paintOrder="stroke" />
    </svg>
  );
}

export function PlanWeekStrip({ days, firstVisible, settledVisible, visibleCount, initialStart, onSelectDay, onShownStartChange }: PlanWeekStripProps) {
  const locale = t('recipeDetails.locale');
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const settleTimer = useRef(0);
  const programmaticScroll = useRef(false);
  const lastWindowStart = useRef<string | undefined>(undefined);
  const lastStart = days.length - SHOWN_DAYS;
  const [shown, setShown] = useState(() => {
    const restored = days.findIndex(day => day.date === initialStart);
    const start = restored === -1 ? weekStartIndex(settledVisible) : restored;
    return { settled: settledVisible, start: days[clamp(start, 0, lastStart)]?.date };
  });

  const shownIndex = days.findIndex(day => day.date === shown.start);
  if (shown.settled !== settledVisible || shownIndex === -1) {
    const current = shownIndex === -1 ? weekStartIndex(settledVisible) : shownIndex;
    let next = current;
    if (settledVisible < current) next = settledVisible;
    else if (settledVisible + visibleCount > current + SHOWN_DAYS) next = settledVisible + visibleCount - SHOWN_DAYS;
    setShown({ settled: settledVisible, start: days[clamp(next, 0, lastStart)]?.date });
  }

  const startIndex = Math.max(0, shownIndex);
  const windowStart = days[0]?.date;
  const shownDays = days.slice(startIndex, startIndex + SHOWN_DAYS);
  const browsingAway = shownDays.length > 0 && !shownDays.some(day => day.isToday);
  const month = formatMonthWithYear(shownDays[Math.floor(shownDays.length / 2)]?.date, locale);

  useLayoutEffect(() => {
    const strip = scrollRef.current;
    const highlight = highlightRef.current;
    const windowShifted = lastWindowStart.current !== windowStart;
    lastWindowStart.current = windowStart;
    if (windowShifted && highlight) {
      highlight.style.transition = 'none';
      void highlight.offsetWidth;
      requestAnimationFrame(() => { highlight.style.transition = ''; });
    }
    if (!strip || !strip.clientWidth) return;
    const target = startIndex * (strip.clientWidth / SHOWN_DAYS);
    if (Math.abs(strip.scrollLeft - target) < 1) return;
    programmaticScroll.current = true;
    if (windowShifted) strip.scrollLeft = target;
    else scrollStripTo(strip, target);
  }, [startIndex, windowStart]);

  const shownStart = shownDays[0]?.date;
  useEffect(() => {
    if (shownStart) onShownStartChange?.(shownStart);
  }, [shownStart, onShownStartChange]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const handleScroll = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const strip = scrollRef.current;
      if (!strip || !strip.clientWidth) return;
      if (programmaticScroll.current) {
        programmaticScroll.current = false;
        return;
      }
      const dayWidth = strip.clientWidth / SHOWN_DAYS;
      const weeksMoved = Math.round((strip.scrollLeft / dayWidth - startIndex) / SHOWN_DAYS);
      const nextStart = clamp(startIndex + weeksMoved * SHOWN_DAYS, 0, lastStart);
      if (nextStart === startIndex) {
        programmaticScroll.current = true;
        scrollStripTo(strip, startIndex * dayWidth);
        return;
      }
      setShown(previous => ({ ...previous, start: days[nextStart].date }));
      if (settledVisible < nextStart || settledVisible + visibleCount > nextStart + SHOWN_DAYS) onSelectDay(nextStart);
    }, SWIPE_SETTLE_MS);
  };

  return (
    <div>
      <div className="h-12 px-4 pt-1 flex items-center justify-between gap-3">
        <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">{t('plan.title')}</h1>
        <span
          aria-live="polite"
          className={`text-sm font-bold text-primary truncate transition-all duration-200 motion-reduce:transition-none ${browsingAway ? 'opacity-100' : 'opacity-0 translate-x-1'}`}
        >
          {browsingAway ? month : ''}
        </span>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} aria-label={t('plan.strip.label')} className="overflow-x-auto no-scrollbar overscroll-x-contain">
        <div className="relative flex" style={{ width: `${(days.length / SHOWN_DAYS) * 100}%` }}>
          <span
            ref={highlightRef}
            aria-hidden="true"
            data-testid="visible-days"
            className="absolute inset-y-0 left-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${(visibleCount / days.length) * 100}%`, transform: `translateX(${(firstVisible / visibleCount) * 100}%)` }}
          >
            <span className="absolute inset-y-0 inset-x-1 rounded-2xl bg-surface-container-high" />
          </span>
          {days.map((day, index) => {
            const weekday = formatShortWeekday(day.date, locale);
            const dayNumber = parseIsoDate(day.date)?.getDate();
            return (
              <button
                key={day.date}
                type="button"
                data-strip-day={day.date}
                aria-label={`${weekday} ${dayNumber}${day.goalMet ? `, ${t('plan.strip.goalMet')}` : ''}`}
                aria-current={day.isToday ? 'date' : undefined}
                onClick={() => onSelectDay(index)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold text-on-surface-variant"
                style={{ flex: `0 0 ${100 / days.length}%` }}
              >
                <span>{weekday}</span>
                <span className={`relative w-[30px] h-[30px] rounded-full grid place-items-center font-headline text-[14.5px] font-bold ${day.isToday ? 'bg-today text-on-today' : 'text-on-surface'}`}>
                  {dayNumber}
                  {day.goalMet && <GoalLeaf />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
