import { useEffect, useRef } from 'react';
import { neighborTab } from './tabNavigation';

const EDGE_WIDTH_PX = 24;
const MIN_DISTANCE_PX = 60;
const FORM_CONTROLS = 'input, textarea, select, [contenteditable="true"]';
const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll']);

function insideHorizontalScroller(node: Element): boolean {
  for (let current: Element | null = node; current && current !== document.body; current = current.parentElement) {
    if (SCROLLABLE_OVERFLOW.has(getComputedStyle(current).overflowX) && current.scrollWidth > current.clientWidth) return true;
  }
  return false;
}

export function canStartTabSwipe(target: Element | null, x: number, viewportWidth: number): boolean {
  if (!target) return false;
  if (x < EDGE_WIDTH_PX || x > viewportWidth - EDGE_WIDTH_PX) return false;
  if (document.querySelector('[data-scroll-lock]')) return false;
  if (target.closest(FORM_CONTROLS)) return false;
  return !insideHorizontalScroller(target);
}

export function swipeStep(dx: number, dy: number): 1 | -1 | null {
  if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dy) >= Math.abs(dx) / 2) return null;
  return dx < 0 ? 1 : -1;
}

export function useTabSwipe(path: string, enabled: boolean, goToTab: (path: string) => void) {
  const latest = useRef({ path, goToTab });
  useEffect(() => {
    latest.current = { path, goToTab };
  });

  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && canStartTabSwipe(event.target as Element | null, touch.clientX, window.innerWidth)
        ? { x: touch.clientX, y: touch.clientY }
        : null;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const step = swipeStep(touch.clientX - start.x, touch.clientY - start.y);
      start = null;
      const target = step && neighborTab(latest.current.path, step);
      if (target) latest.current.goToTab(target);
    };
    const onTouchCancel = () => {
      start = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled]);
}
