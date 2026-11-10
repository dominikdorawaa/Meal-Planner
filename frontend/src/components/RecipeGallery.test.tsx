import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecipeGallery } from './RecipeGallery';
import { DEFAULT_RECIPE_IMAGE_URLS } from '../lib/recipeImage';
import { t } from '../i18n';

afterEach(() => {
  cleanup();
});

const images = [
  { url: 'https://example.com/a.jpg', focus_x: 20, focus_y: 30 },
  { url: 'https://example.com/b.jpg', focus_x: 50, focus_y: 50 },
  { url: 'https://example.com/c.jpg', focus_x: 50, focus_y: 50 },
];

function scrollTo(gallery: HTMLElement, left: number, width: number) {
  Object.defineProperty(gallery, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(gallery, 'scrollLeft', { value: left, configurable: true });
  fireEvent.scroll(gallery);
}

describe('RecipeGallery', () => {
  it('shows every photo in its framing with a counter and dots that follow scrolling', () => {
    render(<RecipeGallery images={images} alt="Pasta"><button>save</button></RecipeGallery>);

    const photos = screen.getAllByRole('img');
    expect(photos.map(photo => photo.getAttribute('src'))).toEqual(images.map(image => image.url));
    expect(photos[0].getAttribute('alt')).toBe(t('recipeDetails.photoOf', { name: 'Pasta', index: 1, count: 3 }));
    expect(photos[0].style.objectPosition).toBe('20% 30%');
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'save' })).toBeTruthy();

    scrollTo(screen.getByTestId('recipe-gallery'), 790, 400);

    expect(screen.getByText('3/3')).toBeTruthy();
    expect(screen.getAllByTestId('recipe-gallery-dot').map(dot => dot.className.includes('w-4'))).toEqual([false, false, true]);
  });

  it('ignores scrolling before the gallery has a width', () => {
    render(<RecipeGallery images={images} alt="Pasta" />);

    scrollTo(screen.getByTestId('recipe-gallery'), 100, 0);

    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('shows a single photo without counter or dots', () => {
    render(<RecipeGallery images={images.slice(0, 1)} alt="Pasta" />);

    expect(screen.getByRole('img', { name: 'Pasta' })).toBeTruthy();
    expect(screen.queryByText('1/1')).toBeNull();
    expect(screen.queryByTestId('recipe-gallery-dot')).toBeNull();
  });

  it('shows the default image when the recipe has no photos', () => {
    render(<RecipeGallery images={[]} alt="Pasta" />);

    expect(screen.queryByTestId('recipe-gallery')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Pasta' })[0].getAttribute('src')).toBe(DEFAULT_RECIPE_IMAGE_URLS.light);
  });
});
