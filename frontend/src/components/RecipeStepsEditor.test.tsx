import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecipeStepsEditor } from './RecipeStepsEditor';
import { t } from '../i18n';

const steps = [
  { id: 'a', name: 'Sos', text: 'Podsmaż czosnek' },
  { id: 'b', name: '', text: 'Ugotuj makaron' },
  { id: 'c', name: '', text: '' },
];

function rowRect(element: Element) {
  const row = element.closest('[data-step-index]');
  const top = Number(row?.getAttribute('data-step-index') ?? 0) * 100;
  return { x: 0, y: top, top, left: 0, right: 300, bottom: top + 80, width: 300, height: 80, toJSON: () => ({}) } as DOMRect;
}

async function pressKey(element: HTMLElement, code: string) {
  await act(async () => {
    fireEvent.keyDown(element, { code });
  });
}

function renderEditor(list = steps) {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  render(<RecipeStepsEditor steps={list} onChange={onChange} onRemove={onRemove} />);
  return { onChange, onRemove };
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rowRect(this);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RecipeStepsEditor', () => {
  it('shows a name field with the step number as a hint and a touch friendly drag handle', () => {
    renderEditor();

    expect((screen.getByLabelText(t('recipeForm.stepName', { number: 1 })) as HTMLInputElement).value).toBe('Sos');
    expect((screen.getByLabelText(t('recipeForm.stepName', { number: 2 })) as HTMLInputElement).placeholder).toBe('Krok 2');
    expect(screen.getByLabelText(t('recipeForm.stepText', { number: 3 })).className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getByRole('button', { name: t('recipeForm.moveStep', { number: 1 }) }).className).toContain('touch-none');
  });

  it('renders nothing without steps', () => {
    renderEditor([]);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('changes the name and text of a step', () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByLabelText(t('recipeForm.stepName', { number: 2 })), { target: { value: 'Makaron' } });
    expect(onChange).toHaveBeenLastCalledWith([steps[0], { ...steps[1], name: 'Makaron' }, steps[2]]);

    fireEvent.change(screen.getByLabelText(t('recipeForm.stepText', { number: 3 })), { target: { value: 'Podaj' } });
    expect(onChange).toHaveBeenLastCalledWith([steps[0], steps[1], { ...steps[2], text: 'Podaj' }]);
  });

  it('asks to remove the chosen step', () => {
    const { onRemove } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: t('recipeForm.removeStep', { number: 2 }) }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('moves a step with the keyboard through its drag handle', async () => {
    const { onChange } = renderEditor();
    const handle = screen.getByRole('button', { name: t('recipeForm.moveStep', { number: 1 }) });

    handle.focus();
    await pressKey(handle, 'Space');
    await waitFor(() => expect(handle.getAttribute('aria-pressed')).toBe('true'));
    await pressKey(handle, 'ArrowDown');
    await pressKey(handle, 'Space');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([steps[1], steps[0], steps[2]]));
  });

  it('does not report a change when a drag ends where it started', async () => {
    const { onChange } = renderEditor();
    const handle = screen.getByRole('button', { name: t('recipeForm.moveStep', { number: 1 }) });

    handle.focus();
    await pressKey(handle, 'Space');
    await waitFor(() => expect(handle.getAttribute('aria-pressed')).toBe('true'));
    await pressKey(handle, 'Space');

    await waitFor(() => expect(handle.getAttribute('aria-pressed')).not.toBe('true'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
