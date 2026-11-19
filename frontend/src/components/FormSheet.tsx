import { useCallback, useId, useRef, type ReactNode } from 'react';
import { useBottomSheet } from '../lib/bottomSheet';
import { useDialogFocus, useLockPageScroll } from '../lib/dialog';

interface FormSheetProps {
  title: string;
  hint?: ReactNode;
  leading?: ReactNode;
  closeLabel: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function FormSheet({ title, hint, leading, closeLabel, busy = false, onClose, children, footer }: FormSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const sheetRef = useBottomSheet(true, onClose, busy);
  const setDialogRef = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node;
    return sheetRef(node);
  }, [sheetRef]);

  useLockPageScroll();
  useDialogFocus(dialogRef, requestClose);

  return (
    <div data-scroll-lock className="fixed inset-0 z-[200] flex flex-col justify-end items-center animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={requestClose} />
      <div
        ref={setDialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[600px] max-h-[90dvh] flex flex-col bg-surface-container-low rounded-t-[28px] pt-3 shadow-ambient border-t border-outline-variant/10 outline-hidden"
      >
        <div className="w-9 h-1 bg-surface-container-highest rounded-full mx-auto mb-4 shrink-0" />
        <div className={`flex gap-3 px-5 pb-3.5 shrink-0 ${leading ? 'items-center' : 'items-start'}`}>
          {leading && <div className="w-12 h-12 shrink-0">{leading}</div>}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 id={titleId} className="font-headline font-extrabold text-[17px] leading-tight tracking-tight text-on-surface line-clamp-2">{title}</h3>
            {hint && <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[12.5px] leading-snug text-on-surface-variant">{hint}</div>}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={requestClose}
            aria-label={closeLabel}
            className="w-10 h-10 self-start shrink-0 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-95 disabled:opacity-50"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5">{children}</div>
        {footer && <div className="shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

interface SheetSubmitProps {
  label: string;
  busy: boolean;
  disabled?: boolean;
  form?: string;
  onClick?: () => void;
}

export function SheetSubmit({ label, busy, disabled = false, form, onClick }: SheetSubmitProps) {
  return (
    <button
      type={form ? 'submit' : 'button'}
      form={form}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      onClick={onClick}
      className={`w-full h-[52px] rounded-full bg-primary text-on-primary font-bold text-[15px] flex items-center justify-center active:scale-[0.98] transition-all disabled:active:scale-100 ${busy ? '' : 'disabled:bg-surface-container-highest disabled:text-on-surface-variant/60'}`}
    >
      {busy ? (
        <>
          <span aria-hidden="true" className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
          <span className="sr-only">{label}</span>
        </>
      ) : label}
    </button>
  );
}
