import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecipePhotoSheet } from './RecipePhotoSheet';
import { t } from '../i18n';

afterEach(() => {
  cleanup();
});

describe('RecipePhotoSheet', () => {
  it('offers the camera and the gallery and passes the chosen photos', () => {
    const onPick = vi.fn();
    render(<RecipePhotoSheet onPick={onPick} onClose={vi.fn()} />);
    const camera = screen.getByTestId('recipe-photo-camera') as HTMLInputElement;
    const gallery = screen.getByTestId('recipe-photo-gallery') as HTMLInputElement;
    const cameraClick = vi.spyOn(camera, 'click');
    const galleryClick = vi.spyOn(gallery, 'click');

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.camera')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.gallery')) }));
    const first = new File(['photo'], 'first.jpg', { type: 'image/jpeg' });
    const second = new File(['photo'], 'second.jpg', { type: 'image/jpeg' });
    fireEvent.change(gallery, { target: { files: [first, second] } });

    expect(cameraClick).toHaveBeenCalledOnce();
    expect(galleryClick).toHaveBeenCalledOnce();
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(camera.multiple).toBe(false);
    expect(gallery.hasAttribute('capture')).toBe(false);
    expect(gallery.multiple).toBe(true);
    expect(onPick).toHaveBeenCalledWith([first, second]);
  });

  it('ignores an empty choice and closes when tapping outside', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<RecipePhotoSheet onPick={onPick} onClose={onClose} />);

    fireEvent.change(screen.getByTestId('recipe-photo-gallery'), { target: { files: [] } });
    fireEvent.click(screen.getByRole('dialog').parentElement!);

    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
