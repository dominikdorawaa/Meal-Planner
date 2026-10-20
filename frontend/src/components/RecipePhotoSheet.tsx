import { useRef, type ChangeEvent } from 'react';
import { t } from '../i18n';
import { useBottomSheet } from '../lib/bottomSheet';

interface RecipePhotoSheetProps {
  hasPhoto: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  onClose: () => void;
}

const optionClass =
  'w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low active:scale-[0.98] transition-all text-left';

export function RecipePhotoSheet({ hasPhoto, onPick, onRemove, onClose }: RecipePhotoSheetProps) {
  const sheetRef = useBottomSheet(true, onClose);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPick(file);
  };

  return (
    <div data-scroll-lock className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-photo-title"
        className="w-full max-w-xl bg-surface rounded-t-[32px] px-6 pt-4 pb-safe-6 animate-slide-up shadow-2xl flex flex-col gap-2"
        onClick={event => event.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-3" />
        <h2 id="recipe-photo-title" className="font-headline font-bold text-xl text-on-surface mb-2">{t('recipePhoto.title')}</h2>

        <button type="button" className={optionClass} onClick={() => cameraInput.current?.click()}>
          <span className="material-symbols-outlined text-primary">photo_camera</span>
          <span className="font-bold text-on-surface">{t('recipePhoto.camera')}</span>
        </button>
        <button type="button" className={optionClass} onClick={() => galleryInput.current?.click()}>
          <span className="material-symbols-outlined text-primary">photo_library</span>
          <span className="font-bold text-on-surface">{t('recipePhoto.gallery')}</span>
        </button>
        {hasPhoto && (
          <button type="button" className={`${optionClass} bg-error/5`} onClick={onRemove}>
            <span className="material-symbols-outlined text-error">delete</span>
            <span className="font-bold text-error">{t('recipePhoto.remove')}</span>
          </button>
        )}
        <button type="button" onClick={onClose} className="w-full py-4 mt-1 font-bold text-on-surface-variant rounded-2xl active:scale-[0.98] transition-all">
          {t('common.cancel')}
        </button>

        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="recipe-photo-camera"
          onChange={handleFile}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="recipe-photo-gallery"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
