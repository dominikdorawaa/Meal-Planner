import { useCallback, useEffect, useId, useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { addDaysToIsoDate, formatDayMonth, formatShortDayLabel, todayIsoDate } from '../lib/planDates';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { DayBalancePreview } from '../components/DayBalancePreview';
import { macroRingBackground } from '../lib/macroColors';
import { NutritionFactsTable } from '../components/NutritionFactsTable';
import { NUTRITION_TABLE_FACTS, recipeExtraNutrients, type ExtraNutrient } from '../lib/nutrients';
import { addSelectionAfterItem, readPlanSelection } from '../lib/planSelection';
import { useBottomSheet } from '../lib/bottomSheet';
import { ingredientBaseAmountLabel, ingredientGrams, ingredientNutrition, ingredientsWithoutProduct, ingredientUnitLabel } from '../lib/recipeIngredient';
import { profileMealTypes } from '../lib/mealTypes';
import { announceDeletedRecipe } from '../lib/deletedRecipe';
import { RecipeDeleteSheet } from '../components/RecipeDeleteSheet';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { pluralForm, t, type MessageKey } from '../i18n';
import { AMOUNT_LIMITS, acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';
import { formatCompactNumber } from '../lib/compactNumber';
import { KCAL_HERO_SIZES, RING_VALUE_SIZES, fitTextClass } from '../lib/fitText';
import { MonthCalendar } from '../components/MonthCalendar';
import { PlanTargetPicker } from '../components/PlanTargetPicker';

const DEFAULT_RECIPE_WEIGHT = 300;
const GRAMS_MEASURE = 'g';
const PORTIONS_MEASURE = 'portion';
const QUICK_PICK_MEASURE = 'quick-pick';
const SAVED_GRAMS_TOLERANCE = 0.5;

type AmountInputType = 'portions' | 'grams' | 'quick-pick';

function gramsLabel(value: number): string {
  return `${formatCompactNumber(value, 1)}g`;
}
const QUICK_PICK_MULTIPLIERS = [0.5, 1, 1.5, 2];
const PORTION_STEP = 0.5;

function portionForm(count: number): string {
  return Number.isInteger(count) ? pluralForm(count) : 'fraction';
}

function portionWord(count: number): string {
  return t(`recipeDetails.portionWord.${portionForm(count)}` as MessageKey);
}

function portionsAccusative(count: number): string {
  return t(`recipeDetails.portionsAccusative.${portionForm(count)}` as MessageKey, { count: Math.round(count * 100) / 100 });
}

export function RecipeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, refreshRecipes, getConsumedForDay, profile } = useAppData();

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [recipe, setRecipe] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [totalWeight, setTotalWeight] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const [inputType, setInputType] = useState<AmountInputType>('portions');
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
  const [showNutritionTable, setShowNutritionTable] = useState(false);
  const nutritionTableId = useId();
  const [quickDate, setQuickDate] = useState('');
  const [quickDateInput, setQuickDateInput] = useState('');
  const [showSheetCalendar, setShowSheetCalendar] = useState(false);
  const [savedPortions, setSavedPortions] = useState<number | null>(null);
  const [savedGrams, setSavedGrams] = useState<number | null>(null);
  const [savedInputType, setSavedInputType] = useState<AmountInputType | null>(null);
  const [quickMealType, setQuickMealType] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');

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
            if (mealData.measure_code === GRAMS_MEASURE) {
              const calculatedGrams = portions * (weight / (loaded.portions || 1));
              const storedGrams = mealData.measure_amount;
              const grams = storedGrams != null && Math.abs(storedGrams - calculatedGrams) < SAVED_GRAMS_TOLERANCE
                ? storedGrams
                : Math.round(calculatedGrams);
              setSavedGrams(grams);
              setGramInput(grams);
              setInputType('grams');
              setSavedInputType('grams');
            } else if (mealData.measure_code === QUICK_PICK_MEASURE) {
              setQuickPickPortions(portions);
              setInputType('quick-pick');
              setSavedInputType('quick-pick');
            } else {
              setPortionInput(portions);
              setInputType('portions');
              setSavedInputType('portions');
            }
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
    inputType === savedInputType
    && (inputType === 'grams' ? gramInput === savedGrams : Math.abs(consumedPortions - savedPortions) < 1e-9)
  ));

  const nutritionPortions = unchangedPlanItem && savedPortions !== null ? savedPortions : consumedPortions;

  const activeIngredientPortions = ingredientPortions !== null ? ingredientPortions : basePortions;

  const amountMeasure = inputType === 'grams'
    ? { measure_code: GRAMS_MEASURE, measure_amount: Number(String(gramInput).replace(',', '.')) }
    : { measure_code: inputType === 'quick-pick' ? QUICK_PICK_MEASURE : PORTIONS_MEASURE, measure_amount: null };

  const handleAddMeal = async (overrideDate?: string, overrideMealType?: string) => {
    const targetDate = overrideDate || activeDate || selectDate;
    const targetType = overrideMealType || activeMealType || selectType;
    if (!user || !recipe || !targetDate || !targetType) return;

    setIsAdding(true);

    if (mealId) {
      try {
        await api.meals.update(mealId, { portions_consumed: consumedPortions, ...amountMeasure });
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
          portions_consumed: consumedPortions,
          ...amountMeasure
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
  const currentKcal = Math.round(recipe.kcal * nutritionPortions);
  const currentP = parseFloat((recipe.protein * nutritionPortions).toFixed(1));
  const currentF = parseFloat((recipe.fat * nutritionPortions).toFixed(1));
  const currentC = parseFloat((recipe.carbs * nutritionPortions).toFixed(1));

  const calP = recipe.protein * 4;
  const calF = recipe.fat * 9;
  const calC = recipe.carbs * 4;
  const totalCal = calP + calF + calC || 1;

  const pctP = Math.round((calP / totalCal) * 100);
  const pctF = Math.round((calF / totalCal) * 100);
  const pctC = Math.round((calC / totalCal) * 100);

  const activeDateDisplay = formatShortDayLabel(activeDate || selectDate || '');

  const isOwn = recipe.own !== false;
  const withoutProduct = ingredientsWithoutProduct(ingredients);
  const extraNutrients = recipeExtraNutrients(ingredients, basePortions);
  const extraNutrientNotes = Object.fromEntries(
    Object.entries(extraNutrients.missing).map(([nutrient, names]) => [nutrient as ExtraNutrient, t('nutrients.incomplete', { names: names.join(', ') })]),
  );

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">

      <div className={`fixed top-[calc(1.25rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${successToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-3 bg-primary/10 backdrop-blur-md border border-primary/20 text-primary px-5 py-3 rounded-full shadow-lg whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
          <span className="font-headline font-bold text-sm tracking-wide">{successToast}</span>
        </div>
      </div>
      <header className={`sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl px-4 py-3 pt-safe-3 flex items-center gap-4 border-b border-outline-variant/10`}>
        <button
          onClick={() => navigate(-1)}
          aria-label={t('recipeDetails.back')}
          className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform hover:text-on-surface shrink-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        {selectType && selectDate ? (
          <PlanTargetPicker
            meals={visibleMealTypes}
            mealType={activeMealType}
            date={activeDate}
            editing={Boolean(mealId)}
            onMealTypeChange={setActiveMealType}
            onDateChange={setActiveDate}
          />
        ) : (
          <h1 className="font-headline font-bold text-[15px] sm:text-base text-on-surface leading-tight flex-1">{t('recipeDetails.title')}</h1>
        )}
        {isOwn && (
          <button
            onClick={() => setShowMenu(true)}
            aria-label={t('recipeDetails.menu')}
            className="w-10 h-10 ml-auto rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform hover:bg-surface-container-highest shrink-0"
          >
            <span className="material-symbols-outlined">more_vert</span>
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
        <button
          onClick={toggleSaved}
          disabled={isTogglingSaved}
          aria-pressed={saved}
          aria-label={t(saved ? 'recipeDetails.unsave' : 'recipeDetails.save')}
          className={`absolute top-3 right-3 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform ${saved ? 'text-rose-400' : 'text-white'}`}
        >
          <span className="material-symbols-outlined text-[22px]" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
        </button>
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

          {withoutProduct.length > 0 && (
            <div role="status" className="flex flex-col gap-3 rounded-2xl px-4 py-3 bg-error/10 text-on-surface">
              <p className="flex items-start gap-2 text-sm font-medium">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-error">info</span>
                <span>{t('recipeDetails.incompleteNutrition', { names: withoutProduct.map(ingredient => ingredient.name).join(', ') })}</span>
              </p>
              {isOwn && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="self-start px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold active:scale-95 transition-transform"
                >
                  {t('recipeDetails.completeProducts')}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-1 sm:gap-4 px-2">

            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px] flex items-center justify-center">
                 <span data-testid="kcal-value" className={`font-black ${fitTextClass(formatCompactNumber(currentKcal), KCAL_HERO_SIZES, 3)} text-on-surface leading-none text-center max-w-full break-words`}>{formatCompactNumber(currentKcal)}</span>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">kcal</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: macroRingBackground('protein', pctP) }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="protein-value" className={`font-black ${fitTextClass(gramsLabel(currentP), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentP)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">{t('recipeDetails.protein')}</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: macroRingBackground('fat', pctF) }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="fat-value" className={`font-black ${fitTextClass(gramsLabel(currentF), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentF)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">{t('recipeDetails.fat')}</span>
            </div>

            <button
              type="button"
              aria-expanded={showNutritionTable}
              aria-controls={nutritionTableId}
              aria-label={t(showNutritionTable ? 'nutrients.hideTable' : 'nutrients.showTable', { value: gramsLabel(currentC) })}
              onClick={() => setShowNutritionTable(open => !open)}
              className="flex items-start"
            >
              <span className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: macroRingBackground('carbs', pctC) }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="carbs-value" className={`font-black ${fitTextClass(gramsLabel(currentC), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentC)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">{t('recipeDetails.carbs')}</span>
              </span>
              <span aria-hidden="true" className={`material-symbols-outlined h-16 min-[360px]:h-[72px] flex items-center -mr-2 text-[28px] text-primary transition-transform ${showNutritionTable ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

          </div>

          {showNutritionTable && (
            <div id={nutritionTableId}>
              <NutritionFactsTable
                columns={[{
                  label: t('nutrients.recipePortion'),
                  values: { kcal: recipe.kcal, protein: recipe.protein, fat: recipe.fat, carbs: recipe.carbs, ...extraNutrients.values },
                }]}
                facts={NUTRITION_TABLE_FACTS}
                notes={extraNutrientNotes}
              />
            </div>
          )}
        </section>

        {ingredients && ingredients.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-on-surface-variant flex items-center gap-1 flex-wrap leading-tight">
                <span>{t('recipeDetails.ingredientsFor', { portions: portionsAccusative(activeIngredientPortions) })}</span>
                <span className="normal-case opacity-70">({formatCompactNumber(activeIngredientPortions * gramsPerPortion)}g)</span>
              </h2>

              <div className="flex items-center bg-surface-container-low rounded-xl p-1 shadow-sm border border-outline-variant/10">
                <button
                  onClick={() => setIngredientPortions(Math.max(PORTION_STEP, activeIngredientPortions - PORTION_STEP))}
                  aria-label={t('recipeDetails.fewerPortions')}
                  className="w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <div className="min-w-8 px-1 text-center font-bold text-sm text-on-surface select-none whitespace-nowrap">
                  {Math.round(activeIngredientPortions * 100) / 100}
                </div>
                <button
                  onClick={() => setIngredientPortions(activeIngredientPortions + PORTION_STEP)}
                  aria-label={t('recipeDetails.morePortions')}
                  className="w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 -mt-2 min-h-8">
              <span className="text-xs text-on-surface-variant">{t('recipeDetails.recipeFor', { portions: portionsAccusative(basePortions) })}</span>
              {Math.abs(activeIngredientPortions - basePortions) > 1e-9 && (
                <button
                  type="button"
                  onClick={() => setIngredientPortions(null)}
                  className="flex items-center gap-1 text-xs font-bold text-primary px-2 py-1.5 rounded-lg hover:bg-primary/10 active:scale-95 transition-all"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">restart_alt</span>
                  {t('recipeDetails.wholeRecipe')}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {ingredients.map((ing, idx) => {
                const exactAmount = (Number(ing.amount) || 0) * (activeIngredientPortions / basePortions);
                const scaledAmount = exactAmount.toFixed(1).replace(/\.0$/, '');
                const nutrition = ingredientNutrition({ ...ing, amount: exactAmount });
                const baseAmount = ingredientBaseAmountLabel({ ...ing, amount: exactAmount });
                return (
                  <div key={idx} data-testid="recipe-ingredient" className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/10">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-sm text-on-surface capitalize break-words">{ing.name}</span>
                      {nutrition ? (
                        <span className="flex flex-wrap items-baseline gap-x-2 leading-tight">
                          <span className="text-xs font-bold text-primary tabular-nums whitespace-nowrap">{formatCompactNumber(nutrition.kcal)} kcal</span>
                          <span className="text-[10px] font-medium text-on-surface-variant tabular-nums whitespace-nowrap">
                            {t('plan.summary.proteinShort')} {formatCompactNumber(nutrition.protein, 1)} g · {t('plan.summary.fatShort')} {formatCompactNumber(nutrition.fat, 1)} g · {t('plan.summary.carbsShort')} {formatCompactNumber(nutrition.carbs, 1)} g
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] italic text-on-surface-variant/70">{t('nutrients.noData')}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-lg whitespace-nowrap shrink-0 ml-2">
                      {scaledAmount} {ingredientUnitLabel(ing.unit, Number(scaledAmount), ing.product)}
                      {baseAmount && ` (${baseAmount})`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {selectDate && profile && (
          <DayBalancePreview
            dayLabel={activeDateDisplay}
            dayWithoutItem={getConsumedForDay(activeDate || selectDate, mealId)}
            item={{ kcal: currentKcal, protein: currentP, fat: currentF, carbs: currentC }}
            targets={profile}
            editing={Boolean(mealId)}
          />
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
