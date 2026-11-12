import type { ReactNode } from 'react';
import { useBottomSheet } from '../lib/bottomSheet';
import { pluralForm, t, type MessageKey } from '../i18n';
import { DEFAULT_FILTERS, PREP_TIME_OPTIONS, prepTimeLabel, type RecipeFilters } from '../lib/recipeFilters';

const KCAL_MAX = 1500;
const PROTEIN_MAX = 100;
const CARBS_MAX = 200;

function SliderBlock({ icon, iconClass, label, value, ends, children }: {
  icon: string;
  iconClass: string;
  label: string;
  value: string;
  ends: [string, string];
  children: ReactNode;
}) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-on-surface flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${iconClass}`}>{icon}</span>
          {label}
        </span>
        <span className="font-headline text-sm font-extrabold text-primary tabular-nums">{value}</span>
      </div>
      {children}
      <div className="flex justify-between text-[10.5px] text-on-surface-variant font-semibold mt-1">
        <span>{ends[0]}</span><span>{ends[1]}</span>
      </div>
    </div>
  );
}

export function RecipeFiltersSheet({ open, filters, onChange, matchCount, onApply, onClose }: {
  open: boolean;
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
  matchCount: number;
  onApply: () => void;
  onClose: () => void;
}) {
  const sheetRef = useBottomSheet(open, onClose);
  if (!open) return null;

  const set = (patch: Partial<RecipeFilters>) => onChange({ ...filters, ...patch });
  const noLimit = t('recipes.filters.noLimitShort');

  return (
    <div
      data-scroll-lock
      data-testid="recipe-filters-backdrop"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-filters-title"
        className="w-full sm:max-w-xl bg-surface rounded-t-[28px] animate-slide-up shadow-ambient max-h-[90dvh] flex flex-col overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 px-5 pt-5 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recipe-filters-title" className="font-headline font-extrabold text-xl text-on-surface tracking-tight">{t('recipes.filters.title')}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('recipes.filters.close')}
              className="w-10 h-10 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="space-y-2.5">
            <SliderBlock
              icon="local_fire_department"
              iconClass="text-primary"
              label={t('recipes.filters.kcal')}
              value={filters.maxKcal !== '' ? t('recipes.filters.upTo', { value: filters.maxKcal }) : noLimit}
              ends={['100 kcal', t('recipes.filters.noLimit')]}
            >
              <input
                type="range" min="100" max={KCAL_MAX} step="50"
                value={filters.maxKcal || KCAL_MAX}
                onChange={event => set({ maxKcal: Number(event.target.value) === KCAL_MAX ? '' : Number(event.target.value) })}
                aria-label={t('recipes.filters.kcal')}
                className="w-full accent-primary"
              />
            </SliderBlock>

            <SliderBlock
              icon="fitness_center"
              iconClass="text-macro-protein"
              label={t('recipes.filters.protein')}
              value={filters.minProtein !== '' ? t('recipes.filters.atLeastGrams', { value: filters.minProtein }) : t('recipes.filters.any')}
              ends={[t('recipes.filters.any'), `${PROTEIN_MAX} g`]}
            >
              <input
                type="range" min="0" max={PROTEIN_MAX} step="5"
                value={filters.minProtein || 0}
                onChange={event => set({ minProtein: Number(event.target.value) === 0 ? '' : Number(event.target.value) })}
                aria-label={t('recipes.filters.protein')}
                className="w-full accent-primary"
              />
            </SliderBlock>

            <SliderBlock
              icon="grain"
              iconClass="text-macro-carbs"
              label={t('recipes.filters.carbs')}
              value={filters.maxCarbs !== '' ? t('recipes.filters.upToGrams', { value: filters.maxCarbs }) : noLimit}
              ends={['0 g', t('recipes.filters.noLimit')]}
            >
              <input
                type="range" min="0" max={CARBS_MAX} step="10"
                value={filters.maxCarbs === '' ? CARBS_MAX : filters.maxCarbs}
                onChange={event => set({ maxCarbs: Number(event.target.value) === CARBS_MAX ? '' : Number(event.target.value) })}
                aria-label={t('recipes.filters.carbs')}
                className="w-full accent-primary"
              />
            </SliderBlock>

            <div className="bg-surface-container-low rounded-2xl p-4">
              <span className="font-bold text-sm text-on-surface flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">timer</span>
                {t('recipes.filters.prepTime')}
              </span>
              <div className="flex flex-wrap gap-2">
                {PREP_TIME_OPTIONS.map(option => {
                  const active = filters.maxPrepTime === option;
                  return (
                    <button
                      key={String(option)}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set({ maxPrepTime: active ? '' : option })}
                      className={`h-10 px-3.5 rounded-xl font-semibold text-xs border transition-colors active:scale-95 whitespace-nowrap ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/20 bg-surface text-on-surface-variant'
                      }`}
                    >
                      {prepTimeLabel(option)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex gap-2.5 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-surface">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, quick: filters.quick })}
            className="h-14 px-5 rounded-2xl bg-surface-container-low text-on-surface font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {t('recipes.filters.reset')}
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 h-14 bg-primary text-on-primary font-extrabold text-base rounded-2xl active:scale-[0.98] transition-transform"
          >
            {t(`recipes.filters.show.${pluralForm(matchCount)}` as MessageKey, { count: matchCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
