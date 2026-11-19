import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { t } from '../i18n';
import { fullDayLabel, shortDayLabel } from '../lib/planTarget';

export interface DetailsTarget {
  mealName: string;
  mealColor: string;
  date: string;
  editing: boolean;
  onOpen: () => void;
}

export interface DetailsSaved {
  value: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
}

export interface DetailsMenu {
  label: string;
  expanded?: boolean;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}

const PILL_GAP = 52;

interface DetailsTopBarProps {
  overPhoto: boolean;
  backLabel: string;
  onBack: () => void;
  target?: DetailsTarget | null;
  saved?: DetailsSaved | null;
  menu?: DetailsMenu | null;
  children?: ReactNode;
}

function SingleLine({ target, tone }: { target: DetailsTarget; tone: string }) {
  return (
    <span className="min-w-0 flex items-center gap-2">
      <MealDot color={target.mealColor} />
      <span className="min-w-0 truncate font-bold text-[14.5px]">{target.mealName}</span>
      <span className={`shrink-0 text-[14.5px] whitespace-nowrap ${tone}`}>· {shortDayLabel(target.date)}</span>
    </span>
  );
}

function MealDot({ color }: { color: string }) {
  return <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)` }}></span>;
}

function TargetPill({ target, tone, stacked }: { target: DetailsTarget; tone: string; stacked: boolean }) {
  const fullDate = fullDayLabel(target.date);
  return (
    <button
      type="button"
      disabled={target.editing}
      onClick={target.onOpen}
      aria-haspopup="dialog"
      aria-label={t(target.editing ? 'planTarget.editingIn' : 'planTarget.change', { meal: target.mealName, day: fullDate })}
      className="min-w-0 shrink h-full flex items-center gap-1.5 pl-3 pr-1 text-left active:scale-[0.98] transition-transform disabled:active:scale-100"
    >
      {stacked ? (
        <span data-testid="target-stacked" className="flex-1 min-w-0 flex flex-col leading-tight">
          <span className="flex items-center gap-2 min-w-0">
            <MealDot color={target.mealColor} />
            <span className="min-w-0 truncate font-bold text-[14.5px]">{target.mealName}</span>
          </span>
          <span className={`pl-4 text-[12.5px] whitespace-nowrap ${tone}`}>{fullDate}</span>
        </span>
      ) : (
        <SingleLine target={target} tone={tone} />
      )}
      {!target.editing && <span aria-hidden="true" className={`material-symbols-outlined shrink-0 text-[20px] ${tone}`}>expand_more</span>}
    </button>
  );
}

function useStackedTarget(target: DetailsTarget | null | undefined) {
  const capsuleRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [stacked, setStacked] = useState(false);
  const mealName = target?.mealName;
  const date = target?.date;

  useEffect(() => {
    const capsule = capsuleRef.current;
    const probe = probeRef.current;
    if (!capsule || !probe) return;
    let active = true;
    const measure = () => {
      if (!active || capsule.clientWidth === 0) return;
      const actions = Array.from(capsule.querySelectorAll<HTMLElement>('[data-capsule-action]')).reduce((sum, action) => sum + action.offsetWidth, 0);
      setStacked(probe.scrollWidth > capsule.clientWidth - actions - PILL_GAP);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer) observer.observe(capsule);
    else window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mealName, date]);

  return { capsuleRef, probeRef, stacked };
}

export function DetailsTopBar({ overPhoto, backLabel, onBack, target, saved, menu, children }: DetailsTopBarProps) {
  const { capsuleRef, probeRef, stacked } = useStackedTarget(target);
  const surface = overPhoto ? 'bg-black/55 backdrop-blur-md' : 'bg-surface-container';
  const textTone = overPhoto ? 'text-white' : 'text-on-surface';
  const tone = overPhoto ? 'text-white/70' : 'text-on-surface-variant';
  const iconTone = overPhoto ? 'text-white' : 'text-on-surface-variant';
  const heart = saved && (
    <button
      type="button"
      data-capsule-action
      onClick={saved.onToggle}
      disabled={saved.busy}
      aria-pressed={saved.value}
      aria-label={saved.label}
      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform ${target ? '' : surface} ${saved.value ? 'text-saved' : iconTone}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[22px]" style={saved.value ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
    </button>
  );
  const more = menu && (
    <button
      type="button"
      data-capsule-action
      onClick={menu.onOpen}
      aria-label={menu.label}
      aria-expanded={menu.expanded}
      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-transform ${target ? '' : surface} ${iconTone}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[22px]">more_horiz</span>
    </button>
  );

  return (
    <div className={`relative flex items-center gap-2 px-4 py-2.5 ${overPhoto ? 'dark' : ''}`}>
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-transform ${surface} ${iconTone}`}
      >
        <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
      </button>
      {target ? (
        <div ref={capsuleRef} className={`relative flex-1 min-w-0 h-[50px] rounded-[25px] flex items-center pr-0.5 ${surface} ${textTone}`}>
          <span ref={probeRef} aria-hidden="true" className="invisible absolute left-0 top-0 flex items-center gap-1.5 pl-3 pr-7 whitespace-nowrap pointer-events-none">
            <SingleLine target={target} tone={tone} />
          </span>
          <TargetPill target={target} tone={tone} stacked={stacked} />
          <span className="flex-1 min-w-3"></span>
          {heart}
          {more}
        </div>
      ) : (
        <>
          <span className="flex-1"></span>
          {heart}
          {more}
        </>
      )}
      {children}
    </div>
  );
}
