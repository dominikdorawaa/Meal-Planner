import { useEffect } from 'react';
import { t } from '../i18n';

export const UNDO_SNACKBAR_DURATION_MS = 6000;

type UndoSnackbarProps = {
  message: string;
  onUndo?: () => void;
  onClose: () => void;
};

export function UndoSnackbar({ message, onUndo, onClose }: UndoSnackbarProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, UNDO_SNACKBAR_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div role="status" className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] bg-on-surface text-surface rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between gap-3 z-[240] animate-slide-up">
      <span className="text-sm font-medium">{message}</span>
      {onUndo && (
        <button type="button" onClick={onUndo} className="text-sm font-bold uppercase tracking-wide text-primary-container shrink-0 px-2 py-1 rounded-lg active:scale-95">
          {t('plan.snackbar.undo')}
        </button>
      )}
    </div>
  );
}
