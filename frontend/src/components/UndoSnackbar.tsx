import { useEffect } from 'react';
import { t } from '../i18n';

export const UNDO_SNACKBAR_DURATION_MS = 6000;

type UndoSnackbarProps = {
  message: string;
  onUndo?: () => void;
  onClose: () => void;
  durationMs?: number;
};

export function UndoSnackbar({ message, onUndo, onClose, durationMs = UNDO_SNACKBAR_DURATION_MS }: UndoSnackbarProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [onClose, durationMs]);

  return (
    <div role="status" className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-max max-w-[min(92%,420px)] min-h-12 bg-surface-container-highest text-on-surface rounded-[24px] shadow-ambient flex items-center gap-2.5 py-1 pl-4 pr-1 z-[240] animate-fade-in">
      {onUndo && <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">check</span>}
      <span className={`text-sm font-medium py-2 ${onUndo ? '' : 'pr-3'}`}>{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          aria-label={t('plan.snackbar.undo')}
          className="relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 active:scale-95 transition-colors"
        >
          <svg aria-hidden="true" viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
            <circle
              data-testid="undo-countdown"
              cx="20"
              cy="20"
              r="18"
              pathLength={100}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="undo-countdown"
              style={{ animationDuration: `${durationMs}ms` }}
            />
          </svg>
          <span aria-hidden="true" className="material-symbols-outlined text-[21px]">undo</span>
        </button>
      )}
    </div>
  );
}
