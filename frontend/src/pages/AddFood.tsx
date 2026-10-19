import { useState, useMemo, useEffect, type ReactNode } from 'react';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Product, type RecipeSummary } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { productDisplayName } from '../lib/productName';
import { LoadMoreTrigger } from '../components/LoadMoreTrigger';
import { recentMealItems } from '../lib/mealProducts';
import { useProductSearch } from '../lib/useProductSearch';
import { useSavedFood } from '../lib/useSavedFood';
import { isOwnItem, isUnverified } from '../lib/productPermissions';
import { ProductRow, RecipeRow } from '../components/FoodRows';
import type { MessageKey } from '../i18n';
import { LazyBarcodeScanner } from '../components/LazyBarcodeScanner';
import { useBarcodeLookup } from '../lib/useBarcodeLookup';
import { missingProductMessage } from '../lib/barcodeLookup';
import { BarcodeLookupPending } from '../components/BarcodeLookupPending';
import { NewProductSheet, type NewProductDraft } from '../components/NewProductSheet';
import { t } from '../i18n';
import { useCloseOnBack } from '../lib/backNavigation';
import { useBottomSheet } from '../lib/bottomSheet';
import { firstDayOfMonth, formatRelativeDayLabel, toIsoDate, todayIsoDate } from '../lib/planDates';
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

type FoodTab = 'recent' | 'saved' | 'own';

const RECENT_ITEMS_LIMIT = 15;
const FOOD_TABS: { id: FoodTab; label: MessageKey; icon: string }[] = [
  { id: 'recent', label: 'food.tabRecent', icon: 'history' },
  { id: 'saved', label: 'food.tabSaved', icon: 'favorite' },
  { id: 'own', label: 'food.tabOwn', icon: 'person' },
];

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
    <section className="mb-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-3 pl-1">{title}</h2>
      {children.length > 0 ? (
        <div className="flex flex-col gap-3">{children}</div>
      ) : empty && (
        <div className="py-6 px-4 text-center bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 border-dashed">
          <p className="text-sm font-medium text-on-surface-variant/60">{empty}</p>
        </div>
      )}
    </section>
  );
}
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Śniadanie',
  second_breakfast: '2 Śniadanie',
  lunch: 'Lunch',
  snack: 'Przekąska',
  dinner: 'Obiad',
  supper: 'Kolacja',
};

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
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => firstDayOfMonth(selectDate));

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FoodTab>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NutritionFiltersValues>({ maxKcal: '', minProtein: '', maxFat: '', maxCarbs: '' });

  const hasActiveFilters = Object.values(filters).some(v => v !== '');
  const searching = searchQuery.trim() !== '' || hasActiveFilters;
  const productSearch = useProductSearch({
    query: searchQuery,
    filters,
    enabled: searching,
  });
  const savedFood = useSavedFood(recipes);

  const [isAdding, setIsAdding] = useState(false);
  const [selection, setSelection] = useState(() => readPlanSelection(location.state) ?? newPlanSelection());
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

  useCloseOnBack(showMealPicker || showDatePicker, () => { setShowMealPicker(false); setShowDatePicker(false); });
  const quickAddSheetRef = useBottomSheet(showQuickAdd && !mealId, () => setShowQuickAdd(false));

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
        }
      } catch (err) {
        console.error("Error loading meal for edit:", err);
      }
    }
    loadManualMeal();
  }, [mealId]);



  const getMealLabel = (type: string) => {
    if (profile?.meal_config) {
      const config = profile.meal_config.find((m: any) => m.id === type);
      if (config) return config.name;
    }
    return MEAL_TYPE_LABELS[type] || type;
  };

  const searchedRecipes = useMemo(() => {
    const lowerQ = searchQuery.trim().toLowerCase();
    return recipes.filter(r => String(r.name ?? '').toLowerCase().includes(lowerQ) && matchesFilters(r, filters));
  }, [recipes, searchQuery, filters]);

  const recentItems = useMemo(() => recentMealItems(userMeals, recipes, RECENT_ITEMS_LIMIT), [userMeals, recipes]);
  const ownRecipes = useMemo(() => recipes.filter(recipe => isOwnItem(recipe, user)), [recipes, user]);

  const isSearchingProducts = productSearch.loading && productSearch.items.length === 0;

  const openDetails = (path: string) => {
    if (!activeDate || !activeMealType) return;
    const state = planSelectionState(selection);
    const query = `?selectDate=${activeDate}&selectType=${activeMealType}`;
    navigate(location.pathname + query, { replace: true, state });
    navigate(path + query, { state });
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
        kcal={product.kcal}
        amount={`${DEFAULT_PRODUCT_GRAMS}g`}
        own={own}
        unverified={isUnverified(product)}
        selected={isSelected(selection.items, 'product', product.id)}
        heart={own ? null : { saved: savedFood.isProductSaved(product.id), onToggle: () => savedFood.toggleProduct(product) }}
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
        kcal={recipe.kcal}
        amount={t('food.portion', { count: DEFAULT_RECIPE_PORTIONS })}
        own={own}
        unverified={isUnverified(recipe)}
        selected={isSelected(selection.items, 'recipe', recipe.id)}
        heart={own || !savedFood.recipeSavingAvailable ? null : { saved: savedFood.isRecipeSaved(recipe.id), onToggle: () => savedFood.toggleRecipe(recipe) }}
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



  const availableMealTypes = useMemo(() => {
    if (profile?.meal_config && profile.meal_config.length > 0) {
      return profile.meal_config.map((m: any) => ({ id: m.id, name: m.name }));
    }
    return Object.entries(MEAL_TYPE_LABELS).map(([id, name]) => ({ id, name }));
  }, [profile]);

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
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">error</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">Brak kontekstu</h2>
        <p className="text-sm text-on-surface-variant mb-6">Przejdź tu z kalendarza, wybierając konkretny posiłek.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-2xl active:scale-95 transition-transform">Wróć do planu</button>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col">
      {/* Sticky Header & Search */}
      <header className="sticky top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10 pt-safe">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-4">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex flex-col gap-0.5">

                {/* Meal type selector */}
                <div className="relative">
                  <button
                    onClick={() => { if (!mealId) { setShowMealPicker(v => !v); setShowDatePicker(false); } }}
                    className={`flex items-center gap-1 font-headline font-bold text-lg text-on-surface tracking-tight leading-tight ${!mealId ? 'active:scale-95 transition-transform' : ''}`}
                  >
                    <span>{mealId ? 'Edytuj w:' : 'Dodaj do:'} {getMealLabel(activeMealType)}</span>
                    {!mealId && <span className={`material-symbols-outlined text-[16px] text-primary transition-transform ${showMealPicker ? 'rotate-180' : ''}`}>expand_more</span>}
                  </button>
                  {showMealPicker && (
                    <div className="absolute top-full left-0 mt-1 z-[200] bg-surface rounded-2xl shadow-xl border border-outline-variant/20 py-1 min-w-[180px]">
                      {availableMealTypes.map((meal: any) => (
                        <button
                          key={meal.id}
                          onClick={() => { setActiveMealType(meal.id); setShowMealPicker(false); }}
                          className={`flex items-center justify-between w-full px-4 py-2.5 text-sm font-bold transition-colors hover:bg-surface-container ${activeMealType === meal.id ? 'text-primary' : 'text-on-surface'}`}
                        >
                          <span>{meal.name}</span>
                          {activeMealType === meal.id && <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date selector */}
                <div className="relative">
                  <button
                    onClick={() => { if (!mealId) { setShowDatePicker(v => !v); setShowMealPicker(false); } }}
                    className={`flex items-center gap-1 text-sm font-bold text-primary w-fit ${!mealId ? 'active:scale-95 transition-transform' : ''}`}
                  >
                    <span>{formatRelativeDayLabel(activeDate)}</span>
                    {!mealId && <span className={`material-symbols-outlined text-[16px] text-primary/70 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}>expand_more</span>}
                  </button>
                  {showDatePicker && (
                    <div className="absolute top-full left-0 mt-1 z-[200] bg-surface rounded-2xl shadow-xl border border-outline-variant/20 p-3 w-[260px]">
                      {/* Month nav */}
                      <div className="flex items-center justify-between mb-2 px-1">
                        <button
                          onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90"
                        >
                          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                        <span className="text-xs font-black text-on-surface uppercase tracking-widest">
                          {calendarDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90"
                        >
                          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                      </div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-1">
                        {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
                          <span key={d} className="text-center text-[9px] font-bold text-on-surface-variant/50 py-0.5">{d}</span>
                        ))}
                      </div>
                      {/* Days grid */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {(() => {
                          const year = calendarDate.getFullYear();
                          const month = calendarDate.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          // Monday-first offset
                          const offset = (firstDay === 0 ? 6 : firstDay - 1);
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const todayStr = todayIsoDate();
                          const cells = [];
                          for (let i = 0; i < offset; i++) cells.push(<span key={`e${i}`} />);
                          for (let d = 1; d <= daysInMonth; d++) {
                            const dateStr = toIsoDate(new Date(year, month, d));
                            const isActive = activeDate === dateStr;
                            const isToday = todayStr === dateStr;
                            cells.push(
                              <button
                                key={d}
                                onClick={() => { setActiveDate(dateStr); setShowDatePicker(false); }}
                                className={`w-full aspect-square flex items-center justify-center rounded-full text-xs font-bold transition-all active:scale-90
                                  ${isActive ? 'bg-primary text-on-primary' : isToday ? 'border border-primary text-primary' : 'text-on-surface hover:bg-surface-container'}`}
                              >
                                {d}
                              </button>
                            );
                          }
                          return cells;
                        })()}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
            {/* Close dropdowns on outside click */}
            {(showMealPicker || showDatePicker) && (
              <div className="fixed inset-0 z-[199]" onClick={() => { setShowMealPicker(false); setShowDatePicker(false); }} />
            )}
          </div>

          {!mealId && (
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant/60">search</span>
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 text-on-surface text-sm font-medium transition-all shadow-inner"
                  placeholder={t('food.searchPlaceholder')}
                  type="text"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-4 flex items-center text-on-surface-variant/60 hover:text-on-surface active:scale-90 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/20 transition-colors active:scale-95 shrink-0 border border-primary/20 shadow-sm"
                title="Skanuj kod"
              >
                <span className="material-symbols-outlined text-xl">barcode_scanner</span>
              </button>
              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors active:scale-95 shrink-0 shadow-sm relative ${showFilters || hasActiveFilters ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'}`}
                title="Filtruj wyniki"
              >
                <span className="material-symbols-outlined text-xl">tune</span>
                {hasActiveFilters && !showFilters && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full text-[9px] text-on-error font-black flex items-center justify-center">
                    {Object.values(filters).filter(v => v !== '').length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Filter panel */}
          {showFilters && !mealId && (
            <div className="bg-surface-container-low rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Filtruj wyniki</span>
                {hasActiveFilters && (
                  <button
                    onClick={() => setFilters({ maxKcal: '', minProtein: '', maxFat: '', maxCarbs: '' })}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[13px]">filter_alt_off</span>
                    Wyczyść filtry
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'maxKcal', label: 'Max kcal', icon: 'local_fire_department', placeholder: 'np. 500' },
                  { key: 'minProtein', label: 'Min białko (g)', icon: 'fitness_center', placeholder: 'np. 20' },
                  { key: 'maxFat', label: 'Max tłuszcz (g)', icon: 'water_drop', placeholder: 'np. 15' },
                  { key: 'maxCarbs', label: 'Max węgle (g)', icon: 'grain', placeholder: 'np. 50' },
                ].map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">{f.icon}</span>
                      {f.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={filters[f.key as keyof typeof filters]}
                      onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                      onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                      placeholder={f.placeholder}
                      className="w-full bg-surface rounded-xl py-2.5 px-3 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Segmented Control */}
          {!mealId && (
            <div className="w-full pt-2 pb-1">
              <div role="tablist" className="flex w-full gap-1.5 sm:gap-2">
                {FOOD_TABS.map(tab => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={!searching && activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-1 sm:gap-1.5 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all overflow-hidden ${!searching && activeTab === tab.id ? 'bg-on-surface text-surface shadow-md' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'}`}
                  >
                    <span className="material-symbols-outlined shrink-0 text-[14px]">{tab.icon}</span>
                    <span className="truncate">{t(tab.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Szybkie akcje dodawania (Przeniesione na górę) */}
          {!mealId && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setNewProduct({})}
                className="flex items-center justify-center gap-2 flex-1 py-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 outline-none bg-surface-container-low rounded-xl border border-outline-variant/10"
              >
                <div className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">grocery</span>
                  <div className="absolute -bottom-1 -right-1 bg-surface rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px] font-black text-primary">add_circle</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Produkt</span>
              </button>

              <button
                onClick={() => navigate('/add-recipe')}
                className="flex items-center justify-center gap-2 flex-1 py-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 outline-none bg-surface-container-low rounded-xl border border-outline-variant/10"
              >
                <div className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  <div className="absolute -bottom-1 -right-1 bg-surface rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px] font-black text-primary">add_circle</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Przepis</span>
              </button>

              <button
                onClick={() => setShowQuickAdd(true)}
                className="flex items-center justify-center gap-2 flex-1 py-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 outline-none bg-surface-container-low rounded-xl border border-outline-variant/10"
              >
                <div className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <div className="absolute -bottom-1 -right-1 bg-surface rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px] font-black text-primary">add_circle</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Szybkie</span>
              </button>
            </div>
          )}

        </div>
      </header>

      {/* Main Content Area */}
      {!mealId && (
        <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6">

          {contextLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary/60">{t('food.loading')}</span>
            </div>
          )}

          {!contextLoading && searching && (
            <>
              <FoodSection title={t('food.recipes')} empty={t('food.noRecipes')}>
                {searchedRecipes.map(renderRecipe)}
              </FoodSection>
              <section className="mb-4 overflow-hidden">
                <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-3 pl-1">{t('food.products')}</h2>
                {productSearch.items.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {productSearch.items.map(renderProduct)}
                    {productSearch.error && (
                      <p className="pt-3 text-center text-sm font-medium text-error">{t('food.moreProductsFailed')}</p>
                    )}
                    {productSearch.hasNext && (
                      <LoadMoreTrigger onLoadMore={productSearch.loadMore} loading={productSearch.loading} />
                    )}
                  </div>
                ) : isSearchingProducts ? (
                  <p className="py-6 text-center text-sm font-medium text-on-surface-variant/60">{t('food.searching')}</p>
                ) : (
                  <div className="py-6 text-center bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 border-dashed">
                    <p className="text-sm font-medium text-on-surface-variant/60">
                      {productSearch.error ? t('food.productsFailed') : t('food.noProducts')}
                    </p>
                    {productSearch.error && (
                      <button
                        type="button"
                        onClick={productSearch.reload}
                        className="mt-3 px-5 py-2 rounded-full text-sm font-bold text-primary bg-primary/10 active:scale-95 transition-all"
                      >
                        {t('food.retry')}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {!contextLoading && !searching && activeTab === 'recent' && (
            <FoodSection title={t('food.recentTitle')} empty={t('food.recentEmpty')}>
              {recentItems.map(entry => entry.kind === 'product' ? renderProduct(entry.item) : renderRecipe(entry.item))}
            </FoodSection>
          )}

          {!contextLoading && !searching && activeTab === 'saved' && (
            <>
              {savedFood.savedRecipes.length === 0 && savedFood.savedProducts.length === 0 ? (
                <FoodSection title={t('food.tabSaved')} empty={t('food.savedEmpty')}>{[]}</FoodSection>
              ) : (
                <>
                  <FoodSection title={t('food.recipes')} empty={null}>{savedFood.savedRecipes.map(renderRecipe)}</FoodSection>
                  <FoodSection title={t('food.products')} empty={null}>{savedFood.savedProducts.map(renderProduct)}</FoodSection>
                </>
              )}
            </>
          )}

          {!contextLoading && !searching && activeTab === 'own' && (
            <>
              <FoodSection title={t('food.products')} empty={t('food.ownProductsEmpty')}>
                {savedFood.ownProducts.map(renderProduct)}
              </FoodSection>
              <FoodSection title={t('food.recipes')} empty={t('food.ownRecipesEmpty')}>
                {ownRecipes.map(renderRecipe)}
              </FoodSection>
            </>
          )}
        </main>
      )}


      {/* Quick Add Form - Modal for new, Page Content for edit */}
      {showQuickAdd && (
        <div className={mealId ? "flex-1 w-full max-w-xl mx-auto px-4 py-6" : "fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in"} onClick={!mealId ? () => setShowQuickAdd(false) : undefined}>
          <div ref={mealId ? undefined : quickAddSheetRef} className={mealId ? "bg-transparent" : "bg-surface-container-lowest rounded-t-[32px] p-6 pb-8 max-h-[90vh] overflow-y-auto animate-slide-up w-full max-w-xl mx-auto shadow-[0_-8px_30px_rgb(0,0,0,0.1)] relative"} onClick={e => e.stopPropagation()}>
            {!mealId && <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6"></div>}

            {!mealId && (
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                  </div>
                  <div>
                    <h2 className="font-headline font-bold text-lg text-on-surface leading-tight">
                      Szybkie dodanie
                    </h2>
                    <span className="text-[10px] sm:text-[11px] font-medium text-on-surface-variant">bez dodawania szczegółów i zdjęcia</span>
                  </div>
                </div>
                <button onClick={() => setShowQuickAdd(false)} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors active:scale-90">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            <div className={`flex flex-col gap-4 ${mealId ? 'mb-8' : 'mb-8'}`}>

              {/* Nazwa */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">Nazwa</label>
                <input
                  type="text"
                  value={quickAddForm.name}
                  onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  className="w-full bg-surface-container-low border-none rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm transition-shadow placeholder:font-medium placeholder:text-on-surface-variant/40"
                  placeholder="np. Szybki obiad z zewnątrz"
                />
              </div>

              {/* Kcal */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Wartość energetyczna</label>
                </div>
                <div className={`relative flex items-center rounded-2xl overflow-hidden transition-shadow border ${mealId ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/10 shadow-sm' : 'bg-surface-container-low border-none focus-within:ring-2 focus-within:ring-primary/30'}`}>
                  <input
                    type="number"
                    min="0"
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                    }}
                    value={quickAddForm.kcal}
                    onChange={e => setQuickAddForm({ ...quickAddForm, kcal: e.target.value })}
                    className="flex-1 bg-transparent py-4 pl-4 pr-16 outline-none text-on-surface font-bold text-lg leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <span className="absolute right-4 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest bg-surface-container-highest/60 px-2 py-1.5 rounded-md">kcal</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Węglowodany */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest leading-none truncate">Węgle</label>
                  <div className={`relative flex items-center rounded-xl overflow-hidden transition-shadow border ${mealId ? 'bg-primary/5 border-primary/30' : 'bg-surface-container-low border-none focus-within:ring-2 focus-within:ring-primary/30'}`}>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={quickAddForm.carbs}
                      onChange={e => setQuickAddForm({ ...quickAddForm, carbs: e.target.value })}
                      className="flex-1 w-full bg-transparent py-3 pl-3 pr-8 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                    <span className="absolute right-3 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">g</span>
                  </div>
                </div>

                {/* Bialko */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest leading-none truncate">Białko</label>
                  <div className={`relative flex items-center rounded-xl overflow-hidden transition-shadow border ${mealId ? 'bg-primary/5 border-primary/30' : 'bg-surface-container-low border-none focus-within:ring-2 focus-within:ring-primary/30'}`}>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={quickAddForm.protein}
                      onChange={e => setQuickAddForm({ ...quickAddForm, protein: e.target.value })}
                      className="flex-1 w-full bg-transparent py-3 pl-3 pr-8 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                    <span className="absolute right-3 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">g</span>
                  </div>
                </div>

                {/* Tluszcze */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest leading-none truncate">Tłuszcz</label>
                  <div className={`relative flex items-center rounded-xl overflow-hidden transition-shadow border ${mealId ? 'bg-primary/5 border-primary/30' : 'bg-surface-container-low border-none focus-within:ring-2 focus-within:ring-primary/30'}`}>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={quickAddForm.fat}
                      onChange={e => setQuickAddForm({ ...quickAddForm, fat: e.target.value })}
                      className="flex-1 w-full bg-transparent py-3 pl-3 pr-8 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                    <span className="absolute right-3 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">g</span>
                  </div>
                </div>
              </div>


            </div>

            <button
              onClick={handleQuickAddSubmit}
              disabled={isAdding || !quickAddForm.name || !quickAddForm.kcal}
              className="w-full py-4 bg-primary text-on-primary font-black text-sm rounded-2xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    {mealId ? 'save' : 'check_circle'}
                  </span>
                  {mealId ? 'Aktualizuj wpis' : 'Zapisz'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {newProduct && (
        <NewProductSheet
          key={newProduct.barCode ?? 'manual'}
          draft={newProduct}
          onClose={() => setNewProduct(null)}
          onCreated={() => {
            setNewProduct(null);
            productSearch.reload();
            savedFood.reload();
          }}
          existingProductAction={{ href: product => `/product/${product.id}?selectDate=${activeDate}&selectType=${activeMealType}` }}
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
