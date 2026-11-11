import { useState, type ReactNode, type UIEvent } from 'react';
import { t } from '../i18n';
import type { RecipeImage } from '../lib/recipeImage';
import { RecipeCoverImage } from './RecipeCoverImage';

export function RecipeGallery({ images, alt, children }: { images: RecipeImage[]; alt: string; children?: ReactNode }) {
  const [current, setCurrent] = useState(0);
  const count = images.length;
  const shown = Math.min(current, Math.max(0, count - 1));

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth > 0) setCurrent(Math.round(scrollLeft / clientWidth));
  };

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-[4/3] bg-surface-container-highest shrink-0 overflow-hidden sm:rounded-b-[32px]">
      {count === 0 ? (
        <RecipeCoverImage image={null} alt={alt} className="absolute inset-0 w-full h-full" imgClassName="w-full h-full object-cover" />
      ) : (
        <div
          data-testid="recipe-gallery"
          onScroll={handleScroll}
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <div key={image.url} className="relative w-full h-full shrink-0 snap-center snap-always">
              <RecipeCoverImage
                image={image}
                alt={count > 1 ? t('recipeDetails.photoOf', { name: alt, index: index + 1, count }) : alt}
                className="absolute inset-0 w-full h-full"
                imgClassName="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
      {count > 1 && (
        <>
          <span className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full" aria-hidden="true">
            {shown + 1}/{count}
          </span>
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none" aria-hidden="true">
            {images.map((image, index) => (
              <span
                key={image.url}
                data-testid="recipe-gallery-dot"
                className={`h-1.5 rounded-full transition-all ${index === shown ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
