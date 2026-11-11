import type { ReactNode } from 'react';
import { t } from '../i18n';
import { RecipeCoverImage } from './RecipeCoverImage';
import { recipeCoverImage, type RecipeImageInput } from '../lib/recipeImage';
import { SelectionCheckbox } from './PlanSelectionControls';

interface ItemBadgesProps {
  own: boolean;
  unverified: boolean;
  calendories?: boolean;
}

export function ItemBadges({ own, unverified, calendories = false }: ItemBadgesProps) {
  if (!own && !unverified && !calendories) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {calendories && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">
          <span aria-hidden="true" className="material-symbols-outlined text-[11px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          {t('food.calendoriesBadge')}
        </span>
      )}
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

interface FoodRowProps {
  name: string;
  kcal: ReactNode;
  amount: string;
  own: boolean;
  unverified: boolean;
  calendories?: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
}

function FoodRow({ name, kcal, amount, own, unverified, calendories, selected, onOpen, onToggleSelected, children }: FoodRowProps & { children: ReactNode }) {
  return (
    <div
      onClick={onOpen}
      className="flex items-center bg-surface-container-lowest p-2.5 rounded-[20px] shadow-sm border border-outline-variant/10 active:scale-[0.98] transition-all cursor-pointer"
    >
      {children}
      <div className="flex flex-col justify-center gap-0.5 px-3 flex-1 min-w-0">
        <h3 className="font-headline font-bold text-[13px] text-on-surface line-clamp-2 leading-relaxed">{name}</h3>
        <ItemBadges own={own} unverified={unverified} calendories={calendories} />
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

export function RecipeRow({ recipe, ...props }: FoodRowProps & { recipe: { name: string; images?: RecipeImageInput[] | null } }) {
  return (
    <FoodRow {...props}>
      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 relative bg-surface-container-highest">
        <RecipeCoverImage
          image={recipeCoverImage(recipe)}
          alt={recipe.name}
          className="absolute inset-0 w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
      </div>
    </FoodRow>
  );
}
