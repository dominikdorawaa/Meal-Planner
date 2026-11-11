import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecipePhotoFocusSheet } from './RecipePhotoFocusSheet';
import { t } from '../i18n';

afterEach(() => {
  cleanup();
});

const image = { url: 'https://example.com/wide.jpg', focus_x: 50, focus_y: 50 };

function renderSheet(isMain = false) {
  const handlers = { onDone: vi.fn(), onMakeMain: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() };
  render(<RecipePhotoFocusSheet image={image} isMain={isMain} {...handlers} />);
  const frame = screen.getByTestId('recipe-photo-focus-frame');
  const photo = frame.querySelector('img')!;
  Object.defineProperty(photo, 'naturalWidth', { value: 1600 });
  Object.defineProperty(photo, 'naturalHeight', { value: 900 });
  frame.getBoundingClientRect = () => ({ width: 400, height: 300 }) as DOMRect;
  return { handlers, frame, photo };
}

describe('RecipePhotoFocusSheet', () => {
  it('moves the framing while dragging and saves it with done', () => {
    const { handlers, frame, photo } = renderSheet();

    fireEvent.pointerDown(frame, { pointerId: 1, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 160, clientY: 190 });
    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 100, clientY: 100 });

    expect(photo.style.objectPosition).toBe('80% 50%');
    fireEvent.click(screen.getByRole('button', { name: t('recipePhoto.done') }));
    expect(handlers.onDone).toHaveBeenCalledWith({ ...image, focus_x: 80 });
  });

  it('ignores moves without a pressed pointer and other keys', () => {
    const { handlers, frame, photo } = renderSheet();

    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerDown(frame, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerCancel(frame, { pointerId: 1 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 300, clientY: 10 });
    fireEvent.keyDown(frame, { key: 'Enter' });

    expect(photo.style.objectPosition).toBe('50% 50%');
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onDone).not.toHaveBeenCalled();
  });

  it('makes the photo main with its new framing or removes it', () => {
    const { handlers, frame } = renderSheet();

    fireEvent.keyDown(frame, { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.makeMain')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.remove')) }));

    expect(handlers.onMakeMain).toHaveBeenCalledWith({ ...image, focus_x: 45 });
    expect(handlers.onRemove).toHaveBeenCalledOnce();
  });

  it('does not offer making the main photo main again', () => {
    renderSheet(true);

    expect(screen.queryByRole('button', { name: new RegExp(t('recipePhoto.makeMain')) })).toBeNull();
  });
});
