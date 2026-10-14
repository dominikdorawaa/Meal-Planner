export const DEFAULT_RECIPE_IMAGE_URL = `${import.meta.env.BASE_URL}recipe-images/default.webp`;

export function recipeImageCandidates(imageUrl?: string | null): string[] {
  const custom = imageUrl?.trim();
  if (custom && custom !== DEFAULT_RECIPE_IMAGE_URL) return [custom, DEFAULT_RECIPE_IMAGE_URL];
  return [DEFAULT_RECIPE_IMAGE_URL];
}
