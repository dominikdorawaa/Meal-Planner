import { useState } from 'react';
import { customRecipeImageUrl, DEFAULT_RECIPE_IMAGE_URLS } from '../lib/recipeImage';

type RecipeLike = { id?: string; name?: string; image_url?: string | null };
type FailedStage = { url: string | null; stage: 'default' | 'placeholder' };

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
  const [failed, setFailed] = useState<FailedStage | null>(null);
  const stage = failed?.url === customUrl ? failed.stage : customUrl ? 'custom' : 'default';

  if (stage === 'custom') {
    return (
      <img
        src={customUrl!}
        alt={alt}
        className={imgClassName}
        onError={() => setFailed({ url: customUrl, stage: 'default' })}
      />
    );
  }

  if (stage === 'default') {
    const showPlaceholder = () => setFailed({ url: customUrl, stage: 'placeholder' });
    return (
      <>
        <img
          src={DEFAULT_RECIPE_IMAGE_URLS.light}
          alt={alt}
          className={`${imgClassName} dark:hidden`}
          onError={showPlaceholder}
        />
        <img
          src={DEFAULT_RECIPE_IMAGE_URLS.dark}
          alt={alt}
          className={`${imgClassName} hidden dark:block`}
          onError={showPlaceholder}
        />
      </>
    );
  }

  return (
    <div
      className={`${className} bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center`}
    >
      <span className="material-symbols-outlined text-primary/20 text-4xl">restaurant</span>
    </div>
  );
}
