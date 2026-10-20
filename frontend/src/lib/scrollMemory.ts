import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { isTabPath } from './tabNavigation';
import { markNavigationRendered } from './tabTransition';

const RESTORE_TIMEOUT_MS = 1000;

type Entry = { key: string; path: string };
type Positions = { byEntry: Map<string, number>; byTab: Map<string, number> };

function remember(positions: Positions, entry: Entry, position: number) {
  positions.byEntry.set(entry.key, position);
  if (isTabPath(entry.path)) positions.byTab.set(entry.path, position);
}

function restoreScroll(target: number, onDone: () => void): () => void {
  const deadline = performance.now() + RESTORE_TIMEOUT_MS;
  let frame = 0;
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('touchstart', stop);
    window.removeEventListener('wheel', stop);
    onDone();
  };
  const attempt = () => {
    window.scrollTo(0, target);
    if (Math.abs(window.scrollY - target) <= 1 || performance.now() >= deadline) {
      stop();
      return;
    }
    frame = requestAnimationFrame(attempt);
  };
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('wheel', stop, { passive: true });
  attempt();
  return stop;
}

export function ScrollMemory() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef<Positions>({ byEntry: new Map(), byTab: new Map() });
  const current = useRef<Entry | null>(null);
  const stopRestoring = useRef<(() => void) | null>(null);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const onScroll = () => {
      if (stopRestoring.current || !current.current) return;
      remember(positions.current, current.current, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.history.scrollRestoration = previousRestoration;
      stopRestoring.current?.();
    };
  }, []);

  useLayoutEffect(() => {
    const previous = current.current;
    const entry = { key: location.key, path: location.pathname };
    current.current = entry;
    if (previous?.path !== entry.path) {
      stopRestoring.current?.();
      const fromHistory = navigationType === 'POP' ? positions.current.byEntry.get(entry.key) : undefined;
      const target = fromHistory ?? (isTabPath(entry.path) ? positions.current.byTab.get(entry.path) : undefined) ?? 0;
      let finished = false;
      const stop = restoreScroll(target, () => {
        finished = true;
        stopRestoring.current = null;
        if (current.current === entry) remember(positions.current, entry, window.scrollY);
      });
      if (!finished) stopRestoring.current = stop;
    }
    markNavigationRendered();
  }, [location.key, location.pathname, navigationType]);

  return null;
}
