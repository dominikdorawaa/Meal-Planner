import { useEffect, useRef } from 'react';

const GUARD_KEY = 'overlayGuard';
const EDGE_WIDTH_PX = 24;
const EDGE_SWIPE_DISTANCE_PX = 80;

type Overlay = { close: () => void };

const overlays: Overlay[] = [];
let pendingBack = false;
let installed = false;

function isGuard(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[GUARD_KEY] === true;
}

function withoutGuard(state: unknown): unknown {
  if (!isGuard(state)) return state;
  const rest = { ...(state as Record<string, unknown>) };
  delete rest[GUARD_KEY];
  return rest;
}

function syncHistory() {
  if (!installed || pendingBack) return;
  const onGuard = isGuard(window.history.state);
  if (overlays.length > 0 && !onGuard) {
    window.history.pushState({ ...(window.history.state as object | null), [GUARD_KEY]: true }, '');
  } else if (overlays.length === 0 && onGuard) {
    pendingBack = true;
    window.history.back();
  }
}

function scheduleSync() {
  setTimeout(syncHistory, 0);
}

function handlePopState() {
  if (pendingBack) {
    pendingBack = false;
  } else if (!isGuard(window.history.state)) {
    overlays.pop()?.close();
  }
  scheduleSync();
}

export function registerOverlay(close: () => void): () => void {
  const overlay: Overlay = { close };
  overlays.push(overlay);
  scheduleSync();
  return () => {
    const index = overlays.indexOf(overlay);
    if (index === -1) return;
    overlays.splice(index, 1);
    scheduleSync();
  };
}

export function useCloseOnBack(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    return registerOverlay(() => onCloseRef.current());
  }, [open]);
}

function isIosStandalone(): boolean {
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function listenForEdgeSwipe(): () => void {
  let start: { x: number; y: number } | null = null;

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    start = event.touches.length === 1 && touch.clientX <= EDGE_WIDTH_PX ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    start = null;
    if (dx >= EDGE_SWIPE_DISTANCE_PX && dy < dx / 2) window.history.back();
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
}

export function installBackNavigation(): () => void {
  if (isGuard(window.history.state)) {
    window.history.replaceState(withoutGuard(window.history.state), '');
  }
  installed = true;
  window.addEventListener('popstate', handlePopState);
  const stopEdgeSwipe = isIosStandalone() ? listenForEdgeSwipe() : () => {};
  return () => {
    window.removeEventListener('popstate', handlePopState);
    stopEdgeSwipe();
    overlays.length = 0;
    pendingBack = false;
    installed = false;
  };
}
