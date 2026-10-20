import { useEffect, useState } from 'react';

const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

export function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLInputElement) return !element.readOnly && !NON_TEXT_INPUT_TYPES.has(element.type);
  return element.isContentEditable === true;
}

export function useTextEntryFocused(): boolean {
  const [focused, setFocused] = useState(() => isTextEntry(document.activeElement));

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => setFocused(isTextEntry(event.target as Element | null));
    const onFocusOut = (event: FocusEvent) => setFocused(isTextEntry(event.relatedTarget as Element | null));
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!focused) return;
    const observer = new MutationObserver(() => {
      if (!isTextEntry(document.activeElement)) setFocused(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [focused]);

  return focused;
}
