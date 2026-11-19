import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { fitTextareaHeight, useAutoGrow } from './autoGrow';

function textareaWith(scrollHeight: number, offsetHeight = 0, clientHeight = 0) {
  const textarea = document.createElement('textarea');
  Object.defineProperty(textarea, 'scrollHeight', { value: scrollHeight });
  Object.defineProperty(textarea, 'offsetHeight', { value: offsetHeight });
  Object.defineProperty(textarea, 'clientHeight', { value: clientHeight });
  return textarea;
}

describe('fitTextareaHeight', () => {
  it('grows the field to its whole text including the border', () => {
    const textarea = textareaWith(120, 103, 100);

    fitTextareaHeight(textarea);

    expect(textarea.style.height).toBe('123px');
  });

  it('leaves the natural height when the browser cannot measure the text', () => {
    const textarea = textareaWith(0);

    fitTextareaHeight(textarea);

    expect(textarea.style.height).toBe('auto');
  });
});

function Field({ value }: { value: string }) {
  const ref = useAutoGrow(value);
  return <textarea ref={ref} value={value} readOnly aria-label="text" />;
}

describe('useAutoGrow', () => {
  it('resizes the field again whenever the text changes', () => {
    const { getByLabelText, rerender } = render(<Field value="one" />);
    const textarea = getByLabelText('text') as HTMLTextAreaElement;
    textarea.style.height = '10px';

    rerender(<Field value="one two" />);

    expect(textarea.style.height).toBe('auto');
  });
});
