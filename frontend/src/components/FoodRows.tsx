import type { ReactNode } from 'react';
import { t } from '../i18n';
import { RecipeCoverImage } from './RecipeCoverImage';
import { FoodPlaceholder } from './FoodPlaceholder';
import { recipeCoverImage, type RecipeImageInput } from '../lib/recipeImage';
import { SelectionCheckbox } from './PlanSelectionControls';

interface ItemBadgesProps {
  own: boolean;
  unverified: boolean;
  calendories?: boolean;
  singleLine?: boolean;
}

export function ItemBadges({ own, unverified, calendories = false, singleLine = false }: ItemBadgesProps) {
  if (!own && !unverified && !calendories) return null;
  return (
    <span className={`flex gap-1 ${singleLine ? 'flex-nowrap min-w-0' : 'flex-wrap'}`}>
      {calendories && (
        <span className="inline-flex shrink-0 items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">
          <span aria-hidden="true" className="material-symbols-outlined text-[11px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          {t('food.calendoriesBadge')}
        </span>
      )}
      {own && (
        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">
          {t('food.ownBadge')}
        </span>
      )}
      {unverified && (
        <span className="min-w-0 truncate px-1.5 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant text-[9px] font-black uppercase tracking-wider">
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

function rowDetails({ own, unverified, calendories }: Pick<FoodRowProps, 'own' | 'unverified' | 'calendories'>) {
  return [
    calendories && t('food.calendoriesBadge'),
    own && t('food.ownBadge'),
    unverified && t('food.unverifiedBadge'),
  ].filter(Boolean) as string[];
}

function FoodRow({ name, kcal, amount, own, unverified, calendories, selected, onOpen, onToggleSelected, children }: FoodRowProps & { children: ReactNode }) {
  const details = rowDetails({ own, unverified, calendories });
  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-3 bg-surface-container-low rounded-2xl p-2 pr-0 active:scale-[0.98] transition-transform cursor-pointer"
    >
      {children}
      <div className="flex flex-col justify-center gap-1 flex-1 min-w-0">
        <h3 className="font-headline font-extrabold text-[14px] leading-tight tracking-tight text-on-surface line-clamp-2">{name}</h3>
        <p className="flex flex-nowrap items-center gap-2 min-w-0 text-[11.5px] font-semibold text-on-surface-variant">
          <span className="shrink-0 text-primary tabular-nums">{kcal} kcal</span>
          <span className="shrink-0 tabular-nums">{amount}</span>
          {details.map(detail => (
            <span key={detail} className="min-w-0 truncate before:content-['·'] before:mr-2">{detail}</span>
          ))}
        </p>
      </div>
      <div
        data-testid="food-row-select-area"
        onClick={event => {
          event.stopPropagation();
          onToggleSelected();
        }}
        className="flex items-center self-stretch shrink-0 pr-1"
      >
        <SelectionCheckbox checked={selected} label={name} onToggle={onToggleSelected} />
      </div>
    </div>
  );
}

export function ProductRow(props: FoodRowProps) {
  return (
    <FoodRow {...props}>
      <FoodPlaceholder kind="product" className="w-12 h-12 rounded-xl shrink-0" iconClassName="text-[26px]" />
    </FoodRow>
  );
}

export function RecipeRow({ recipe, ...props }: FoodRowProps & { recipe: { name: string; images?: RecipeImageInput[] | null } }) {
  return (
    <FoodRow {...props}>
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative bg-surface-container-lowest">
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
