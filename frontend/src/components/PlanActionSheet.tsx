import { useCallback, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { RecipeCoverImage } from './RecipeCoverImage';
import { useBottomSheet } from '../lib/bottomSheet';
import { useDialogFocus } from '../lib/dialog';

type PlanActionSheetProps = {
  label: string;
  title: string;
  meta: ReactNode;
  leading: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

export function PlanActionSheet({ label, title, meta, leading, onClose, children }: PlanActionSheetProps) {
  const swipeRef = useBottomSheet(true, onClose);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useCallback((sheet: HTMLDivElement | null) => {
    dialogRef.current = sheet;
    return swipeRef(sheet);
  }, [swipeRef]);
  useDialogFocus(dialogRef, onClose);

  return (
    <div data-scroll-lock className="fixed inset-0 bg-black/40 z-[200] flex flex-col justify-end items-center animate-fade-in" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        className="w-full max-w-[600px] bg-surface-container-low rounded-t-[28px] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-ambient border-t border-outline-variant/10 outline-none"
      >
        <div className="w-9 h-1 bg-surface-container-highest rounded-full mx-auto mb-4"></div>
        <div className="flex items-center gap-3 px-5 pb-3.5">
          <div className="w-12 h-12 shrink-0">{leading}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline font-extrabold text-base leading-tight tracking-tight text-on-surface line-clamp-2">{title}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-on-surface-variant min-w-0">{meta}</div>
          </div>
          <button
            type="button"
            aria-label={t('plan.summary.close')}
            onClick={onClose}
            className="w-10 h-10 self-start shrink-0 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PlanActionGroup({ children }: { children: ReactNode }) {
  return <div className="border-t border-outline-variant/10 mx-5 py-1.5 flex flex-col">{children}</div>;
}

type PlanActionProps = {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

export function PlanAction({ icon, label, onClick, danger = false }: PlanActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mx-2 h-[52px] px-2 rounded-2xl flex items-center gap-4 text-left text-[15px] font-medium hover:bg-surface-container active:bg-surface-container-high transition-colors ${danger ? 'text-error' : 'text-on-surface'}`}
    >
      <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${danger ? '' : 'text-on-surface-variant'}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

type PlanSheetThumbProps = {
  kind: 'recipe' | 'product' | 'manual';
  imageUrl?: string | null;
  alt: string;
};

export function PlanSheetThumb({ kind, imageUrl, alt }: PlanSheetThumbProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const frame = 'w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high';
  if (kind === 'recipe') {
    return <RecipeCoverImage recipe={{ image_url: imageUrl }} alt={alt} className={frame} />;
  }
  if (kind === 'product' && imageUrl && failedUrl !== imageUrl) {
    return (
      <div className={frame}>
        <img src={imageUrl} alt={alt} onError={() => setFailedUrl(imageUrl)} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${frame} flex items-center justify-center text-primary`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[22px]">{kind === 'manual' ? 'bolt' : 'nutrition'}</span>
    </div>
  );
}

export function PlanSheetDayBadge({ day, weekday, isToday }: { day: number; weekday: string; isToday: boolean }) {
  return (
    <div aria-hidden="true" className={`w-12 h-12 rounded-[14px] flex flex-col items-center justify-center ${isToday ? 'bg-today text-on-today' : 'bg-surface-container-high text-on-surface'}`}>
      <span className="font-headline font-extrabold text-lg leading-none tabular-nums">{day}</span>
      <span className={`text-[10.5px] font-semibold mt-0.5 ${isToday ? '' : 'text-on-surface-variant'}`}>{weekday}</span>
    </div>
  );
}
