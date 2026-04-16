import { useEffect, useMemo, useState } from 'react';
import { recipeImageFallbackUrl } from '../lib/recipeImage';

type RecipeLike = { id?: string; name?: string; image_url?: string | null };

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
  const candidates = useMemo(() => {
    const u = recipe.image_url?.trim();
    const fb = recipeImageFallbackUrl(recipe);
    if (u && u !== fb) return [u, fb];
    if (u) return [u];
    return [fb];
  }, [recipe.id, recipe.name, recipe.image_url]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [candidates.join('|')]);

  if (idx >= candidates.length) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center`}
      >
        <span className="material-symbols-outlined text-primary/20 text-4xl">restaurant</span>
      </div>
    );
  }

  return (
    <img
      src={candidates[idx]}
      alt={alt}
      className={imgClassName}
      onError={() => setIdx(i => i + 1)}
    />
  );
}
