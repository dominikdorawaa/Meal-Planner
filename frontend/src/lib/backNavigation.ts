import { useEffect, useRef } from 'react';

const GUARD_KEY = 'overlayGuard';
const EDGE_WIDTH_PX = 24;
const EDGE_SWIPE_DISTANCE_PX = 80;

type Overlay = { close: () => void; isLocked: () => boolean };

const overlays: Overlay[] = [];
let pendingBack = false;
let leaving = false;
let installed = false;

const browserHistory = {
  pushState: History.prototype.pushState,
  replaceState: History.prototype.replaceState,
  go: History.prototype.go,
};

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
    browserHistory.pushState.call(window.history, { ...(window.history.state as object | null), [GUARD_KEY]: true }, '');
  } else if (overlays.length === 0 && onGuard) {
    pendingBack = true;
    window.history.back();
  }
}

function scheduleSync() {
  setTimeout(syncHistory, 0);
}

function handlePopState() {
  if (leaving) {
    leaving = false;
    return;
  }
  if (pendingBack) {
    pendingBack = false;
  } else if (!isGuard(window.history.state)) {
    const top = overlays.at(-1);
    if (top && !top.isLocked()) {
      overlays.pop();
      top.close();
    }
  }
  scheduleSync();
}

function leavePage() {
  overlays.length = 0;
  pendingBack = false;
}

function pushState(this: History, data: unknown, unused: string, url?: string | URL | null) {
  if (!isGuard(window.history.state)) {
    browserHistory.pushState.call(this, data, unused, url);
    return;
  }
  leavePage();
  browserHistory.replaceState.call(this, data, unused, url);
}

function replaceState(this: History, data: unknown, unused: string, url?: string | URL | null) {
  const keepGuard = isGuard(window.history.state) && overlays.length > 0;
  browserHistory.replaceState.call(this, keepGuard ? { ...(data as object | null), [GUARD_KEY]: true } : data, unused, url);
}

function go(this: History, delta = 0) {
  if (delta >= 0 || !isGuard(window.history.state)) {
    browserHistory.go.call(this, delta);
    return;
  }
  leavePage();
  leaving = true;
  browserHistory.go.call(this, delta - 1);
}

export function registerOverlay(close: () => void, isLocked: () => boolean = () => false): () => void {
  const overlay: Overlay = { close, isLocked };
  overlays.push(overlay);
  scheduleSync();
  return () => {
    const index = overlays.indexOf(overlay);
    if (index === -1) return;
    overlays.splice(index, 1);
    scheduleSync();
  };
}

export function useCloseOnBack(open: boolean, onClose: () => void, locked = false) {
  const latest = useRef({ onClose, locked });
  useEffect(() => {
    latest.current = { onClose, locked };
  });
  useEffect(() => {
    if (!open) return;
    return registerOverlay(() => latest.current.onClose(), () => latest.current.locked);
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
  Object.assign(window.history, { pushState, replaceState, go });
  window.addEventListener('popstate', handlePopState);
  const stopEdgeSwipe = isIosStandalone() ? listenForEdgeSwipe() : () => {};
  return () => {
    window.removeEventListener('popstate', handlePopState);
    stopEdgeSwipe();
    Reflect.deleteProperty(window.history, 'pushState');
    Reflect.deleteProperty(window.history, 'replaceState');
    Reflect.deleteProperty(window.history, 'go');
    leavePage();
    leaving = false;
    installed = false;
  };
}
