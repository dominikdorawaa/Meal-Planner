import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { RecipeFiltersSheet } from '../components/RecipeFiltersSheet';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { OutsidePressLayer } from '../components/OutsidePressLayer';
import { useAppData } from '../lib/AppDataContext';
import { api, type RecipeSummary } from '../lib/apiClient';
import { recipeCoverImage } from '../lib/recipeImage';
import { recentMealItems } from '../lib/mealProducts';
import { isOwnItem } from '../lib/productPermissions';
import {
  DEFAULT_FILTERS,
  QUICK_PRESETS,
  RECIPE_SORTS,
  filterConditions,
  matchingRecipes,
  nearMatches,
  searchCondition,
  sheetFilterCount,
  sortRecipes,
  toggleQuickPreset,
  withoutCondition,
  type ConditionKey,
  type RecipeFilters,
  type RecipeScope,
  type RecipeSort,
} from '../lib/recipeFilters';
import { pluralForm, t, type MessageKey } from '../i18n';

type RecipesView = 'list' | 'grid';

type Snackbar = { message: string; onUndo?: () => void };

export const RECIPES_VIEW_STORAGE_KEY = 'recipes_view';

const NEAR_MATCH_LIMIT = 5;
const SKELETON_ITEMS = 6;

const FILLED = { fontVariationSettings: "'FILL' 1" };

function readView(): RecipesView {
  try {
    return localStorage.getItem(RECIPES_VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function storeView(view: RecipesView) {
  try {
    localStorage.setItem(RECIPES_VIEW_STORAGE_KEY, view);
  } catch {
    return;
  }
}

function roundedAmount(value: unknown): number {
  return Math.round(Number(value) || 0);
}

function HeartIcon({ saved, className }: { saved: boolean; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className} ${saved ? 'text-saved' : ''}`}
      style={saved ? FILLED : undefined}
    >
      favorite
    </span>
  );
}

function saveLabel(recipe: RecipeSummary, saved: boolean): string {
  return t(saved ? 'recipes.unsaveNamed' : 'recipes.saveNamed', { name: recipe.name });
}

function RecipeRow({ recipe, saved, detail, onOpen, onToggleSaved }: {
  recipe: RecipeSummary;
  saved: boolean;
  detail?: string;
  onOpen: () => void;
  onToggleSaved: (event: MouseEvent) => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-surface-container-high last:border-b-0">
      <button type="button" onClick={onOpen} className="flex flex-1 min-w-0 items-center gap-3 py-2.5 text-left active:opacity-70 transition-opacity">
        <span className="relative w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-surface-container-lowest">
          <RecipeCoverImage image={recipeCoverImage(recipe)} alt="" className="absolute inset-0 w-full h-full" />
        </span>
        <span className="flex flex-1 min-w-0 flex-col gap-1">
          <span className="font-headline font-extrabold text-[14.5px] leading-tight tracking-tight text-on-surface line-clamp-2">{recipe.name}</span>
          {detail ? (
            <span className="text-[11px] font-bold text-on-surface-variant">{detail}</span>
          ) : (
            <span className="flex gap-2 text-[11px] font-semibold tabular-nums">
              <span className="text-macro-protein">{t('plan.summary.proteinShort')} <b>{roundedAmount(recipe.protein)}</b></span>
              <span className="text-macro-fat">{t('plan.summary.fatShort')} <b>{roundedAmount(recipe.fat)}</b></span>
              <span className="text-macro-carbs">{t('plan.summary.carbsShort')} <b>{roundedAmount(recipe.carbs)}</b></span>
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-headline font-extrabold text-[15px] leading-none text-primary tabular-nums">{roundedAmount(recipe.kcal)}</span>
          <span className="text-[10.5px] font-semibold text-on-surface-variant mt-0.5">{t('recipes.kcal')}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleSaved}
        aria-pressed={saved}
        aria-label={saveLabel(recipe, saved)}
        className="-mr-2.5 w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant/80 active:scale-90 transition-transform"
      >
        <HeartIcon saved={saved} className="text-[22px]" />
      </button>
    </li>
  );
}

function RecipeTile({ recipe, saved, onOpen, onToggleSaved }: {
  recipe: RecipeSummary;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: (event: MouseEvent) => void;
}) {
  const prepTime = Number(recipe.prep_time) || 0;
  return (
    <li className="relative">
      <button type="button" onClick={onOpen} className="block w-full text-left active:scale-[0.98] transition-transform">
        <span className="relative block aspect-square w-full rounded-2xl overflow-hidden bg-surface-container-lowest">
          <RecipeCoverImage image={recipeCoverImage(recipe)} alt="" className="absolute inset-0 w-full h-full" />
          <span className="dark absolute bottom-2 left-2 h-6 px-2 rounded-lg bg-black/60 backdrop-blur-md flex items-center text-[11.5px] tabular-nums text-white/90">
            <span className="font-headline font-extrabold text-primary">{roundedAmount(recipe.kcal)} {t('recipes.kcal')}</span>
            {prepTime > 0 && (
              <>
                <span aria-hidden="true" className="material-symbols-outlined text-[13px] ml-1.5 mr-0.5">timer</span>
                <span className="font-semibold">{t('recipes.minutes', { count: prepTime })}</span>
              </>
            )}
          </span>
        </span>
        <span className="block mt-2 px-0.5 font-headline font-extrabold text-[14.5px] leading-tight tracking-tight text-on-surface line-clamp-2">{recipe.name}</span>
      </button>
      <button
        type="button"
        onClick={onToggleSaved}
        aria-pressed={saved}
        aria-label={saveLabel(recipe, saved)}
        className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center active:scale-90 transition-transform"
      >
        <span className="dark w-[26px] h-[26px] rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white">
          <HeartIcon saved={saved} className="text-[15px]" />
        </span>
      </button>
    </li>
  );
}

function RecipesSkeleton({ view }: { view: RecipesView }) {
  const items = Array.from({ length: SKELETON_ITEMS }, (_, index) => index);
  return (
    <div role="status" aria-label={t('recipes.loading')} className="motion-safe:animate-pulse">
      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 pt-2">
          {items.map(index => (
            <div key={index}>
              <div className="aspect-square rounded-2xl bg-surface-container-low" />
              <div className="mt-2.5 h-3 w-4/5 rounded-md bg-surface-container-low" />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {items.map(index => (
            <div key={index} className="flex items-center gap-3 py-2.5 border-b border-surface-container-high">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-low shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 w-4/5 rounded-md bg-surface-container-low" />
                <div className="h-2.5 w-2/5 rounded-md bg-surface-container-low" />
              </div>
              <div className="h-4 w-9 mr-8 rounded-md bg-surface-container-low" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Recipes() {
  const { recipes, userMeals, user, loading, refreshRecipes } = useAppData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<RecipeScope>('mine');
  const [sort, setSort] = useState<RecipeSort>('recent');
  const [view, setView] = useState<RecipesView>(readView);
  const [sortOpen, setSortOpen] = useState(false);
  const [filters, setFilters] = useState<RecipeFilters>({ ...DEFAULT_FILTERS });
  const [pendingFilters, setPendingFilters] = useState<RecipeFilters | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);

  useEffect(() => storeView(view), [view]);

  const isSaved = useCallback(
    (recipe: RecipeSummary) => savedOverrides[recipe.id] ?? Boolean(recipe.saved),
    [savedOverrides],
  );

  const scoped = useMemo(
    () => scope === 'all' ? recipes : recipes.filter((recipe: RecipeSummary) => isOwnItem(recipe, user) || isSaved(recipe)),
    [recipes, scope, user, isSaved],
  );

  const recentIds = useMemo(
    () => recentMealItems(userMeals ?? [], recipes, Number.MAX_SAFE_INTEGER)
      .filter(entry => entry.kind === 'recipe')
      .map(entry => String(entry.item.id)),
    [userMeals, recipes],
  );

  const query = useMemo(() => searchCondition(search), [search]);
  const conditions = useMemo(() => filterConditions(filters), [filters]);
  const allConditions = useMemo(() => (query ? [query, ...conditions] : conditions), [query, conditions]);

  const visible = useMemo(
    () => sortRecipes(matchingRecipes(scoped, allConditions), sort, recentIds),
    [scoped, allConditions, sort, recentIds],
  );

  const near = useMemo(
    () => visible.length === 0 ? nearMatches(sortRecipes(scoped, sort, recentIds), conditions, query, NEAR_MATCH_LIMIT) : [],
    [visible.length, scoped, sort, recentIds, conditions, query],
  );

  const pendingCount = useMemo(
    () => (pendingFilters ? matchingRecipes(scoped, query ? [query, ...filterConditions(pendingFilters)] : filterConditions(pendingFilters)).length : 0),
    [pendingFilters, scoped, query],
  );

  const sheetCount = sheetFilterCount(filters);
  const hasConstraints = allConditions.length > 0;

  const openRecipe = (recipe: RecipeSummary) => navigate(`/recipe/${recipe.id}`);

  const setSaved = async (recipe: RecipeSummary, saved: boolean) => {
    setSavedOverrides(previous => ({ ...previous, [recipe.id]: saved }));
    try {
      if (saved) await api.recipes.save(recipe.id);
      else await api.recipes.unsave(recipe.id);
      await refreshRecipes();
      setSavedOverrides(previous => {
        const next = { ...previous };
        delete next[recipe.id];
        return next;
      });
    } catch {
      setSavedOverrides(previous => ({ ...previous, [recipe.id]: !saved }));
      setSnackbar({ message: t('recipeDetails.savedFailed') });
    }
  };

  const toggleSaved = (recipe: RecipeSummary) => (event: MouseEvent) => {
    event.stopPropagation();
    const next = !isSaved(recipe);
    const disappears = !next && scope === 'mine' && !isOwnItem(recipe, user);
    void setSaved(recipe, next);
    setSnackbar(disappears ? { message: t('recipes.unsaved'), onUndo: () => { setSnackbar(null); void setSaved(recipe, true); } } : null);
  };

  const removeCondition = (key: ConditionKey) => {
    if (key === 'search') setSearch('');
    else setFilters(previous => withoutCondition(previous, key));
  };

  const clearAll = () => {
    setSearch('');
    setFilters({ ...DEFAULT_FILTERS });
  };

  const applyPendingFilters = () => {
    if (pendingFilters) setFilters(pendingFilters);
    setPendingFilters(null);
  };

  const closeSnackbar = useCallback(() => setSnackbar(null), []);

  const chipBase = 'flex-none h-10 px-3.5 rounded-full border text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors active:scale-95';
  const chipIdle = 'border-outline-variant/20 text-on-surface-variant';
  const chipOn = 'border-primary bg-primary/10 text-primary';

  const renderRecipe = (recipe: RecipeSummary, detail?: string) => (view === 'grid' && !detail ? (
    <RecipeTile key={recipe.id} recipe={recipe} saved={isSaved(recipe)} onOpen={() => openRecipe(recipe)} onToggleSaved={toggleSaved(recipe)} />
  ) : (
    <RecipeRow key={recipe.id} recipe={recipe} saved={isSaved(recipe)} detail={detail} onOpen={() => openRecipe(recipe)} onToggleSaved={toggleSaved(recipe)} />
  ));

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-bottom-nav">
      <div className="sticky top-0 z-40 bg-surface pt-safe">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <span aria-hidden="true" className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">search</span>
            <input
              type="text"
              autoComplete="off"
              enterKeyHint="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('recipes.searchPlaceholder')}
              aria-label={t('recipes.searchPlaceholder')}
              className="w-full h-[46px] rounded-2xl bg-surface-container-low pl-11 pr-10 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/80 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('recipes.clearSearch')}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/add-recipe')}
            aria-label={t('recipes.new')}
            className="w-[46px] h-[46px] shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[24px]">add</span>
          </button>
        </div>
      </div>

      <main className="px-4 max-w-2xl mx-auto">
        <div role="radiogroup" aria-label={t('recipes.scope.label')} className="flex bg-surface-container-low rounded-full p-[3px] mt-2.5">
          {(['mine', 'all'] as RecipeScope[]).map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={scope === option}
              onClick={() => setScope(option)}
              className={`flex-1 h-[34px] rounded-full text-[12.5px] font-bold transition-colors ${scope === option ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant'}`}
            >
              {t(`recipes.scope.${option}` as MessageKey)}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 mt-2 pb-1">
          <button
            type="button"
            onClick={() => setPendingFilters({ ...filters })}
            aria-label={sheetCount > 0 ? t('recipes.filters.openActive', { count: sheetCount }) : t('recipes.filters.open')}
            className={`${chipBase} ${chipIdle} text-on-surface`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[17px]">tune</span>
            {t('recipes.filters.title')}
            {sheetCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-extrabold flex items-center justify-center">{sheetCount}</span>
            )}
          </button>
          {QUICK_PRESETS.map(preset => {
            const active = filters.quick.includes(preset.val);
            return (
              <button
                key={preset.val}
                type="button"
                aria-pressed={active}
                title={t(`recipes.filters.quick.${preset.val}.hint` as MessageKey)}
                onClick={() => setFilters(previous => toggleQuickPreset(previous, preset.val))}
                className={`${chipBase} ${active ? chipOn : chipIdle}`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{preset.icon}</span>
                {t(`recipes.filters.quick.${preset.val}` as MessageKey)}
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center justify-between pl-0.5">
          <span className="text-[12.5px] text-on-surface-variant">
            {!loading && t(`recipes.count.${pluralForm(visible.length)}` as MessageKey, { count: visible.length })}
          </span>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setSortOpen(open => !open)}
              aria-haspopup="menu"
              aria-expanded={sortOpen}
              aria-label={`${t('recipes.sort.label')}: ${t(`recipes.sort.${sort}` as MessageKey)}`}
              className="h-10 pl-2.5 pr-1.5 rounded-full flex items-center gap-0.5 text-[12.5px] font-semibold text-on-surface active:bg-surface-container-low"
            >
              {t(`recipes.sort.${sort}` as MessageKey)}
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
            </button>
            <button
              type="button"
              onClick={() => setView(current => current === 'list' ? 'grid' : 'list')}
              aria-label={t(view === 'list' ? 'recipes.view.grid' : 'recipes.view.list')}
              className="w-10 h-10 ml-1 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{view === 'list' ? 'grid_view' : 'view_agenda'}</span>
            </button>
          </div>
          {sortOpen && (
            <>
              <OutsidePressLayer onClose={() => setSortOpen(false)} />
              <div role="menu" aria-label={t('recipes.sort.label')} className="absolute right-12 top-11 z-[200] w-52 rounded-2xl bg-surface-container-high shadow-ambient p-1.5 animate-fade-in">
                {RECIPE_SORTS.map(option => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sort === option}
                    onClick={() => { setSort(option); setSortOpen(false); }}
                    className={`w-full h-11 px-3 rounded-xl flex items-center justify-between text-[13.5px] font-semibold text-on-surface ${sort === option ? 'bg-surface-container-highest' : ''}`}
                  >
                    {t(`recipes.sort.${option}` as MessageKey)}
                    {sort === option && <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">check</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {loading && <RecipesSkeleton view={view} />}

        {!loading && visible.length > 0 && (
          <ul className={view === 'grid' ? 'grid grid-cols-2 gap-x-3 gap-y-4 pt-2 pb-4' : 'pb-4'}>
            {visible.map(recipe => renderRecipe(recipe))}
          </ul>
        )}

        {!loading && visible.length === 0 && !hasConstraints && (
          <div className="pt-3">
            <p className="text-[13.5px] leading-relaxed text-on-surface-variant px-0.5">
              {t(scope === 'mine' ? 'recipes.empty.mine' : 'recipes.empty.all')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/add-recipe')}
              className="mt-3 w-full min-h-[72px] rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-low px-4 flex items-center gap-3 text-left text-primary active:scale-[0.98] transition-transform"
            >
              <span className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold">{t('recipes.empty.add')}</span>
                <span className="text-xs font-medium text-on-surface-variant mt-0.5">{t('recipes.empty.addHint')}</span>
              </span>
            </button>
            {scope === 'mine' && (
              <button
                type="button"
                onClick={() => setScope('all')}
                className="mt-1 h-11 px-0.5 flex items-center gap-1 text-[13.5px] font-bold text-on-surface"
              >
                {t('recipes.empty.browseAll')}
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">arrow_forward</span>
              </button>
            )}
          </div>
        )}

        {!loading && visible.length === 0 && hasConstraints && (
          <div className="pt-6 pb-4">
            <div className="flex flex-col items-center text-center">
              <p className="font-headline font-extrabold text-[15px] text-on-surface">{t('recipes.noResults.title')}</p>
              <p className="text-[12.5px] text-on-surface-variant mt-1">
                {t(conditions.length > 0 ? 'recipes.noResults.filters' : 'recipes.noResults.search')}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {allConditions.map(condition => (
                  <button
                    key={condition.key}
                    type="button"
                    onClick={() => removeCondition(condition.key)}
                    aria-label={t('recipes.noResults.remove', { label: condition.label })}
                    className="h-10 pl-3 pr-2 rounded-full bg-surface-container-low flex items-center gap-1 text-[12.5px] font-semibold text-on-surface active:scale-95 transition-transform"
                  >
                    {condition.label}
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant">close</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={clearAll}
                className="mt-1 h-11 px-2 flex items-center gap-1.5 text-[13.5px] font-bold text-on-surface"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">filter_alt_off</span>
                {t('recipes.noResults.clearAll')}
              </button>
            </div>
            {near.length > 0 && (
              <section aria-labelledby="recipes-near-title" className="mt-5">
                <h2 id="recipes-near-title" className="text-[12.5px] font-semibold text-on-surface-variant px-0.5">{t('recipes.near.title')}</h2>
                <ul>{near.map(match => renderRecipe(match.recipe, match.miss))}</ul>
              </section>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      <RecipeFiltersSheet
        open={pendingFilters !== null}
        filters={pendingFilters ?? filters}
        onChange={setPendingFilters}
        matchCount={pendingCount}
        onApply={applyPendingFilters}
        onClose={() => setPendingFilters(null)}
      />

      {snackbar && <UndoSnackbar message={snackbar.message} onUndo={snackbar.onUndo} onClose={closeSnackbar} />}
    </div>
  );
}
