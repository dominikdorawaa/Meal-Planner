import type { ReactNode } from 'react';
import { t } from '../i18n';
import { RecipeCoverImage } from './RecipeCoverImage';
import { SelectionCheckbox } from './PlanSelectionControls';

interface ItemBadgesProps {
  own: boolean;
  unverified: boolean;
}

export function ItemBadges({ own, unverified }: ItemBadgesProps) {
  if (!own && !unverified) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {own && (
        <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">
          {t('food.ownBadge')}
        </span>
      )}
      {unverified && (
        <span className="px-1.5 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant text-[9px] font-black uppercase tracking-wider">
          {t('food.unverifiedBadge')}
        </span>
      )}
    </span>
  );
}

interface SaveHeartButtonProps {
  saved: boolean;
  name: string;
  onToggle: () => void;
  className?: string;
}

export function SaveHeartButton({ saved, name, onToggle, className = '' }: SaveHeartButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={t(saved ? 'food.unsave' : 'food.save', { name })}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
      className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform ${saved ? 'text-error' : 'text-on-surface-variant/60'} ${className}`}
    >
      <span className="material-symbols-outlined text-[20px]" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
    </button>
  );
}

interface FoodRowProps {
  name: string;
  kcal: ReactNode;
  amount: string;
  own: boolean;
  unverified: boolean;
  selected: boolean;
  heart?: { saved: boolean; onToggle: () => void } | null;
  onOpen: () => void;
  onToggleSelected: () => void;
}

function FoodRow({ name, kcal, amount, own, unverified, selected, heart, onOpen, onToggleSelected, children }: FoodRowProps & { children: ReactNode }) {
  return (
    <div
      onClick={onOpen}
      className="flex items-center bg-surface-container-lowest p-2.5 rounded-[20px] shadow-sm border border-outline-variant/10 active:scale-[0.98] transition-all cursor-pointer"
    >
      {children}
      <div className="flex flex-col justify-center gap-0.5 px-3 flex-1 min-w-0">
        <h3 className="font-headline font-bold text-[13px] text-on-surface line-clamp-2 leading-relaxed">{name}</h3>
        <ItemBadges own={own} unverified={unverified} />
      </div>
      <div
        data-testid="food-row-select-area"
        onClick={event => {
          event.stopPropagation();
          onToggleSelected();
        }}
        className="flex items-center self-stretch shrink-0 -my-2.5 -mr-2.5 py-2.5 pr-2.5"
      >
        <div className="flex flex-col items-end justify-center pl-1 pr-1 max-w-[5.5rem]">
          <span className="text-xs font-black whitespace-nowrap max-w-full truncate">{kcal} kcal</span>
          <span className="text-[9px] font-bold text-on-surface-variant uppercase whitespace-nowrap max-w-full truncate">{amount}</span>
        </div>
        {heart && <SaveHeartButton saved={heart.saved} name={name} onToggle={heart.onToggle} className="shrink-0" />}
        <div className="flex items-center justify-center pl-1 border-l border-outline-variant/10 ml-1 shrink-0">
          <SelectionCheckbox checked={selected} label={name} onToggle={onToggleSelected} />
        </div>
      </div>
    </div>
  );
}

export function ProductRow(props: FoodRowProps) {
  return (
    <FoodRow {...props}>
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <span className="material-symbols-outlined text-[24px]">nutrition</span>
      </div>
    </FoodRow>
  );
}

export function RecipeRow({ recipe, ...props }: FoodRowProps & { recipe: { name: string; image_url?: string | null } }) {
  return (
    <FoodRow {...props}>
      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 relative bg-surface-container-highest">
        <RecipeCoverImage
          recipe={recipe}
          alt={recipe.name}
          className="absolute inset-0 w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
      </div>
    </FoodRow>
  );
}
