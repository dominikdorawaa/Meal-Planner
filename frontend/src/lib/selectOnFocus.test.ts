import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { selectOnFocusProps } from './selectOnFocus';

function renderField() {
  render(createElement('input', { 'aria-label': 'amount', defaultValue: '150', ...selectOnFocusProps }));
  return screen.getByLabelText('amount') as HTMLInputElement;
}

describe('selectOnFocusProps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('selects the whole value on focus and again after the tap settles', () => {
    const input = renderField();
    const select = vi.spyOn(input, 'select');

    input.focus();
    expect(select).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(select).toHaveBeenCalledTimes(2);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(3);
  });

  it('does not select again when the field lost focus before the tap settled', () => {
    const input = renderField();
    const select = vi.spyOn(input, 'select');

    input.focus();
    input.blur();
    vi.runAllTimers();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('keeps the selection when the press that focused the field is released', () => {
    const input = renderField();

    fireEvent.pointerDown(input);
    input.focus();
    expect(fireEvent.mouseUp(input)).toBe(false);
    expect(fireEvent.mouseUp(input)).toBe(true);
  });

  it('lets a press inside an already focused field place the caret', () => {
    const input = renderField();
    input.focus();

    fireEvent.pointerDown(input);
    expect(fireEvent.mouseUp(input)).toBe(true);
  });

  it('forgets a press that ended outside the field once it loses focus', () => {
    const input = renderField();

    fireEvent.pointerDown(input);
    input.focus();
    input.blur();
    input.focus();
    expect(fireEvent.mouseUp(input)).toBe(true);
  });
});
