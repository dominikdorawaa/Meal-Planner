import { useCallback, useEffect, useRef } from 'react';

const START_THRESHOLD_PX = 8;
const CLOSE_DISTANCE_RATIO = 0.25;
const CLOSE_VELOCITY_PX_PER_MS = 0.5;
const SETTLE_MS = 200;

function canStartDrag(sheet: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element) || !sheet.contains(target)) return false;
  if (target.closest('input, textarea, select')) return false;
  for (let node: Element | null = target; node; node = node === sheet ? null : node.parentElement) {
    if (node.scrollTop > 0) return false;
  }
  return true;
}

export function attachSwipeDownToClose(sheet: HTMLElement, close: () => void, isLocked: () => boolean = () => false): () => void {
  let start: { x: number; y: number; time: number } | null = null;
  let dragging = false;
  let offset = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const animateTo = (transform: string) => {
    sheet.style.transition = `transform ${SETTLE_MS}ms ease-out`;
    sheet.style.transform = transform;
  };
  const reset = () => {
    sheet.style.transition = '';
    sheet.style.transform = '';
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    dragging = false;
    offset = 0;
    start = event.touches.length === 1 && !isLocked() && canStartDrag(sheet, event.target) ? { x: touch.clientX, y: touch.clientY, time: Date.now() } : null;
  };

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (!dragging) {
      if (Math.abs(dx) < START_THRESHOLD_PX && Math.abs(dy) < START_THRESHOLD_PX) return;
      if (dy <= 0 || Math.abs(dx) > dy) {
        start = null;
        return;
      }
      dragging = true;
      clearTimeout(settleTimer);
      sheet.style.transition = 'none';
    }
    offset = Math.max(0, dy);
    sheet.style.transform = `translateY(${offset}px)`;
    if (event.cancelable) event.preventDefault();
  };

  const finish = (allowClose: boolean) => {
    if (!start || !dragging) {
      start = null;
      return;
    }
    const velocity = offset / Math.max(1, Date.now() - start.time);
    const shouldClose = allowClose && offset > 0 && (offset >= sheet.offsetHeight * CLOSE_DISTANCE_RATIO || velocity >= CLOSE_VELOCITY_PX_PER_MS);
    start = null;
    dragging = false;
    if (shouldClose) {
      animateTo('translateY(100%)');
      settleTimer = setTimeout(() => {
        close();
        settleTimer = setTimeout(reset, SETTLE_MS);
      }, SETTLE_MS);
    } else {
      animateTo('');
      settleTimer = setTimeout(reset, SETTLE_MS);
    }
  };
  const onTouchEnd = () => finish(true);
  const onTouchCancel = () => finish(false);

  sheet.addEventListener('touchstart', onTouchStart, { passive: true });
  sheet.addEventListener('touchmove', onTouchMove, { passive: false });
  sheet.addEventListener('touchend', onTouchEnd);
  sheet.addEventListener('touchcancel', onTouchCancel);
  return () => {
    clearTimeout(settleTimer);
    sheet.removeEventListener('touchstart', onTouchStart);
    sheet.removeEventListener('touchmove', onTouchMove);
    sheet.removeEventListener('touchend', onTouchEnd);
    sheet.removeEventListener('touchcancel', onTouchCancel);
  };
}

export function useSwipeDownToClose<T extends HTMLElement = HTMLDivElement>(onClose: () => void, locked = false) {
  const latest = useRef({ onClose, locked });
  useEffect(() => {
    latest.current = { onClose, locked };
  });
  return useCallback((sheet: T | null) => {
    if (!sheet) return;
    return attachSwipeDownToClose(sheet, () => latest.current.onClose(), () => latest.current.locked);
  }, []);
}
