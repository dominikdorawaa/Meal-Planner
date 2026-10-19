import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecipeDeleteSheet } from './RecipeDeleteSheet';
import { RecipePhotoSheet } from './RecipePhotoSheet';
import { t } from '../i18n';

const RECIPE = { id: 'r1', name: 'Owsianka', image_url: 'https://storage.example.com/photo.jpg' };

afterEach(() => {
  cleanup();
});

describe('RecipeDeleteSheet', () => {
  it('shows the recipe with its photo and the effect of deleting it', () => {
    const onConfirm = vi.fn();
    render(<RecipeDeleteSheet recipe={RECIPE} deleting={false} onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.getByRole('alertdialog', { name: t('recipeDelete.title') })).toBeTruthy();
    expect(screen.getByText('Owsianka')).toBeTruthy();
    expect(screen.getByText(t('recipeDelete.text'))).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe(RECIPE.image_url);

    fireEvent.click(screen.getByRole('button', { name: t('recipeDelete.confirm') }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('closes when tapping outside', () => {
    const onCancel = vi.fn();
    render(<RecipeDeleteSheet recipe={RECIPE} deleting={false} onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('alertdialog').parentElement!);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cannot be closed or confirmed twice while deleting', () => {
    const onCancel = vi.fn();
    render(<RecipeDeleteSheet recipe={RECIPE} deleting onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('alertdialog').parentElement!);

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: t('recipeDelete.confirm') }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: t('common.cancel') }).hasAttribute('disabled')).toBe(true);
  });
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
