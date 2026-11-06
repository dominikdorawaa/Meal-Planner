import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { useBottomSheet } from '../lib/bottomSheet';
import { useDialogFocus, useLockPageScroll } from '../lib/dialog';

export interface ConfirmSheetProps {
  question?: string;
  title: string;
  detail?: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  busy?: boolean;
  confirmDisabled?: boolean;
  secondaryAction?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

const CONFIRM_TONE = {
  danger: 'bg-danger text-on-danger',
  neutral: 'bg-primary text-on-primary',
};

export function ConfirmSheet({
  question,
  title,
  detail,
  description,
  confirmLabel,
  cancelLabel = t('common.cancel'),
  tone = 'danger',
  busy = false,
  confirmDisabled = false,
  secondaryAction,
  onConfirm,
  onCancel,
  children,
}: ConfirmSheetProps) {
  const ids = useId();
  const questionId = `${ids}-question`;
  const titleId = `${ids}-title`;
  const descriptionId = `${ids}-description`;
  const requestCancel = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);
  const swipeRef = useBottomSheet(true, onCancel, busy);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useCallback((sheet: HTMLDivElement | null) => {
    dialogRef.current = sheet;
    return swipeRef(sheet);
  }, [swipeRef]);
  useLockPageScroll();
  useDialogFocus(dialogRef, requestCancel);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus({ preventScroll: true });
  }, []);

  return createPortal(
    <div data-scroll-lock className="fixed inset-0 z-[240] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={requestCancel}>
      <div
        ref={sheetRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={question ? `${questionId} ${titleId}` : titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="w-full sm:max-w-xl mx-auto bg-surface rounded-t-[32px] pt-4 max-h-[85dvh] flex flex-col animate-slide-up shadow-2xl outline-none"
        onClick={event => event.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6 shrink-0" />
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6">
          {question && <p id={questionId} className="text-sm font-semibold text-on-surface-variant mb-1.5">{question}</p>}
          <h2 id={titleId} className="font-headline font-bold text-[26px] leading-[1.15] tracking-[-0.02em] text-on-surface text-balance break-words">{title}</h2>
          {detail && <p className="mt-1.5 text-sm text-on-surface-variant line-clamp-2 break-words">{detail}</p>}
          {children && <div className="mt-4">{children}</div>}
          {description && <p id={descriptionId} className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">{description}</p>}
        </div>
        <div className="shrink-0 px-6 pt-7 pb-safe-6 flex flex-col gap-2.5">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={busy}
              className="w-full h-14 rounded-2xl bg-primary/10 text-primary font-bold active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          )}
          <div className="flex gap-2.5">
            <button
              ref={cancelRef}
              type="button"
              onClick={requestCancel}
              disabled={busy}
              className="flex-1 min-w-0 h-14 px-3 rounded-2xl bg-surface-container-highest text-on-surface font-bold leading-tight active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || confirmDisabled}
              className={`flex-1 min-w-0 h-14 px-3 rounded-2xl font-bold leading-tight flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 ${CONFIRM_TONE[tone]}`}
            >
              {busy && <span aria-hidden="true" className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
