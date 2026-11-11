import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { t } from '../i18n';
import { addDaysToIsoDate, daysBetweenIsoDates, formatMonthWithYear, formatShortWeekday, parseIsoDate } from '../lib/planDates';

type PlanWeekStripProps = {
  start: string;
  today: string;
  visibleStart: string;
  visibleCount: number;
  isGoalMet: (date: string) => boolean;
  onSwipeWeek: (weeks: 1 | -1) => void;
  onSelectDay: (date: string) => void;
};

export const SHOWN_DAYS = 7;
export const SWIPE_MS = 260;
const RENDERED_DAYS = SHOWN_DAYS * 3;
const SWIPE_THRESHOLD = 0.15;
const TAP_SLOP_PX = 8;
const DAY_PERCENT = 100 / RENDERED_DAYS;

type Drag = { pointerId: number; x: number; dx: number; width: number };

function GoalLeaf() {
  return (
    <svg aria-hidden="true" data-testid="goal-leaf" viewBox="-2 -2 28 24" className="absolute -right-1.5 -top-1 w-[15px] h-[13px]">
      <path d="M2 18C2 8 8 2 22 2C22 12 16 18 2 18Z" className="fill-primary" stroke="rgb(var(--color-surface))" strokeWidth="3" paintOrder="stroke" />
    </svg>
  );
}

const trackTransform = (dayOffset: number, dragPx = 0) => `translateX(calc(${-(SHOWN_DAYS + dayOffset) * DAY_PERCENT}% + ${dragPx}px))`;

export function PlanWeekStrip({ start, today, visibleStart, visibleCount, isGoalMet, onSwipeWeek, onSelectDay }: PlanWeekStripProps) {
  const locale = t('recipeDetails.locale');
  const trackRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const swipeTimer = useRef(0);
  const clickTimer = useRef(0);
  const shownStart = useRef(start);
  const [swiping, setSwiping] = useState(false);

  const firstDay = addDaysToIsoDate(start, -SHOWN_DAYS);
  const dates = Array.from({ length: RENDERED_DAYS }, (_, index) => addDaysToIsoDate(firstDay, index));
  const weekDates = dates.slice(SHOWN_DAYS, SHOWN_DAYS * 2);
  const browsingAway = !weekDates.includes(today);
  const month = formatMonthWithYear(weekDates[Math.floor(SHOWN_DAYS / 2)], locale);
  const highlightIndex = daysBetweenIsoDates(firstDay, visibleStart);

  const setTrack = (transform: string, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate ? '' : 'none';
    track.style.transform = transform;
  };

  useLayoutEffect(() => {
    const shift = daysBetweenIsoDates(shownStart.current, start);
    shownStart.current = start;
    const highlight = highlightRef.current;
    if (highlight) {
      highlight.style.transition = 'none';
      void highlight.offsetWidth;
      requestAnimationFrame(() => { highlight.style.transition = ''; });
    }
    if (shift === 0 || Math.abs(shift) > SHOWN_DAYS) {
      setTrack(trackTransform(0), false);
      return;
    }
    setTrack(trackTransform(-shift), false);
    void trackRef.current?.offsetWidth;
    requestAnimationFrame(() => setTrack(trackTransform(0), true));
  }, [start]);

  useLayoutEffect(() => () => {
    window.clearTimeout(swipeTimer.current);
    window.clearTimeout(clickTimer.current);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (swiping || drag.current) return;
    suppressClick.current = false;
    drag.current = { pointerId: event.pointerId, x: event.clientX, dx: 0, width: event.currentTarget.clientWidth };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      drag.current = null;
      suppressClick.current = false;
      setTrack(trackTransform(0), true);
      return;
    }
    current.dx = event.clientX - current.x;
    if (!suppressClick.current && Math.abs(current.dx) > TAP_SLOP_PX) {
      suppressClick.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (suppressClick.current) setTrack(trackTransform(0, current.dx), false);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!suppressClick.current) return;
    clickTimer.current = window.setTimeout(() => { suppressClick.current = false; }, 0);
    const far = Math.abs(current.dx) >= current.width * SWIPE_THRESHOLD;
    const weeks = current.dx < 0 ? 1 : -1;
    setTrack(trackTransform(far ? weeks * SHOWN_DAYS : 0), true);
    if (!far) return;
    setSwiping(true);
    swipeTimer.current = window.setTimeout(() => {
      setSwiping(false);
      shownStart.current = addDaysToIsoDate(start, weeks * SHOWN_DAYS);
      onSwipeWeek(weeks);
    }, SWIPE_MS);
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
      <div
        aria-label={t('plan.strip.label')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        className="overflow-hidden touch-pan-y select-none"
      >
        <div
          ref={trackRef}
          data-testid="strip-track"
          className="relative flex transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
          style={{ width: `${(RENDERED_DAYS / SHOWN_DAYS) * 100}%`, transform: trackTransform(0) }}
        >
          <span
            ref={highlightRef}
            aria-hidden="true"
            data-testid="visible-days"
            className="absolute inset-y-0 left-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${visibleCount * DAY_PERCENT}%`, transform: `translateX(${(highlightIndex / visibleCount) * 100}%)` }}
          >
            <span className="absolute inset-y-0 inset-x-1 rounded-2xl bg-surface-container-high" />
          </span>
          {dates.map(date => {
            const weekday = formatShortWeekday(date, locale);
            const dayNumber = parseIsoDate(date)?.getDate();
            const inWeek = weekDates.includes(date);
            const goalMet = isGoalMet(date);
            return (
              <button
                key={date}
                type="button"
                data-strip-day={date}
                aria-label={`${weekday} ${dayNumber}${goalMet ? `, ${t('plan.strip.goalMet')}` : ''}`}
                aria-current={date === today ? 'date' : undefined}
                aria-hidden={inWeek ? undefined : true}
                tabIndex={inWeek ? undefined : -1}
                onClick={() => onSelectDay(date)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold text-on-surface-variant"
                style={{ flex: `0 0 ${DAY_PERCENT}%` }}
              >
                <span>{weekday}</span>
                <span className={`relative w-[30px] h-[30px] rounded-full grid place-items-center font-headline text-[14.5px] font-bold ${date === today ? 'bg-today text-on-today' : 'text-on-surface'}`}>
                  {dayNumber}
                  {goalMet && <GoalLeaf />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
