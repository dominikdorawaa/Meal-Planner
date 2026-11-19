import { useLayoutEffect, useRef } from 'react';

export function fitTextareaHeight(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  if (textarea.scrollHeight > 0) {
    const borders = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borders}px`;
  }
}

export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    if (ref.current) fitTextareaHeight(ref.current);
  }, [value]);
  return ref;
}
