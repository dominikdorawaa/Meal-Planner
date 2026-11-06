import type { FocusEvent, MouseEvent, PointerEvent } from 'react';

const pressedToFocus = new WeakSet<HTMLInputElement>();

export function selectFieldValue(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  input.select();
  window.setTimeout(() => {
    if (document.activeElement === input) input.select();
  }, 0);
}

export function selectValueThen(onFocus?: () => void) {
  return (event: FocusEvent<HTMLInputElement>) => {
    selectFieldValue(event);
    onFocus?.();
  };
}

function rememberPress(event: PointerEvent<HTMLInputElement>) {
  if (document.activeElement !== event.currentTarget) pressedToFocus.add(event.currentTarget);
}

function keepSelection(event: MouseEvent<HTMLInputElement>) {
  if (pressedToFocus.delete(event.currentTarget)) event.preventDefault();
}

function forgetPress(event: FocusEvent<HTMLInputElement>) {
  pressedToFocus.delete(event.currentTarget);
}

export const selectOnFocusProps = {
  onFocus: selectFieldValue,
  onPointerDown: rememberPress,
  onMouseUp: keepSelection,
  onBlur: forgetPress,
} as const;
