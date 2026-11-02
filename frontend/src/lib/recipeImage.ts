import type { Theme } from './theme';

export const DEFAULT_RECIPE_IMAGE_URLS: Record<Theme, string> = {
  light: `${import.meta.env.BASE_URL}recipe-images/default-light.svg`,
  dark: `${import.meta.env.BASE_URL}recipe-images/default-dark.svg`,
};

export function customRecipeImageUrl(imageUrl?: string | null): string | null {
  return imageUrl?.trim() || null;
}
