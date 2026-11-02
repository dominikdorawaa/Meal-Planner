import { useState } from 'react';
import { customRecipeImageUrl, DEFAULT_RECIPE_IMAGE_URLS } from '../lib/recipeImage';
import type { Theme } from '../lib/theme';

type RecipeLike = { id?: string; name?: string; image_url?: string | null };
type ImageFailures = { url: string | null; custom: boolean; themes: Theme[] };

const THEMES: Theme[] = ['light', 'dark'];
const IMAGE_VISIBILITY: Record<Theme, string> = { light: 'dark:hidden', dark: 'hidden dark:block' };
const PLACEHOLDER_VISIBILITY: Record<Theme, string> = { light: 'flex dark:hidden', dark: 'hidden dark:flex' };

export function RecipeCoverImage({
  recipe,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
}: {
  recipe: RecipeLike;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const customUrl = customRecipeImageUrl(recipe.image_url);
  const noFailures: ImageFailures = { url: customUrl, custom: false, themes: [] };
  const [failures, setFailures] = useState<ImageFailures>(noFailures);
  const current = failures.url === customUrl ? failures : noFailures;

  const markFailed = (change: (failed: ImageFailures) => Partial<ImageFailures>) =>
    setFailures((previous) => {
      const failed = previous.url === customUrl ? previous : noFailures;
      return { ...failed, ...change(failed) };
    });

  if (customUrl && !current.custom) {
    return (
      <img
        src={customUrl}
        alt={alt}
        className={imgClassName}
        onError={() => markFailed(() => ({ custom: true }))}
      />
    );
  }

  return (
    <>
      {THEMES.map((theme) =>
        current.themes.includes(theme) ? (
          <div
            key={theme}
            className={`${className} ${PLACEHOLDER_VISIBILITY[theme]} bg-gradient-to-br from-primary/5 to-primary/10 items-center justify-center`}
          >
            <span className="material-symbols-outlined text-primary/20 text-4xl">restaurant</span>
          </div>
        ) : (
          <img
            key={theme}
            src={DEFAULT_RECIPE_IMAGE_URLS[theme]}
            alt={alt}
            className={`${imgClassName} ${IMAGE_VISIBILITY[theme]}`}
            onError={() => markFailed((failed) => ({ themes: [...failed.themes, theme] }))}
          />
        ),
      )}
    </>
  );
}
