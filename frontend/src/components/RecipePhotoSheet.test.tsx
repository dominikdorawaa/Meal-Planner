import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecipePhotoSheet } from './RecipePhotoSheet';
import { t } from '../i18n';

afterEach(() => {
  cleanup();
});

describe('RecipePhotoSheet', () => {
  it('offers the camera and the gallery and passes the chosen photo', () => {
    const onPick = vi.fn();
    render(<RecipePhotoSheet hasPhoto={false} onPick={onPick} onRemove={vi.fn()} onClose={vi.fn()} />);
    const camera = screen.getByTestId('recipe-photo-camera') as HTMLInputElement;
    const gallery = screen.getByTestId('recipe-photo-gallery') as HTMLInputElement;
    const cameraClick = vi.spyOn(camera, 'click');
    const galleryClick = vi.spyOn(gallery, 'click');

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.camera')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.gallery')) }));
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(camera, { target: { files: [file] } });

    expect(cameraClick).toHaveBeenCalledOnce();
    expect(galleryClick).toHaveBeenCalledOnce();
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(gallery.hasAttribute('capture')).toBe(false);
    expect(onPick).toHaveBeenCalledWith(file);
    expect(screen.queryByRole('button', { name: new RegExp(t('recipePhoto.remove')) })).toBeNull();
  });

  it('removes an existing photo and closes when tapping outside', () => {
    const onRemove = vi.fn();
    const onClose = vi.fn();
    render(<RecipePhotoSheet hasPhoto onPick={vi.fn()} onRemove={onRemove} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipePhoto.remove')) }));
    fireEvent.click(screen.getByRole('dialog').parentElement!);

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
