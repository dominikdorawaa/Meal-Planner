import { useMemo, useState } from 'react';
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
    const fb = recipeImageFallbackUrl({ id: recipe.id, name: recipe.name });
    if (u && u !== fb) return [u, fb];
    if (u) return [u];
    return [fb];
  }, [recipe.id, recipe.name, recipe.image_url]);

  const candidatesKey = candidates.join('|');
  const [failed, setFailed] = useState({ key: candidatesKey, count: 0 });
  const idx = failed.key === candidatesKey ? failed.count : 0;

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
      onError={() => setFailed({ key: candidatesKey, count: idx + 1 })}
    />
  );
}
