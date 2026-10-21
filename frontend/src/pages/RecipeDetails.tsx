import { useCallback, useEffect, useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { addDaysToIsoDate, firstDayOfMonth, formatDayMonth, formatShortDayLabel, toIsoDate, todayIsoDate } from '../lib/planDates';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { targetRange } from '../lib/macros';
import { RecipeMoreNutrients } from '../components/RecipeMoreNutrients';
import { addSelectionAfterItem, readPlanSelection } from '../lib/planSelection';
import { useCloseOnBack } from '../lib/backNavigation';
import { useBottomSheet } from '../lib/bottomSheet';
import { ingredientGrams, ingredientUnitLabel } from '../lib/recipeIngredient';
import { profileMealTypes } from '../lib/mealTypes';
import { announceDeletedRecipe } from '../lib/deletedRecipe';
import { RecipeDeleteSheet } from '../components/RecipeDeleteSheet';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { pluralForm, t, type MessageKey } from '../i18n';
import { AMOUNT_LIMITS, acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { formatCompactNumber } from '../lib/compactNumber';
import { KCAL_HERO_SIZES, RING_VALUE_SIZES, fitTextClass } from '../lib/fitText';
import { MonthCalendar } from '../components/MonthCalendar';

const DEFAULT_RECIPE_WEIGHT = 300;

function gramsLabel(value: number): string {
  return `${formatCompactNumber(value, 1)}g`;
}
const QUICK_PICK_MULTIPLIERS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];
const WEEKDAY_KEYS: MessageKey[] = [
  'recipeDetails.weekday.mon',
  'recipeDetails.weekday.tue',
  'recipeDetails.weekday.wed',
  'recipeDetails.weekday.thu',
  'recipeDetails.weekday.fri',
  'recipeDetails.weekday.sat',
  'recipeDetails.weekday.sun',
];

function portionForm(count: number): string {
  return Number.isInteger(count) ? pluralForm(count) : 'fraction';
}

function portionWord(count: number): string {
  return t(`recipeDetails.portionWord.${portionForm(count)}` as MessageKey);
}

export function RecipeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, refreshRecipes, getConsumedForDay, profile } = useAppData();
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('after');

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [recipe, setRecipe] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [totalWeight, setTotalWeight] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const [inputType, setInputType] = useState<'portions' | 'grams' | 'quick-pick'>('portions');
  const [portionInput, setPortionInput] = useState<number | ''>(1);
  const [gramInput, setGramInput] = useState<number | ''>(100);
  const [quickPickPortions, setQuickPickPortions] = useState<number | null>(null);
  const [ingredientPortions, setIngredientPortions] = useState<number | null>(null);
  const [daysToAdd, setDaysToAdd] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isTogglingSaved, setIsTogglingSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const [quickDate, setQuickDate] = useState('');
  const [quickDateInput, setQuickDateInput] = useState('');
  const [showSheetCalendar, setShowSheetCalendar] = useState(false);
  const [savedPortions, setSavedPortions] = useState<number | null>(null);
  const [savedGrams, setSavedGrams] = useState<number | null>(null);
  const [quickMealType, setQuickMealType] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => firstDayOfMonth(selectDate));

  useCloseOnBack(showMealPicker || showDatePicker, () => { setShowMealPicker(false); setShowDatePicker(false); });
  const addToPlanSheetRef = useBottomSheet(showAddToPlan, () => setShowAddToPlan(false));
  const menuSheetRef = useBottomSheet(showMenu, () => setShowMenu(false));

  const mealTypes = useMemo(() => profileMealTypes(profile), [profile]);
  const visibleMealTypes = useMemo(() => mealTypes.filter(meal => meal.visible !== false), [mealTypes]);

  const basePortions = recipe?.portions || 1;
  const safeWeight = (totalWeight && totalWeight > 0) ? totalWeight : DEFAULT_RECIPE_WEIGHT;

  useEffect(() => {
    let cancelled = false;

    async function loadRecipe() {
      if (!id) return;
      setLoading(true);
      let loaded: any = null;
      let weight = DEFAULT_RECIPE_WEIGHT;

      try {
        loaded = await api.recipes.getById(id);
        const loadedIngredients = Array.isArray(loaded?.ingredients) ? loaded.ingredients : [];
        const ingredientWeight = loadedIngredients.reduce((sum: number, ingredient: any) => sum + (ingredientGrams(ingredient) ?? 0), 0);
        weight = ingredientWeight > 0 ? ingredientWeight : DEFAULT_RECIPE_WEIGHT;
        if (cancelled) return;
        setRecipe(loaded ?? null);
        setIngredients(loadedIngredients);
        setTotalWeight(weight);
        setSaved(Boolean(loaded?.saved));
      } catch (err) {
        console.error('Error loading recipe:', err);
      }

      if (mealId && loaded) {
        try {
          const meals = await api.meals.getAll();
          const mealData = meals.find((m: any) => m.id === mealId);
          if (mealData && !cancelled) {
            const portions = mealData.portions_consumed;
            setSavedPortions(portions);
            setPortionInput(portions);
            const grams = Math.round(portions * (weight / (loaded.portions || 1)));
            setSavedGrams(grams);
            setGramInput(grams);
            setInputType('grams');
          }
        } catch (err) {
          console.error('Error fetching meal data:', err);
        }
      }
      if (!cancelled) setLoading(false);
    }

    loadRecipe();
    return () => {
      cancelled = true;
    };
  }, [id, mealId]);

  const consumedPortions =
    inputType === 'portions' ? (Number(String(portionInput).replace(',', '.')) || 0) :
    inputType === 'grams' ? (Number(String(gramInput).replace(',', '.')) ? (Number(String(gramInput).replace(',', '.')) / (safeWeight / basePortions)) : 0) :
    (quickPickPortions || 0);

  const gramsPerPortion = safeWeight / basePortions;
  const unchangedPlanItem = Boolean(mealId) && (savedPortions === null || (
    inputType === 'grams' ? gramInput === savedGrams : Math.abs(consumedPortions - savedPortions) < 1e-9
  ));

  const activeIngredientPortions = ingredientPortions !== null ? ingredientPortions : consumedPortions;

  const handleAddMeal = async (overrideDate?: string, overrideMealType?: string) => {
    const targetDate = overrideDate || activeDate || selectDate;
    const targetType = overrideMealType || activeMealType || selectType;
    if (!user || !recipe || !targetDate || !targetType) return;

    setIsAdding(true);

    if (mealId) {
      try {
        await api.meals.update(mealId, { portions_consumed: consumedPortions });
        await refreshMeals();
        navigate('/');
      } catch {
        setNotice(t('recipeDetails.updateFailed'));
        setIsAdding(false);
      }
      return;
    }

    for (let i = 0; i < daysToAdd; i++) {
      try {
        await api.meals.add({
          recipe: { id: recipe.id },
          meal_date: addDaysToIsoDate(targetDate, i),
          meal_type: targetType,
          portions_consumed: consumedPortions
        });
      } catch (err) {
        console.error("Error adding meal:", err);
      }
    }

    if (!overrideDate) {
      await addSelectionAfterItem(readPlanSelection(location.state), { kind: 'recipe', id: String(recipe.id) }, targetDate, targetType);
    }

    await refreshMeals();
    if (overrideDate) {
      setShowAddToPlan(false);
      setSuccessToast(t('recipeDetails.addedToPlan'));
      setTimeout(() => setSuccessToast(null), 3000);
    } else {
      navigate('/');
    }
  };

  const leaveDetails = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate('/recipes');
  };

  const handleDelete = async () => {
    if (!recipe) return;
    setIsDeleting(true);
    try {
      await api.recipes.archive(recipe.id);
      announceDeletedRecipe({ id: recipe.id, name: recipe.name });
      await refreshRecipes();
      leaveDetails();
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setNotice(t('recipeDelete.failed'));
    }
  };

  const toggleSaved = async () => {
    if (!recipe || isTogglingSaved) return;
    const next = !saved;
    setSaved(next);
    setIsTogglingSaved(true);
    try {
      if (next) await api.recipes.save(recipe.id);
      else await api.recipes.unsave(recipe.id);
      await refreshRecipes();
    } catch (err) {
      console.error('Error saving recipe:', err);
      setSaved(!next);
      setNotice(t('recipeDetails.savedFailed'));
    } finally {
      setIsTogglingSaved(false);
    }
  };

  const handleEdit = () => {
    setShowMenu(false);
    navigate(`/edit-recipe/${recipe.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">error</span>
        <h2 className="font-headline text-xl font-bold text-on-surface mb-2">{t('recipeDetails.notFound')}</h2>
        <button onClick={leaveDetails} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl active:scale-95 transition-transform mt-6">{t('recipeDetails.back')}</button>
      </div>
    );
  }

  const displaySuffix =
    inputType === 'portions' ? t('recipeDetails.nutritionForPortions', { count: Number(portionInput) || 0, portions: portionWord(Number(portionInput) || 0) }) :
    inputType === 'grams' ? t('recipeDetails.nutritionForGrams', { grams: gramInput === '' ? 0 : Math.round(Number(gramInput)) }) :
    '';
  const currentKcal = Math.round(recipe.kcal * consumedPortions);
  const currentP = parseFloat((recipe.protein * consumedPortions).toFixed(1));
  const currentF = parseFloat((recipe.fat * consumedPortions).toFixed(1));
  const currentC = parseFloat((recipe.carbs * consumedPortions).toFixed(1));

  const calP = recipe.protein * 4;
  const calF = recipe.fat * 9;
  const calC = recipe.carbs * 4;
  const totalCal = calP + calF + calC || 1;

  const pctP = Math.round((calP / totalCal) * 100);
  const pctF = Math.round((calF / totalCal) * 100);
  const pctC = Math.round((calC / totalCal) * 100);

  const todayStr = todayIsoDate();
  const dateDisplay = formatShortDayLabel(selectDate || '');

  const mealLabel = mealTypes.find(m => m.id === activeMealType)?.name || activeMealType || selectType || '';
  const isOwn = recipe.own !== false;

  const activeDateDisplay = activeDate ? formatShortDayLabel(activeDate) : dateDisplay;

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">

      <div className={`fixed top-[calc(1.25rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${successToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-3 bg-primary/10 backdrop-blur-md border border-primary/20 text-primary px-5 py-3 rounded-full shadow-lg whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
          <span className="font-headline font-bold text-sm tracking-wide">{successToast}</span>
        </div>
      </div>
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl px-4 py-3 pt-safe-3 flex items-center gap-4 border-b border-outline-variant/10">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('recipeDetails.back')}
          className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform hover:text-on-surface shrink-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        {selectType && selectDate ? (
          <div className="flex flex-col pt-0.5 flex-1 relative">

            <div className="relative">
              <button
                disabled={Boolean(mealId)}
                onClick={() => { setShowMealPicker(v => !v); setShowDatePicker(false); }}
                className="flex items-center gap-1 font-headline font-bold text-[15px] sm:text-base text-on-surface leading-tight active:scale-95 transition-transform"
              >
                <span>{t(mealId ? 'recipeDetails.editingIn' : 'recipeDetails.addingTo')} <span className="text-primary">{mealLabel}</span></span>
                {!mealId && <span className={`material-symbols-outlined text-[14px] text-primary transition-transform ${showMealPicker ? 'rotate-180' : ''}`}>expand_more</span>}
              </button>
              {showMealPicker && (
                <div className="absolute top-full left-0 mt-1 z-[200] bg-surface rounded-2xl shadow-xl border border-outline-variant/20 py-1 min-w-[180px]">
                  {visibleMealTypes.map(meal => (
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

            <div className="relative">
              <button
                disabled={Boolean(mealId)}
                onClick={() => { setShowDatePicker(v => !v); setShowMealPicker(false); }}
                className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest leading-tight active:scale-95 transition-transform w-fit"
              >
                <span>{activeDateDisplay}</span>
                {!mealId && <span className={`material-symbols-outlined text-[11px] text-primary/70 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}>expand_more</span>}
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-1 z-[200] bg-surface rounded-2xl shadow-xl border border-outline-variant/20 p-3 w-[260px]">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label={t('recipeDetails.previousMonth')} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90">
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="text-xs font-black text-on-surface uppercase tracking-widest">{calendarDate.toLocaleDateString(t('recipeDetails.locale'), { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label={t('recipeDetails.nextMonth')} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90">
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAY_KEYS.map(key => (
                      <span key={key} className="text-center text-[9px] font-bold text-on-surface-variant/50 py-0.5">{t(key)}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {(() => {
                      const year = calendarDate.getFullYear();
                      const month = calendarDate.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const offset = firstDay === 0 ? 6 : firstDay - 1;
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const cells = [];
                      for (let i = 0; i < offset; i++) cells.push(<span key={`e${i}`} />);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const ds = toIsoDate(new Date(year, month, d));
                        const isActive = activeDate === ds;
                        const isTodayDay = todayStr === ds;
                        cells.push(
                          <button key={d} onClick={() => { setActiveDate(ds); setShowDatePicker(false); }}
                            className={`w-full aspect-square flex items-center justify-center rounded-full text-xs font-bold transition-all active:scale-90 ${isActive ? 'bg-primary text-on-primary' : isTodayDay ? 'border border-primary text-primary' : 'text-on-surface hover:bg-surface-container'}`}>
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

            {(showMealPicker || showDatePicker) && (
              <div data-scroll-lock className="fixed inset-0 z-[199]" onClick={() => { setShowMealPicker(false); setShowDatePicker(false); }} />
            )}
          </div>
        ) : (
          <h1 className="font-headline font-bold text-[15px] sm:text-base text-on-surface leading-tight flex-1">{t('recipeDetails.title')}</h1>
        )}
        {isOwn ? (
          <button
            onClick={() => setShowMenu(true)}
            aria-label={t('recipeDetails.menu')}
            className="w-10 h-10 ml-auto rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform hover:bg-surface-container-highest shrink-0"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        ) : (
          <button
            onClick={toggleSaved}
            disabled={isTogglingSaved}
            aria-pressed={saved}
            aria-label={t(saved ? 'recipeDetails.unsave' : 'recipeDetails.save')}
            className={`w-10 h-10 ml-auto rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-surface-container-highest shrink-0 ${saved ? 'text-rose-500' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
          </button>
        )}
      </header>

      <div className="relative w-full h-48 sm:h-64 bg-surface-container-highest shrink-0 overflow-hidden">
        <RecipeCoverImage
          recipe={recipe}
          alt={recipe.name}
          className="absolute inset-0 w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
      </div>

      <div className="max-w-xl mx-auto w-full px-4 pt-3">
        <h1 className="font-headline font-bold text-xl text-on-surface tracking-tight leading-tight shrink-0">{recipe.name}</h1>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xl mx-auto px-4 pt-2">
            <div className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${inputType === 'portions' ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}>
              <div className="flex items-center gap-2 pl-0.5">
                  <input
                    {...numberFieldProps(AMOUNT_LIMITS.portion)}
                    aria-label={t('recipeDetails.portionsInput')}
                    value={portionInput}
                    onFocus={() => setInputType('portions')}
                    onChange={(e) => {
                      if (!acceptsLimitedNumber(e.target.value, AMOUNT_LIMITS.portion)) return;
                      setInputType('portions');
                      setPortionInput(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${inputType === 'portions' ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
                  />
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-on-surface-variant text-sm shrink-0 whitespace-nowrap">
                    {portionWord(Number(portionInput) || 0)}
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant/60 ml-0.5 whitespace-nowrap">({formatCompactNumber(Number(portionInput || 0) * gramsPerPortion)}g)</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 ml-auto shrink-0">
                <span data-testid="portions-kcal" className={`font-black text-xl tabular-nums whitespace-nowrap transition-colors ${inputType === 'portions' ? 'text-primary' : 'text-on-surface'}`}>{formatCompactNumber(recipe.kcal * (Number(portionInput) || 0))}</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
              </div>
            </div>


            <div className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${inputType === 'grams' ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}>
              <div className="flex items-center gap-2 pl-0.5">
                  <input
                    {...numberFieldProps(AMOUNT_LIMITS.g)}
                    aria-label={t('recipeDetails.gramsInput')}
                    value={gramInput}
                    onFocus={() => setInputType('grams')}
                    onChange={(e) => {
                      if (!acceptsLimitedNumber(e.target.value, AMOUNT_LIMITS.g)) return;
                      setInputType('grams');
                      setGramInput(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${inputType === 'grams' ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
                  />
                <span className="font-bold text-on-surface-variant text-sm shrink-0 whitespace-nowrap">g</span>
              </div>
              <div className="flex items-baseline gap-1 ml-auto shrink-0">
                <span data-testid="grams-kcal" className={`font-black text-xl tabular-nums whitespace-nowrap transition-colors ${inputType === 'grams' ? 'text-primary' : 'text-on-surface'}`}>
                  {formatCompactNumber(recipe.kcal * (Number(gramInput) ? (Number(gramInput) / gramsPerPortion) : 0))}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
              </div>
            </div>
      </div>

      <main className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col gap-10">

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">{t('recipeDetails.kcalTitle')} <span className="text-on-surface-variant font-medium text-sm">{t('recipeDetails.kcalPortion', { grams: formatCompactNumber(consumedPortions * gramsPerPortion) })}</span></h2>
            <p className="text-xs text-on-surface-variant mt-1">{t('recipeDetails.kcalHint')}</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-hide snap-x">
            {(() => {
              const baseKcal = Math.round(recipe.kcal);
              return QUICK_PICK_MULTIPLIERS.map((m) => {
                const kcalOption = Math.round(baseKcal * m);
                const isSelected = inputType === 'quick-pick' && quickPickPortions !== null && Math.abs(quickPickPortions - m) < 0.01;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setInputType('quick-pick');
                      setQuickPickPortions(m);
                    }}
                    className={`shrink-0 w-[78px] py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex flex-col items-center justify-center snap-center ${
                      isSelected
                        ? 'bg-[#e2f0d9] text-[#2d4d1e] border-[#b5ccaa] shadow-sm dark:bg-primary/20 dark:text-primary dark:border-primary/40'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/20 hover:border-on-surface/30'
                    }`}
                  >
                    {formatCompactNumber(kcalOption)} kcal
                  </button>
                );
              });
            })()}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">
              {t('recipeDetails.nutritionTitle')} {displaySuffix}
            </h2>
          </div>

          <div className="flex items-center justify-between gap-1 sm:gap-4 px-2">

            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px] flex items-center justify-center">
                 <span data-testid="kcal-value" className={`font-black ${fitTextClass(formatCompactNumber(currentKcal), KCAL_HERO_SIZES, 3)} text-on-surface leading-none text-center max-w-full break-words`}>{formatCompactNumber(currentKcal)}</span>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">kcal</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#4F46E5 ${pctP}%, #4F46E510 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="protein-value" className={`font-black ${fitTextClass(gramsLabel(currentP), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentP)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">{t('recipeDetails.protein')}</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#F59E0B ${pctF}%, #F59E0B10 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="fat-value" className={`font-black ${fitTextClass(gramsLabel(currentF), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentF)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">{t('recipeDetails.fat')}</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10B981 ${pctC}%, #10B98110 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="carbs-value" className={`font-black ${fitTextClass(gramsLabel(currentC), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentC)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">{t('recipeDetails.carbs')}</span>
            </div>

          </div>
        </section>

        <RecipeMoreNutrients ingredients={ingredients} portions={basePortions} />

        {ingredients && ingredients.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-on-surface-variant flex items-center gap-1 flex-wrap leading-tight">
                <span>{t('recipeDetails.ingredientsFor', { portions: t(`recipeDetails.portionsAccusative.${portionForm(activeIngredientPortions)}` as MessageKey, { count: Math.round(activeIngredientPortions * 100) / 100 }) })}</span>
                <span className="normal-case opacity-70">({formatCompactNumber(activeIngredientPortions * gramsPerPortion)}g)</span>
              </h2>

              <div className="flex items-center bg-surface-container-low rounded-xl p-1 shadow-sm border border-outline-variant/10">
                <button
                  onClick={() => setIngredientPortions(p => Math.max(0.25, (p !== null ? p : consumedPortions) - 0.25))}
                  aria-label={t('recipeDetails.fewerPortions')}
                  className="w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <div className="min-w-8 px-1 text-center font-bold text-sm text-on-surface select-none whitespace-nowrap">
                  {Math.round(activeIngredientPortions * 100) / 100}
                </div>
                <button
                  onClick={() => setIngredientPortions(p => (p !== null ? p : consumedPortions) + 0.25)}
                  aria-label={t('recipeDetails.morePortions')}
                  className="w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {ingredients.map((ing, idx) => {
                const scaledAmount = ((Number(ing.amount) || 0) * (activeIngredientPortions / basePortions)).toFixed(1).replace(/\.0$/, '');
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/10">
                    <span className="font-bold text-sm text-on-surface capitalize min-w-0 break-words">{ing.name}</span>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-lg whitespace-nowrap shrink-0 ml-2">
                      {scaledAmount} {ingredientUnitLabel(ing.unit, Number(scaledAmount), ing.product)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {selectDate && !loading && (
          <section className="mt-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`w-full py-4 px-6 rounded-3xl flex items-center justify-between transition-all duration-300 border ${showPreview ? 'bg-primary/5 border-primary/20 mb-4' : 'bg-surface-container-highest/30 border-transparent hover:bg-surface-container-highest/50'}`}
            >
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-[22px]">{showPreview ? 'visibility_off' : 'analytics'}</span>
                <span className="font-headline font-bold text-sm tracking-tight">
                  {showPreview ? t('recipeDetails.hidePreview') : t('recipeDetails.showPreview')}
                </span>
              </div>
              <span className={`material-symbols-outlined transition-transform duration-300 ${showPreview ? 'rotate-180 text-primary' : 'text-on-surface-variant'}`}>
                expand_more
              </span>
            </button>

            {showPreview && (() => {
              const consumed = getConsumedForDay(selectDate);
              const after = {
                kcal: Math.round(consumed.kcal + currentKcal),
                protein: parseFloat((consumed.protein + currentP).toFixed(1)),
                fat: parseFloat((consumed.fat + currentF).toFixed(1)),
                carbs: parseFloat((consumed.carbs + currentC).toFixed(1))
              };

              const currentData = previewMode === 'after' ? after : consumed;

              return (
                <div className="bg-surface-container-low rounded-[32px] p-6 border border-outline-variant/10 shadow-sm animate-slide-up">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                      </div>
                      <div>
                        <h3 className="font-headline font-bold text-sm text-on-surface leading-tight">
                          {previewMode === 'after' ? t('recipeDetails.previewAfterTitle') : t('recipeDetails.previewBeforeTitle')}
                        </h3>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{dateDisplay}</p>
                      </div>
                    </div>

                    <div className="flex bg-surface-container-highest p-1 rounded-2xl border border-outline-variant/5">
                      <button
                        onClick={() => setPreviewMode('before')}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === 'before' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        {t('recipeDetails.previewBefore')}
                      </button>
                      <button
                        onClick={() => setPreviewMode('after')}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === 'after' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        {t('recipeDetails.previewAfter')}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-baseline leading-none gap-1">
                        <span className="text-primary uppercase tracking-normal text-[8px] font-bold">{t('recipeDetails.kcalTitle')}</span>
                        <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                          <span className={`text-[10px] font-extrabold ${profile && currentData.kcal > profile.target_kcal ? 'text-error' : 'text-primary'}`}>
                            {formatCompactNumber(currentData.kcal)}
                          </span>
                          <span className="mx-0.5 opacity-50">/</span>
                          {profile?.target_kcal || '···'} kcal
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.min(100, (currentData.kcal / profile.target_kcal) * 100)}%` : '0%' }}></div>
                        <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.max(0, Math.min(100, ((currentData.kcal / profile.target_kcal) * 100) - 100))}%` : '0%' }}></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold">{t('recipeDetails.protein')}</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && currentData.protein > (profile.target_protein_max || profile.target_protein * 1.1) ? 'text-error' : 'text-primary'}`}>
                              {formatCompactNumber(currentData.protein, 1)}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile ? targetRange(profile.target_protein, profile.target_protein_min, profile.target_protein_max) : '··'}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative text-primary">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.min(100, (currentData.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-300" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((currentData.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold">{t('recipeDetails.fat')}</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                             <span className={`text-[9px] font-extrabold ${profile && currentData.fat > (profile.target_fat_max || profile.target_fat * 1.1) ? 'text-error' : 'text-primary'}`}>
                              {formatCompactNumber(currentData.fat, 1)}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile ? targetRange(profile.target_fat, profile.target_fat_min, profile.target_fat_max) : '··'}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.min(100, (currentData.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-300" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((currentData.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold">{t('recipeDetails.carbs')}</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                             <span className={`text-[9px] font-extrabold ${profile && currentData.carbs > (profile.target_carbs_max || profile.target_carbs * 1.1) ? 'text-error' : 'text-primary'}`}>
                              {formatCompactNumber(currentData.carbs, 1)}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile ? targetRange(profile.target_carbs, profile.target_carbs_min, profile.target_carbs_max) : '··'}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.min(100, (currentData.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-300" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((currentData.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {recipe.instructions && recipe.instructions.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('recipeDetails.steps')}</h2>
            <div className="flex flex-col gap-5">
              {recipe.instructions.map((step: string, idx: number) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 text-sm border border-primary/20">
                    {idx + 1}
                  </div>
                  <p className="text-[15px] text-on-surface-variant leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {selectDate && selectType && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/10 p-4 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-xl mx-auto w-full flex gap-3 items-center">

            {!mealId && (
              <div className="flex items-center bg-surface-container-low border border-outline-variant/20 rounded-2xl p-1 h-[56px] shadow-sm">
                <button
                  onClick={() => setDaysToAdd(prev => Math.max(1, prev - 1))}
                  aria-label={t('recipeDetails.fewerDays')}
                  className="w-10 h-full flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-xl transition-all font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>

                <div className="px-2 min-w-[60px] flex flex-col items-center justify-center -space-y-1">
                  <span className="font-black text-lg text-on-surface leading-none">{daysToAdd}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">{t('recipeDetails.days')}</span>
                </div>

                <button
                  onClick={() => setDaysToAdd(prev => Math.min(30, prev + 1))}
                  aria-label={t('recipeDetails.moreDays')}
                  className="w-10 h-full flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-xl transition-all font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            )}

            <button
              onClick={() => handleAddMeal()}
              disabled={isAdding || !(consumedPortions > 0) || unchangedPlanItem}
              className="flex-1 h-[56px] bg-[#6B8E23] hover:bg-[#5a781d] text-white font-black text-base rounded-[20px] transition-all active:scale-[0.98] disabled:opacity-50 shadow-[0_4px_12px_rgba(107,142,35,0.3)] flex items-center justify-center gap-3"
            >
              {isAdding ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span>{t(mealId ? 'recipeDetails.update' : 'recipeDetails.add')}</span>
              )}
            </button>

          </div>
        </div>
      )}

      {!selectDate && !selectType && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/10 p-4 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-xl mx-auto w-full">
            <button
              onClick={() => setShowAddToPlan(true)}
              className="w-full h-[56px] bg-[#6B8E23] hover:bg-[#5a781d] text-white font-black text-base rounded-[20px] transition-all active:scale-[0.98] shadow-[0_4px_12px_rgba(107,142,35,0.3)] flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-[22px]">add_circle</span>
              {t('recipeDetails.addToPlan')}
            </button>
          </div>
        </div>
      )}

      {showAddToPlan && (
        <div data-scroll-lock className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowAddToPlan(false)}>
          <div ref={addToPlanSheetRef} className="w-full max-w-xl max-h-[92dvh] overflow-y-auto overscroll-contain bg-surface rounded-t-[32px] p-6 pb-8 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6" />
            <h2 className="font-headline font-bold text-xl text-on-surface mb-5">{t('recipeDetails.planSheetTitle')}</h2>

            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">{t('recipeDetails.day')}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(() => {
                const today = todayIsoDate();
                return [
                  { label: t('recipeDetails.today'), val: today },
                  { label: t('recipeDetails.tomorrow'), val: addDaysToIsoDate(today, 1) },
                  { label: t('recipeDetails.dayAfterTomorrow'), val: addDaysToIsoDate(today, 2) },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => { setQuickDate(opt.val); setQuickDateInput(opt.val); }}
                    className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all active:scale-95 ${
                      quickDate === opt.val
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] font-medium opacity-60">{formatDayMonth(opt.val)}</div>
                  </button>
                ));
              })()}
            </div>
            <div className="mb-5">
              <button
                type="button"
                aria-expanded={showSheetCalendar}
                onClick={() => setShowSheetCalendar(open => !open)}
                className={`w-full flex items-center gap-3 py-3 px-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  quickDateInput
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                <span className="font-bold text-sm flex-1 text-left">
                  {quickDateInput ? new Date(quickDateInput + 'T00:00:00').toLocaleDateString(t('recipeDetails.locale'), { weekday: 'long', day: 'numeric', month: 'long' }) : t('recipeDetails.otherDate')}
                </span>
                <span className={`material-symbols-outlined text-[18px] opacity-40 transition-transform ${showSheetCalendar ? 'rotate-90' : ''}`}>chevron_right</span>
              </button>
              {showSheetCalendar && (
                <div className="mt-2 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-3">
                  <MonthCalendar
                    selected={quickDate}
                    onSelect={iso => {
                      setQuickDate(iso);
                      setQuickDateInput(iso);
                      setShowSheetCalendar(false);
                    }}
                  />
                </div>
              )}
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">{t('recipeDetails.mealTime')}</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {visibleMealTypes.map(meal => (
                <button
                  key={meal.id}
                  onClick={() => setQuickMealType(meal.id)}
                  className={`py-3 px-4 rounded-2xl font-bold text-sm border-2 text-left transition-all active:scale-95 ${
                    quickMealType === meal.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {meal.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (quickDate && quickMealType) handleAddMeal(quickDate, quickMealType);
              }}
              disabled={isAdding || !quickDate || !quickMealType}
              className="w-full h-[56px] bg-[#6B8E23] text-white font-black text-base rounded-[20px] transition-all active:scale-[0.98] disabled:opacity-40 shadow-[0_4px_12px_rgba(107,142,35,0.3)] flex items-center justify-center gap-3"
            >
              {isAdding ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('recipeDetails.addToPlan')}
            </button>
          </div>
        </div>
      )}

      {showMenu && (
        <div data-scroll-lock className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowMenu(false)}>
          <div
            ref={menuSheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-menu-title"
            className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl px-6 pt-4 pb-safe-6 flex flex-col gap-2 animate-slide-up sm:animate-fade-in relative shadow-ambient"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-2 sm:hidden" />
            <h3 id="recipe-menu-title" className="font-headline font-bold text-xl text-on-surface mb-3">{t('recipeDetails.menuTitle')}</h3>

            <button onClick={handleEdit} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-left">
              <span className="material-symbols-outlined text-primary">edit</span>
              <span className="flex flex-col">
                <span className="font-bold text-on-surface">{t('recipeDetails.edit')}</span>
                <span className="text-xs text-on-surface-variant">{t('recipeDetails.editHint')}</span>
              </span>
            </button>

            <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} className="flex items-center gap-4 p-4 rounded-xl bg-error/5 hover:bg-error/10 transition-colors text-left border border-error/10">
              <span className="material-symbols-outlined text-error">delete</span>
              <span className="font-bold text-error">{t('recipeDelete.confirm')}</span>
            </button>

            <button onClick={() => setShowMenu(false)} className="w-full py-4 mt-1 font-bold text-on-surface-variant rounded-2xl active:scale-[0.98] transition-all">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <RecipeDeleteSheet
          recipe={recipe}
          deleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {notice && <UndoSnackbar message={notice} onClose={closeNotice} />}

    </div>
  );
}
