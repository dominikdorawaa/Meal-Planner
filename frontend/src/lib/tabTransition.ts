export type SlideDirection = 'forward' | 'backward';

export const SLIDE_ATTRIBUTE = 'data-tab-slide';
const RENDER_TIMEOUT_MS = 400;

let pendingRender: (() => void) | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function runTabTransition(direction: SlideDirection, update: () => void) {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.setAttribute(SLIDE_ATTRIBUTE, direction);
  const transition = document.startViewTransition(() => new Promise<void>(resolve => {
    const finish = () => {
      window.clearTimeout(timeout);
      if (pendingRender === finish) pendingRender = null;
      resolve();
    };
    const timeout = window.setTimeout(finish, RENDER_TIMEOUT_MS);
    pendingRender = finish;
    update();
  }));
  const cleanUp = () => root.removeAttribute(SLIDE_ATTRIBUTE);
  transition.finished.then(cleanUp, cleanUp);
}

export function markNavigationRendered() {
  pendingRender?.();
}
