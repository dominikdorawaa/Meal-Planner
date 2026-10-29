import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useBottomSheet } from '../lib/bottomSheet';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function useLockPageScroll() {
  useEffect(() => {
    const elements = [document.documentElement, document.body];
    const previous = elements.map(element => element.style.overflow);
    elements.forEach(element => { element.style.overflow = 'hidden'; });
    return () => {
      elements.forEach((element, index) => { element.style.overflow = previous[index]; });
    };
  }, []);
}

function useDialogFocus(dialogRef: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (event.key === 'Escape') {
        latestClose.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!first || !dialog.contains(active) || (active === dialog && !event.shiftKey)) {
        event.preventDefault();
        (first ?? dialog).focus();
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [dialogRef]);
}

interface BottomPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomPanel({ title, onClose, children }: BottomPanelProps) {
  const swipeRef = useBottomSheet(true, onClose);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useCallback((sheet: HTMLDivElement | null) => {
    dialogRef.current = sheet;
    return swipeRef(sheet);
  }, [swipeRef]);
  useLockPageScroll();
  useDialogFocus(dialogRef, onClose);

  return createPortal(
    <div data-scroll-lock className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-xl mx-auto bg-surface rounded-t-[32px] px-6 pt-4 pb-safe-6 max-h-[85dvh] overflow-y-auto overscroll-contain animate-slide-up shadow-2xl outline-none"
        onClick={event => event.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-5" />
        <h2 className="font-headline font-bold text-lg text-on-surface mb-4">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
