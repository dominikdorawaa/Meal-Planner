import { useState, useMemo, useEffect, type ReactNode } from 'react';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Product, type RecipeSummary } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { productDisplayName } from '../lib/productName';
import { LoadMoreTrigger } from '../components/LoadMoreTrigger';
import { recentMealItems } from '../lib/mealProducts';
import { useProductSearch } from '../lib/useProductSearch';
import { useSavedFood } from '../lib/useSavedFood';
import { isCalendoriesProduct, isOwnItem, isUnverified } from '../lib/productPermissions';
import { ProductRow, RecipeRow } from '../components/FoodRows';
import { BottomPanel } from '../components/BottomPanel';
import { PlanTargetMeta, PlanTargetPicker } from '../components/PlanTargetPicker';
import type { MessageKey } from '../i18n';
import { LazyBarcodeScanner } from '../components/LazyBarcodeScanner';
import { useBarcodeLookup } from '../lib/useBarcodeLookup';
import { missingProductMessage } from '../lib/barcodeLookup';
import { BarcodeLookupPending } from '../components/BarcodeLookupPending';
import { NewProductSheet, type NewProductDraft } from '../components/NewProductSheet';
import { t } from '../i18n';
import { profileMealTypes } from '../lib/mealTypes';
import {
  DEFAULT_PRODUCT_GRAMS,
  DEFAULT_RECIPE_PORTIONS,
  PlanSelectionSaveError,
  addSelectionAfterItem,
  addSelectionToPlan,
  finishPlanSelection,
  isSelected,
  newPlanSelection,
  planSelectionState,
  readPlanSelection,
  toggleSelection,
} from '../lib/planSelection';
import type { PlanSelectionKind } from '../lib/planSelection';
import { AddSelectedBar } from '../components/PlanSelectionControls';
import { formatCompactNumber } from '../lib/compactNumber';
import { FIELD_CLASS, LABEL_CLASS, SECTION_LABEL_CLASS, blockNumberSigns } from '../lib/formFields';
import { FormSheet, SheetSubmit } from '../components/FormSheet';
import { FoodPlaceholder } from '../components/FoodPlaceholder';
import { QuickMealFields } from '../components/QuickMealFields';
import { MEAL_LIMITS, acceptsLimitedNumber, isPositiveWithinLimit, numberFieldProps } from '../lib/inputLimits';

type FoodTab = 'recent' | 'saved' | 'own';

const RECENT_ITEMS_LIMIT = 15;
export const URL_SYNC_DELAY_MS = 500;
const FOOD_TABS: { id: FoodTab; label: MessageKey; icon: string }[] = [
  { id: 'recent', label: 'food.tabRecent', icon: 'history' },
  { id: 'saved', label: 'food.tabSaved', icon: 'favorite' },
  { id: 'own', label: 'food.tabOwn', icon: 'person' },
];

function readFoodTab(value: string | null): FoodTab {
  return FOOD_TABS.find(tab => tab.id === value)?.id ?? 'recent';
}

interface NutritionFiltersValues {
  maxKcal: string;
  minProtein: string;
  maxFat: string;
  maxCarbs: string;
}

function matchesFilters(item: { kcal?: unknown; protein?: unknown; fat?: unknown; carbs?: unknown }, filters: NutritionFiltersValues) {
  if (filters.maxKcal !== '' && !(Number(item.kcal) <= Number(filters.maxKcal))) return false;
  if (filters.minProtein !== '' && !(Number(item.protein) >= Number(filters.minProtein))) return false;
  if (filters.maxFat !== '' && !(Number(item.fat) <= Number(filters.maxFat))) return false;
  if (filters.maxCarbs !== '' && !(Number(item.carbs) <= Number(filters.maxCarbs))) return false;
  return true;
}

function FoodSection({ title, empty, children }: { title: string; empty: string | null; children: ReactNode[] }) {
  if (children.length === 0 && !empty) return null;
  return (
    <section className="mb-5">
      <h2 className={`${SECTION_LABEL_CLASS} px-1 mb-2`}>{title}</h2>
      {children.length > 0 ? (
        <div className="flex flex-col gap-2">{children}</div>
      ) : empty && <EmptyBox message={empty} />}
    </section>
  );
}

function EmptyBox({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="py-6 px-4 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/20">
      <p className="text-sm font-medium text-on-surface-variant">{message}</p>
      {children}
    </div>
  );
}

function CreateChip({ icon, label, ariaLabel, onClick }: { icon: string; label: string; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="h-9 pl-1 pr-3 shrink-0 rounded-full bg-surface-container-low flex items-center gap-1.5 text-[13px] font-semibold text-on-surface whitespace-nowrap active:scale-95 transition-transform"
    >
      <span aria-hidden="true" className="relative w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{icon}</span>
        <span className="absolute -right-0.5 -bottom-0.5 w-[13px] h-[13px] rounded-full bg-primary text-on-primary flex items-center justify-center ring-2 ring-surface-container-low">
          <span className="material-symbols-outlined text-[11px] font-bold">add</span>
        </span>
      </span>
      {label}
    </button>
  );
}

function NoResults() {
  return <EmptyBox message={t('food.noResults')} />;
}

function hasFilters(filters: NutritionFiltersValues) {
  return Object.values(filters).some(value => value !== '');
}

function isSearching(query: string, filters: NutritionFiltersValues) {
  return query.trim() !== '' || hasFilters(filters);
}

const EMPTY_FILTERS: NutritionFiltersValues = { maxKcal: '', minProtein: '', maxFat: '', maxCarbs: '' };

const FILTER_FIELDS: { key: keyof NutritionFiltersValues; label: MessageKey; icon: string; placeholder: string; max: number }[] = [
  { key: 'maxKcal', label: 'food.filters.maxKcal', icon: 'local_fire_department', placeholder: 'np. 500', max: MEAL_LIMITS.kcal },
  { key: 'minProtein', label: 'food.filters.minProtein', icon: 'fitness_center', placeholder: 'np. 20', max: MEAL_LIMITS.grams },
  { key: 'maxFat', label: 'food.filters.maxFat', icon: 'water_drop', placeholder: 'np. 15', max: MEAL_LIMITS.grams },
  { key: 'maxCarbs', label: 'food.filters.maxCarbs', icon: 'grain', placeholder: 'np. 50', max: MEAL_LIMITS.grams },
];

function readFilters(params: URLSearchParams): NutritionFiltersValues {
  const filters = { ...EMPTY_FILTERS };
  for (const field of FILTER_FIELDS) {
    const value = params.get(field.key) ?? '';
    if (value !== '' && acceptsLimitedNumber(value, field.max, 0)) filters[field.key] = value;
  }
  return filters;
}

interface AddFoodListState {
  date: string;
  mealType: string;
  tab: FoodTab;
  searchWithinTab: boolean;
  query: string;
  filters: NutritionFiltersValues;
}

function planTargetSearch(date: string, mealType: string) {
  return new URLSearchParams({ selectDate: date, selectType: mealType });
}

function addFoodListSearch({ date, mealType, tab, searchWithinTab, query, filters }: AddFoodListState) {
  const params = planTargetSearch(date, mealType);
  params.set('tab', tab);
  if (searchWithinTab) params.set('withinTab', 'true');
  if (query !== '') params.set('q', query);
  for (const field of FILTER_FIELDS) {
    if (filters[field.key] !== '') params.set(field.key, filters[field.key]);
  }
  return `?${params.toString()}`;
}

export function AddFood() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { recipes, userMeals, profile, user, loading: contextLoading, refreshMeals } = useAppData();

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [activeTab, setActiveTab] = useState<FoodTab>(() => readFoodTab(searchParams.get('tab')));
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NutritionFiltersValues>(() => readFilters(searchParams));
  const [searchWithinTab, setSearchWithinTab] = useState(() => searchParams.get('withinTab') === 'true');

  const listSearch = addFoodListSearch({ date: activeDate, mealType: activeMealType, tab: activeTab, searchWithinTab, query: searchQuery, filters });

  const hasActiveFilters = hasFilters(filters);
  const searching = isSearching(searchQuery, filters);
  const selectedTab = searching && !searchWithinTab ? null : activeTab;

  const changeSearch = (query: string, nextFilters: NutritionFiltersValues) => {
    setSearchQuery(query);
    setFilters(nextFilters);
    if (!isSearching(query, nextFilters)) setSearchWithinTab(false);
  };

  const selectTab = (tab: FoodTab) => {
    if (searching) setSearchWithinTab(!(searchWithinTab && activeTab === tab));
    setActiveTab(tab);
  };
  const productSearch = useProductSearch({
    query: searchQuery,
    filters,
    enabled: searching,
  });
  const savedFood = useSavedFood(recipes);

  const [isAdding, setIsAdding] = useState(false);
  const [selection, setSelection] = useState(() => readPlanSelection(location.state) ?? newPlanSelection());

  const { pathname, search: currentSearch } = location;
  useEffect(() => {
    if (mealId || !selectDate || !selectType || listSearch === currentSearch) return;
    const timeoutId = setTimeout(
      () => navigate(`${pathname}${listSearch}`, { replace: true, state: planSelectionState(selection) }),
      URL_SYNC_DELAY_MS
    );
    return () => clearTimeout(timeoutId);
  }, [listSearch, currentSearch, pathname, mealId, navigate, selectDate, selectType, selection]);
  const toggleItem = (kind: PlanSelectionKind, id: string | number) =>
    setSelection(current => ({ ...current, items: toggleSelection(current.items, kind, id) }));

  const [newProduct, setNewProduct] = useState<NewProductDraft | null>(null);

  const [showScanner, setShowScanner] = useState(false);

  const barcodeLookup = useBarcodeLookup();

  const handleBarCode = (barCode: string) => {
    setShowScanner(false);
    barcodeLookup.lookUp(barCode, {
      onFound: product => handleSelectProduct(product),
      onMissing: prefill => setNewProduct({ barCode, prefill, message: t(missingProductMessage(prefill), { code: barCode }) }),
      onError: () => alert(t('scanner.lookupFailed')),
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [showQuickAdd, setShowQuickAdd] = useState(!!mealId);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
  const [quickAddInitial, setQuickAddInitial] = useState(quickAddForm);
  const quickAddChanged = (Object.keys(quickAddForm) as (keyof typeof quickAddForm)[]).some(key => quickAddForm[key] !== quickAddInitial[key]);


  useEffect(() => {
    async function loadManualMeal() {
      if (!mealId) return;
      try {
        const meals = await api.meals.getAll();
        const data = meals.find((m: any) => m.id === mealId);
        if (data) {
          const formData = {
            name: data.manual_name || '',
            kcal: String(data.manual_kcal || ''),
            protein: String(data.manual_protein || ''),
            fat: String(data.manual_fat || ''),
            carbs: String(data.manual_carbs || '')
          };
          setQuickAddForm(formData);
          setQuickAddInitial(formData);
        }
      } catch (err) {
        console.error("Error loading meal for edit:", err);
      }
    }
    loadManualMeal();
  }, [mealId]);



  const lowerQuery = searchQuery.trim().toLowerCase();
  const matchesRecipe = (recipe: RecipeSummary) =>
    String(recipe.name ?? '').toLowerCase().includes(lowerQuery) && matchesFilters(recipe, filters);
  const matchesProduct = (product: Product) =>
    productDisplayName(product).toLowerCase().includes(lowerQuery) && matchesFilters(product, filters);

  const allRecentItems = useMemo(() => recentMealItems(userMeals, recipes, RECENT_ITEMS_LIMIT), [userMeals, recipes]);
  const searchedRecipes = recipes.filter(matchesRecipe);
  const recentItems = allRecentItems.filter(entry => (entry.kind === 'product' ? matchesProduct(entry.item) : matchesRecipe(entry.item)));
  const ownRecipes = recipes.filter(recipe => isOwnItem(recipe, user) && matchesRecipe(recipe));
  const savedRecipes = savedFood.savedRecipes.filter(matchesRecipe);
  const savedProducts = savedFood.savedProducts.filter(matchesProduct);
  const ownProducts = savedFood.ownProducts.filter(matchesProduct);

  const productsSettled = productSearch.resultsMatchQuery || productSearch.error;
  const isSearchingProducts = !productsSettled && productSearch.items.length === 0;
  const noProductsFound = productsSettled && !productSearch.error && productSearch.items.length === 0;

  const openDetails = (path: string) => {
    if (!activeDate || !activeMealType) return;
    const state = planSelectionState(selection);
    navigate(`${location.pathname}${listSearch}`, { replace: true, state });
    navigate(`${path}?${planTargetSearch(activeDate, activeMealType)}`, { state });
  };

  const handleSelectRecipe = (recipe: any) => openDetails(`/recipe/${recipe.id}`);

  const handleSelectProduct = (product: any) => openDetails(`/product/${product.id}`);

  const renderProduct = (product: Product) => {
    const own = isOwnItem(product, user);
    const name = productDisplayName(product);
    return (
      <ProductRow
        key={`product-${product.id}`}
        name={name}
        kcal={formatCompactNumber(Number(product.kcal) || 0)}
        amount={`${DEFAULT_PRODUCT_GRAMS} g`}
        own={own}
        unverified={isUnverified(product)}
        calendories={isCalendoriesProduct(product)}
        selected={isSelected(selection.items, 'product', product.id)}
        onOpen={() => handleSelectProduct(product)}
        onToggleSelected={() => toggleItem('product', product.id)}
      />
    );
  };

  const renderRecipe = (recipe: RecipeSummary) => {
    const own = isOwnItem(recipe, user);
    return (
      <RecipeRow
        key={`recipe-${recipe.id}`}
        recipe={recipe}
        name={recipe.name}
        kcal={formatCompactNumber(Number(recipe.kcal) || 0)}
        amount={t('food.portion', { count: DEFAULT_RECIPE_PORTIONS })}
        own={own}
        unverified={isUnverified(recipe)}
        selected={isSelected(selection.items, 'recipe', recipe.id)}
        onOpen={() => handleSelectRecipe(recipe)}
        onToggleSelected={() => toggleItem('recipe', recipe.id)}
      />
    );
  };

  const handleAddSelected = async () => {
    if (isAdding || selection.items.length === 0) return;
    setIsAdding(true);
    try {
      await addSelectionToPlan(selection.items, activeDate, activeMealType);
      finishPlanSelection(selection);
      await refreshMeals();
      navigate('/');
    } catch (err) {
      console.error("Selected items save error:", err);
      if (err instanceof PlanSelectionSaveError) setSelection(current => ({ ...current, items: err.remaining }));
      await refreshMeals();
      alert(t('addFood.addSelectedFailed'));
      setIsAdding(false);
    }
  };



  const availableMealTypes = useMemo(() => profileMealTypes(profile).filter(meal => meal.visible !== false), [profile]);

  const handleQuickAddSubmit = async () => {
    if (!selectDate || !selectType || isAdding) return;
    if (!quickAddForm.name || !quickAddForm.kcal) {
      alert('Podaj przynajmniej nazwę i kalorie!');
      return;
    }

    setIsAdding(true);

    const payload = {
      meal_date: activeDate,
      meal_type: activeMealType,
      manual_name: quickAddForm.name,
      manual_kcal: parseInt(String(quickAddForm.kcal).replace(',', '.')) || 0,
      manual_protein: parseFloat(String(quickAddForm.protein).replace(',', '.')) || 0,
      manual_fat: parseFloat(String(quickAddForm.fat).replace(',', '.')) || 0,
      manual_carbs: parseFloat(String(quickAddForm.carbs).replace(',', '.')) || 0,
    };

    try {
      if (mealId) {
        await api.meals.update(mealId, payload);
      } else {
        await api.meals.add(payload);
        await addSelectionAfterItem(selection, null, activeDate, activeMealType);
      }
      await refreshMeals();
      navigate('/');
    } catch (err: any) {
      console.error("Meal save error:", err);
      alert(`Wystąpił błąd przy zapisywaniu: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };


  if (!selectDate || !selectType) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-8 text-center">
        <FoodPlaceholder kind="manual" className="w-16 h-16 rounded-2xl mb-4" iconClassName="text-[34px]" />
        <h2 className="font-headline font-extrabold text-xl tracking-tight text-on-surface">{t('addFood.noTargetTitle')}</h2>
        <p className="text-sm text-on-surface-variant mt-2">{t('addFood.noTargetText')}</p>
        <button onClick={() => navigate('/')} className="mt-6 h-[52px] px-8 bg-primary text-on-primary font-bold text-[15px] rounded-full active:scale-95 transition-transform">{t('addFood.backToPlan')}</button>
      </div>
    );
  }

  const quickAddValid = Boolean(quickAddForm.name.trim()) && isPositiveWithinLimit(quickAddForm.kcal, MEAL_LIMITS.kcal);
  const quickAddSubmit = (
    <SheetSubmit
      label={t(mealId ? 'quickAdd.update' : 'quickAdd.submit')}
      busy={isAdding}
      disabled={!quickAddValid || (Boolean(mealId) && !quickAddChanged)}
      onClick={handleQuickAddSubmit}
    />
  );
  const activeFilterCount = Object.values(filters).filter(value => value !== '').length;

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col">
      <header className="sticky top-0 w-full z-50 bg-surface pt-safe">
        <div className="max-w-xl mx-auto px-4 pt-3 pb-2 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} aria-label={t('recipeDetails.back')} className="w-10 h-10 bg-surface-container-low rounded-full flex items-center justify-center text-on-surface active:scale-95 transition-transform shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <PlanTargetPicker
              meals={availableMealTypes}
              mealType={activeMealType}
              date={activeDate}
              editing={Boolean(mealId)}
              onMealTypeChange={setActiveMealType}
              onDateChange={setActiveDate}
            />
          </div>

          {!mealId && (
            <>
              <div className="flex items-center gap-2 w-full pt-0.5">
                <div className="relative flex-1 min-w-0">
                  <span aria-hidden="true" className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">search</span>
                  <input
                    value={searchQuery}
                    onChange={(e) => changeSearch(e.target.value, filters)}
                    className={`w-full h-[46px] rounded-2xl bg-surface-container-low pl-11 ${searchQuery ? 'pr-10' : 'pr-3'} text-sm font-medium text-on-surface placeholder:text-on-surface-variant/80 outline-hidden focus:ring-2 focus:ring-primary/30 transition-shadow [&::-webkit-search-cancel-button]:hidden`}
                    placeholder={t('food.searchPlaceholder')}
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button onClick={() => changeSearch('', filters)} aria-label={t('food.clearSearch')} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant active:scale-90">
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  aria-label={t('addFood.scan')}
                  className="w-[46px] h-[46px] shrink-0 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[22px]">barcode_scanner</span>
                </button>
                <button
                  onClick={() => setShowFilters(v => !v)}
                  aria-label={t('food.filters.open')}
                  className={`relative w-[46px] h-[46px] shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-colors ${hasActiveFilters ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[22px]">tune</span>
                  {hasActiveFilters && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-surface text-primary text-[10.5px] font-extrabold flex items-center justify-center ring-2 ring-primary">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              <div role="tablist" className="flex bg-surface-container-low rounded-full p-[3px]">
                {FOOD_TABS.map(tab => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={selectedTab === tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`flex-1 min-w-0 h-[34px] rounded-full flex items-center justify-center gap-1.5 text-[12.5px] font-bold transition-colors ${selectedTab === tab.id ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant'}`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[16px]">{tab.icon}</span>
                    <span className="truncate">{t(tab.label)}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4">
                <CreateChip icon="bolt" label={t('addFood.createQuick')} ariaLabel={t('addFood.createQuickLabel')} onClick={() => setShowQuickAdd(true)} />
                <CreateChip icon="nutrition" label={t('addFood.createProduct')} ariaLabel={t('addFood.createProductLabel')} onClick={() => setNewProduct({})} />
                <CreateChip icon="menu_book" label={t('addFood.createRecipe')} ariaLabel={t('addFood.createRecipeLabel')} onClick={() => navigate('/add-recipe')} />
              </div>
            </>
          )}

          {showFilters && !mealId && (
            <BottomPanel title={t('food.filters.title')} onClose={() => setShowFilters(false)}>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {FILTER_FIELDS.map(f => (
                  <div key={f.key} className="flex flex-col">
                    <label htmlFor={`filter-${f.key}`} className={LABEL_CLASS}>{t(f.label)}</label>
                    <input
                      {...numberFieldProps(f.max, 0)}
                      id={`filter-${f.key}`}
                      value={filters[f.key]}
                      onChange={e => acceptsLimitedNumber(e.target.value, f.max, 0) && changeSearch(searchQuery, { ...filters, [f.key]: e.target.value })}
                      onKeyDown={blockNumberSigns}
                      placeholder={f.placeholder}
                      className={`${FIELD_CLASS} tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!hasActiveFilters}
                  onClick={() => changeSearch(searchQuery, EMPTY_FILTERS)}
                  className="flex-1 h-[52px] bg-surface-container text-on-surface font-bold text-[15px] rounded-full active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {t('food.filters.clear')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="flex-1 h-[52px] bg-primary text-on-primary font-bold text-[15px] rounded-full active:scale-[0.98] transition-transform"
                >
                  {t('food.filters.show')}
                </button>
              </div>
            </BottomPanel>
          )}
        </div>
      </header>

      {!mealId && (
        <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-3 pb-6">

          {contextLoading && (
            <div role="status" aria-label={t('food.loading')} className="flex flex-col gap-2 motion-safe:animate-pulse">
              {[0, 1, 2].map(index => <div key={index} className="h-16 rounded-2xl bg-surface-container-low" />)}
            </div>
          )}

          {!contextLoading && selectedTab === null && (
            <>
              <FoodSection title={t('food.recipes')} empty={null}>
                {searchedRecipes.map(renderRecipe)}
              </FoodSection>
              {noProductsFound && searchedRecipes.length === 0 && <NoResults />}
              {!noProductsFound && (
                <section className="mb-5 overflow-hidden">
                  <h2 className={`${SECTION_LABEL_CLASS} px-1 mb-2`}>{t('food.products')}</h2>
                  {productSearch.items.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {productSearch.items.map(renderProduct)}
                      {productSearch.error && (
                        <p className="pt-3 text-center text-sm font-medium text-error">{t('food.moreProductsFailed')}</p>
                      )}
                      {productSearch.hasNext && (
                        <LoadMoreTrigger onLoadMore={productSearch.loadMore} loading={productSearch.loading} />
                      )}
                    </div>
                  ) : isSearchingProducts ? (
                    <p className="py-6 text-center text-sm font-medium text-on-surface-variant">{t('food.searching')}</p>
                  ) : (
                    <EmptyBox message={t('food.productsFailed')}>
                      <button
                        type="button"
                        onClick={productSearch.reload}
                        className="mt-3 h-10 px-5 rounded-full text-sm font-bold text-on-primary bg-primary active:scale-95 transition-transform"
                      >
                        {t('food.retry')}
                      </button>
                    </EmptyBox>
                  )}
                </section>
              )}
            </>
          )}

          {!contextLoading && selectedTab === 'recent' && (
            searching && recentItems.length === 0 ? <NoResults /> : (
              <FoodSection title={t('food.recentTitle')} empty={t('food.recentEmpty')}>
                {recentItems.map(entry => entry.kind === 'product' ? renderProduct(entry.item) : renderRecipe(entry.item))}
              </FoodSection>
            )
          )}

          {!contextLoading && selectedTab === 'saved' && (
            savedRecipes.length === 0 && savedProducts.length === 0 ? (
              searching ? <NoResults /> : <FoodSection title={t('food.tabSaved')} empty={t('food.savedEmpty')}>{[]}</FoodSection>
            ) : (
              <>
                <FoodSection title={t('food.recipes')} empty={null}>{savedRecipes.map(renderRecipe)}</FoodSection>
                <FoodSection title={t('food.products')} empty={null}>{savedProducts.map(renderProduct)}</FoodSection>
              </>
            )
          )}

          {!contextLoading && selectedTab === 'own' && (
            searching && ownProducts.length === 0 && ownRecipes.length === 0 ? <NoResults /> : (
              <>
                <FoodSection title={t('food.products')} empty={searching ? null : t('food.ownProductsEmpty')}>
                  {ownProducts.map(renderProduct)}
                </FoodSection>
                <FoodSection title={t('food.recipes')} empty={searching ? null : t('food.ownRecipesEmpty')}>
                  {ownRecipes.map(renderRecipe)}
                </FoodSection>
              </>
            )
          )}
        </main>
      )}

      {mealId && (
        <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-3 pb-6 flex flex-col gap-5">
          <QuickMealFields form={quickAddForm} onChange={setQuickAddForm} />
          {quickAddSubmit}
        </main>
      )}

      {showQuickAdd && !mealId && (
        <FormSheet
          title={t('quickAdd.title')}
          hint={<PlanTargetMeta meals={availableMealTypes} mealType={activeMealType} date={activeDate} />}
          leading={<FoodPlaceholder kind="manual" className="w-12 h-12 rounded-2xl" iconClassName="text-[26px]" />}
          closeLabel={t('quickAdd.close')}
          busy={isAdding}
          onClose={() => setShowQuickAdd(false)}
          footer={quickAddSubmit}
        >
          <QuickMealFields form={quickAddForm} onChange={setQuickAddForm} />
        </FormSheet>
      )}

      {newProduct && (
        <NewProductSheet
          key={newProduct.barCode ?? 'manual'}
          draft={newProduct}
          context={<PlanTargetMeta meals={availableMealTypes} mealType={activeMealType} date={activeDate} />}
          onClose={() => setNewProduct(null)}
          onCreated={() => {
            setNewProduct(null);
            productSearch.reload();
            savedFood.reload();
          }}
          existingProductAction={{ onOpen: handleSelectProduct }}
        />
      )}

      {!mealId && !showQuickAdd && !newProduct && (
        <AddSelectedBar count={selection.items.length} adding={isAdding} onAdd={handleAddSelected} />
      )}

      {showScanner && <LazyBarcodeScanner onDetected={handleBarCode} onClose={() => setShowScanner(false)} />}
      {barcodeLookup.pending && <BarcodeLookupPending onCancel={barcodeLookup.cancel} />}
    </div>
  );
}
