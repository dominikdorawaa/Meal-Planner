import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function useLockPageScroll() {
  useEffect(() => {
    const elements = [document.documentElement, document.body];
    const previous = elements.map(element => element.style.overflow);
    elements.forEach(element => { element.style.overflow = 'hidden'; });
    return () => {
      elements.forEach((element, index) => { element.style.overflow = previous[index]; });
    };
  }, []);
}

export function useDialogFocus(dialogRef: RefObject<HTMLDivElement | null>, onClose: () => void) {
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
