import type { Theme } from './theme';

export const DEFAULT_RECIPE_IMAGE_URLS: Record<Theme, string> = {
  light: `${import.meta.env.BASE_URL}recipe-images/default-light.svg`,
  dark: `${import.meta.env.BASE_URL}recipe-images/default-dark.svg`,
};

export const MAX_RECIPE_IMAGES = 3;
export const CENTER_FOCUS = 50;

export interface RecipeImage {
  url: string;
  focus_x: number;
  focus_y: number;
}

export interface RecipeImageInput {
  url?: string | null;
  focus_x?: number | null;
  focus_y?: number | null;
}

export interface Size {
  width: number;
  height: number;
}

function clampFocus(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return CENTER_FOCUS;
  return Math.min(100, Math.max(0, value));
}

export function newRecipeImage(url: string): RecipeImage {
  return { url, focus_x: CENTER_FOCUS, focus_y: CENTER_FOCUS };
}

export function recipeImages(recipe?: { images?: (RecipeImageInput | null)[] | null } | null): RecipeImage[] {
  return (recipe?.images ?? []).flatMap(image => {
    const url = image?.url?.trim();
    return url ? [{ url, focus_x: clampFocus(image?.focus_x), focus_y: clampFocus(image?.focus_y) }] : [];
  });
}

export function recipeCoverImage(recipe?: { images?: (RecipeImageInput | null)[] | null } | null): RecipeImage | null {
  return recipeImages(recipe)[0] ?? null;
}

export function imagePosition(image: Pick<RecipeImage, 'focus_x' | 'focus_y'>): string {
  return `${image.focus_x}% ${image.focus_y}%`;
}

export function makeMainImage<T>(images: T[], index: number): T[] {
  if (index <= 0 || index >= images.length) return images;
  return [images[index], ...images.slice(0, index), ...images.slice(index + 1)];
}

export function nudgeFocus(image: RecipeImage, step: { x: number; y: number }): RecipeImage {
  return { ...image, focus_x: clampFocus(image.focus_x + step.x), focus_y: clampFocus(image.focus_y + step.y) };
}

export function moveFocus(image: RecipeImage, delta: { x: number; y: number }, frame: Size, natural: Size): RecipeImage {
  if (!frame.width || !frame.height || !natural.width || !natural.height) return image;
  const scale = Math.max(frame.width / natural.width, frame.height / natural.height);
  const overflowX = natural.width * scale - frame.width;
  const overflowY = natural.height * scale - frame.height;
  const shift = (focus: number, move: number, overflow: number) => (
    overflow > 0.5 ? Math.round(clampFocus(focus - (move / overflow) * 100) * 10) / 10 : focus
  );
  return {
    ...image,
    focus_x: shift(image.focus_x, delta.x, overflowX),
    focus_y: shift(image.focus_y, delta.y, overflowY),
  };
}
