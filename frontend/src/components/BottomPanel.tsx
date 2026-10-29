import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBottomSheet } from '../lib/bottomSheet';

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

interface BottomPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomPanel({ title, onClose, children }: BottomPanelProps) {
  const sheetRef = useBottomSheet(true, onClose);
  useLockPageScroll();

  return createPortal(
    <div data-scroll-lock className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl mx-auto bg-surface rounded-t-[32px] px-6 pt-4 pb-safe-6 max-h-[85dvh] overflow-y-auto overscroll-contain animate-slide-up shadow-2xl"
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
