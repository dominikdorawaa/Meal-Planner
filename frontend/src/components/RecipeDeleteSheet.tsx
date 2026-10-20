import { t } from '../i18n';
import { useBottomSheet } from '../lib/bottomSheet';
import { RecipeCoverImage } from './RecipeCoverImage';

interface RecipeDeleteSheetProps {
  recipe: { id?: string; name: string; image_url?: string | null };
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RecipeDeleteSheet({ recipe, deleting, onConfirm, onCancel }: RecipeDeleteSheetProps) {
  const sheetRef = useBottomSheet(true, onCancel, deleting);

  return (
    <div data-scroll-lock className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !deleting && onCancel()}>
      <div
        ref={sheetRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recipe-delete-title"
        aria-describedby="recipe-delete-text"
        className="w-full max-w-xl bg-surface rounded-t-[32px] px-6 pt-4 pb-safe-6 animate-slide-up shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-container-low shrink-0 relative">
            <RecipeCoverImage recipe={recipe} alt="" className="absolute inset-0 w-full h-full" />
          </div>
          <div className="min-w-0">
            <h2 id="recipe-delete-title" className="font-headline font-bold text-lg text-on-surface leading-snug">{t('recipeDelete.title')}</h2>
            <p className="font-bold text-sm text-on-surface-variant truncate">{recipe.name}</p>
          </div>
        </div>
        <p id="recipe-delete-text" className="text-sm text-on-surface-variant mb-6">{t('recipeDelete.text')}</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full h-14 bg-error text-on-error font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting && <span className="w-4 h-4 border-2 border-on-error/30 border-t-on-error rounded-full animate-spin" />}
            {t('recipeDelete.confirm')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="w-full h-14 bg-surface-container-highest text-on-surface font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
