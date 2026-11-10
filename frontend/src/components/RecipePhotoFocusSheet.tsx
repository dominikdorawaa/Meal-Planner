import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../i18n';
import { useBottomSheet } from '../lib/bottomSheet';
import { imagePosition, moveFocus, nudgeFocus, type RecipeImage } from '../lib/recipeImage';

interface RecipePhotoFocusSheetProps {
  image: RecipeImage;
  isMain: boolean;
  onDone: (image: RecipeImage) => void;
  onMakeMain: (image: RecipeImage) => void;
  onRemove: () => void;
  onClose: () => void;
}

const KEY_STEPS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -5, y: 0 },
  ArrowRight: { x: 5, y: 0 },
  ArrowUp: { x: 0, y: -5 },
  ArrowDown: { x: 0, y: 5 },
};

const optionClass =
  'w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low active:scale-[0.98] transition-all text-left';

export function RecipePhotoFocusSheet({ image, isMain, onDone, onMakeMain, onRemove, onClose }: RecipePhotoFocusSheetProps) {
  const sheetRef = useBottomSheet(true, onClose);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState(image);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    lastPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = lastPoint.current;
    const photo = imageRef.current;
    if (!last || !photo) return;
    const frame = event.currentTarget.getBoundingClientRect();
    const delta = { x: event.clientX - last.x, y: event.clientY - last.y };
    lastPoint.current = { x: event.clientX, y: event.clientY };
    setDraft(current => moveFocus(
      current,
      delta,
      { width: frame.width, height: frame.height },
      { width: photo.naturalWidth, height: photo.naturalHeight },
    ));
  };

  const stopDragging = () => {
    lastPoint.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    setDraft(current => nudgeFocus(current, step));
  };

  return (
    <div data-scroll-lock className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-photo-focus-title"
        className="w-full sm:max-w-xl bg-surface rounded-t-[32px] px-6 pt-4 pb-safe-6 animate-slide-up shadow-2xl flex flex-col gap-2"
        onClick={event => event.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-3" />
        <h2 id="recipe-photo-focus-title" className="font-headline font-bold text-xl text-on-surface">{t('recipePhoto.focusTitle')}</h2>
        <p className="text-sm text-on-surface-variant mb-2">{t('recipePhoto.focusHint')}</p>

        <div
          data-sheet-swipe-ignore
          data-testid="recipe-photo-focus-frame"
          role="application"
          tabIndex={0}
          aria-label={t('recipePhoto.focusFrame')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onKeyDown={handleKeyDown}
          className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-surface-container-highest touch-none cursor-grab active:cursor-grabbing select-none outline-none focus-visible:ring-2 focus-visible:ring-primary mb-2"
        >
          <img
            ref={imageRef}
            src={draft.url}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: imagePosition(draft) }}
          />
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/55 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none">
            <span className="material-symbols-outlined text-[16px]">open_with</span>
            {t('recipePhoto.focusDrag')}
          </span>
        </div>

        {!isMain && (
          <button type="button" className={optionClass} onClick={() => onMakeMain(draft)}>
            <span className="material-symbols-outlined text-primary">star</span>
            <span className="font-bold text-on-surface">{t('recipePhoto.makeMain')}</span>
          </button>
        )}
        <button type="button" className={`${optionClass} bg-error/5`} onClick={onRemove}>
          <span className="material-symbols-outlined text-error">delete</span>
          <span className="font-bold text-error">{t('recipePhoto.remove')}</span>
        </button>
        <button
          type="button"
          onClick={() => onDone(draft)}
          className="w-full py-4 mt-1 font-bold text-on-primary bg-primary rounded-2xl active:scale-[0.98] transition-all"
        >
          {t('recipePhoto.done')}
        </button>
      </div>
    </div>
  );
}
