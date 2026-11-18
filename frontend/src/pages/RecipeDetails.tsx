import { useCallback, useEffect, useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { todayIsoDate } from '../lib/planDates';
import { RecipeGallery } from '../components/RecipeGallery';
import { recipeImages } from '../lib/recipeImage';
import { NutritionSummary } from '../components/NutritionSummary';
import { recipeExtraNutrients, type ExtraNutrient } from '../lib/nutrients';
import { addSelectionAfterItem, readPlanSelection } from '../lib/planSelection';
import { ingredientBaseAmountLabel, ingredientGrams, ingredientNutrition, ingredientsWithoutProduct, ingredientUnitLabel } from '../lib/recipeIngredient';
import { mealColor, mealTypeName, profileMealTypes } from '../lib/mealTypes';
import { announceDeletedRecipe } from '../lib/deletedRecipe';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { pluralForm, t, type MessageKey } from '../i18n';
import { AMOUNT_LIMITS } from '../lib/inputLimits';
import { formatCompactNumber } from '../lib/compactNumber';
import { scaleMacros } from '../lib/macros';
import { stepsOfRecipe } from '../lib/recipeSteps';
import { AmountField } from '../components/AmountField';
import { DayBalanceCard } from '../components/DayBalanceCard';
import { DetailsTopBar } from '../components/DetailsTopBar';
import { PlanTargetSheet } from '../components/PlanTargetSheet';
import { PlanAction, PlanActionGroup, PlanActionSheet, PlanSheetThumb } from '../components/PlanActionSheet';
import { addToMealLabel } from '../lib/planTarget';

const DEFAULT_RECIPE_WEIGHT = 300;
const GRAMS_MEASURE = 'g';
const PORTIONS_MEASURE = 'portion';
const QUICK_PICK_MEASURE = 'quick-pick';
const SAVED_GRAMS_TOLERANCE = 0.5;

type AmountInputType = 'portions' | 'grams' | 'quick-pick';

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

function toNumber(value: number | string | null | undefined): number {
  return Number(String(value ?? '').replace(',', '.')) || 0;
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
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isTogglingSaved, setIsTogglingSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [savedPortions, setSavedPortions] = useState<number | null>(null);
  const [savedGrams, setSavedGrams] = useState<number | null>(null);
  const [savedInputType, setSavedInputType] = useState<AmountInputType | null>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');

  const mealTypes = useMemo(() => profileMealTypes(profile), [profile]);
  const sheetMeals = useMemo(
    () => mealTypes
      .map((meal, index) => ({ id: meal.id, name: meal.name, color: mealColor(index), visible: meal.visible !== false }))
      .filter(meal => meal.visible),
    [mealTypes],
  );

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

  const gramsPerPortion = safeWeight / basePortions;
  const consumedPortions =
    inputType === 'portions' ? toNumber(portionInput) :
    inputType === 'grams' ? toNumber(gramInput) / gramsPerPortion :
    (quickPickPortions || 0);

  const unchangedPlanItem = Boolean(mealId) && (savedPortions === null || (
    inputType === savedInputType
    && (inputType === 'grams' ? gramInput === savedGrams : Math.abs(consumedPortions - savedPortions) < 1e-9)
  ));

  const nutritionPortions = unchangedPlanItem && savedPortions !== null ? savedPortions : consumedPortions;
  const activeIngredientPortions = ingredientPortions !== null ? ingredientPortions : basePortions;

  const amountMeasure = inputType === 'grams'
    ? { measure_code: GRAMS_MEASURE, measure_amount: toNumber(gramInput) }
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

    try {
      await api.meals.add({
        recipe: { id: recipe.id },
        meal_date: targetDate,
        meal_type: targetType,
        portions_consumed: consumedPortions,
        ...amountMeasure
      });
    } catch (err) {
      console.error("Error adding meal:", err);
    }

    if (!overrideDate) {
      await addSelectionAfterItem(readPlanSelection(location.state), { kind: 'recipe', id: String(recipe.id) }, targetDate, targetType);
    }

    await refreshMeals();
    if (overrideDate) {
      setShowAddToPlan(false);
      setIsAdding(false);
      setNotice(t('recipeDetails.addedToPlan'));
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
        <button onClick={leaveDetails} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-2xl active:scale-95 transition-transform mt-6">{t('recipeDetails.back')}</button>
      </div>
    );
  }

  const currentMacros = scaleMacros(recipe, nutritionPortions);
  const planMode = Boolean(selectDate && selectType);
  const isOwn = recipe.own !== false;
  const steps = stepsOfRecipe(recipe);
  const withoutProduct = ingredientsWithoutProduct(ingredients);
  const extraNutrients = recipeExtraNutrients(ingredients, basePortions);
  const extraNutrientNotes = Object.fromEntries(
    Object.entries(extraNutrients.missing).map(([nutrient, names]) => [nutrient as ExtraNutrient, t('nutrients.incomplete', { names: names.join(', ') })]),
  );
  const images = recipeImages(recipe);
  const prepTime = Number(recipe.prep_time) || 0;
  const consumedGrams = consumedPortions * gramsPerPortion;
  const fieldPortions = inputType === 'quick-pick' ? (quickPickPortions ?? '') : portionInput;
  const amountLabel = inputType === 'grams'
    ? `${formatCompactNumber(consumedGrams)} g`
    : `${formatCompactNumber(consumedPortions, 2)} ${portionWord(consumedPortions)} · ${formatCompactNumber(consumedGrams)} g`;
  const mealIndex = mealTypes.findIndex(meal => meal.id === activeMealType);
  const consumedForDay = (date: string) => getConsumedForDay(date, mealId);
  const thumb = <PlanSheetThumb kind="recipe" recipeImage={images[0] ?? null} alt={recipe.name} />;

  const onAmountChange = (next: number | '') => {
    if (inputType === 'grams') {
      setGramInput(next);
      return;
    }
    setPortionInput(next);
    setInputType('portions');
  };

  const onUnitChange = (unit: string) => {
    if (unit === GRAMS_MEASURE) {
      if (inputType !== 'grams') setGramInput(Math.min(AMOUNT_LIMITS.g, Math.round(consumedGrams)));
      setInputType('grams');
      return;
    }
    if (inputType !== 'portions') setPortionInput(Math.min(AMOUNT_LIMITS.portion, Math.round(consumedPortions * 10) / 10));
    setInputType('portions');
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">
      <div className="fixed top-0 inset-x-0 z-40 pt-safe">
        <div className="max-w-xl mx-auto">
          <DetailsTopBar
            overPhoto
            backLabel={t('recipeDetails.back')}
            onBack={() => navigate(-1)}
            target={planMode ? {
              mealName: mealTypeName(activeMealType, mealTypes),
              mealColor: mealColor(mealIndex),
              date: activeDate,
              editing: Boolean(mealId),
              onOpen: () => setShowTarget(true),
            } : null}
            saved={{ value: saved, busy: isTogglingSaved, label: t(saved ? 'recipeDetails.unsave' : 'recipeDetails.save'), onToggle: toggleSaved }}
            menu={isOwn ? { label: t('recipeDetails.menu'), onOpen: () => setShowMenu(true) } : null}
          />
        </div>
      </div>

      <RecipeGallery images={images} alt={recipe.name} />

      <main className="relative -mt-7 w-full max-w-xl mx-auto rounded-t-[28px] bg-surface pt-5 flex flex-col">
        <div className="px-4">
          <h1 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight leading-tight">{recipe.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13.5px] text-on-surface-variant">
            {prepTime > 0 && (
              <>
                <span aria-hidden="true" className="material-symbols-outlined text-[17px]">timer</span>
                <span>{t('recipes.minutes', { count: prepTime })}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{t('recipeDetails.recipeFor', { portions: portionsAccusative(basePortions) })}</span>
          </p>
        </div>

        <div className="px-4 mt-5">
          <AmountField
            label={t(inputType === 'grams' ? 'recipeDetails.gramsInput' : 'recipeDetails.portionsInput')}
            value={inputType === 'grams' ? gramInput : fieldPortions}
            max={inputType === 'grams' ? AMOUNT_LIMITS.g : AMOUNT_LIMITS.portion}
            unit={inputType === 'grams' ? GRAMS_MEASURE : PORTIONS_MEASURE}
            unitLabel={inputType === 'grams' ? 'g' : portionWord(toNumber(fieldPortions))}
            units={[
              { value: PORTIONS_MEASURE, label: t('recipeDetails.portionsInput') },
              { value: GRAMS_MEASURE, label: t('recipeDetails.gramsInput') },
            ]}
            note={inputType === 'grams' ? undefined : `${formatCompactNumber(consumedGrams)} g`}
            kcal={recipe.kcal * consumedPortions}
            onChange={onAmountChange}
            onUnitChange={onUnitChange}
          />
          <p className="mt-3.5 text-[13px] text-on-surface-variant">{t('recipeDetails.kcalPicks')}</p>
          <div className="mt-2 -mx-4 px-4 flex gap-2 overflow-x-auto scrollbar-hide">
            {QUICK_PICK_MULTIPLIERS.map(multiplier => {
              const selected = inputType === 'quick-pick' && quickPickPortions !== null && Math.abs(quickPickPortions - multiplier) < 0.01;
              return (
                <button
                  key={multiplier}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${formatCompactNumber(recipe.kcal * multiplier)} kcal, ${formatCompactNumber(gramsPerPortion * multiplier)} g`}
                  onClick={() => {
                    setInputType('quick-pick');
                    setQuickPickPortions(multiplier);
                  }}
                  className={`shrink-0 h-10 px-3.5 rounded-full inline-flex items-baseline gap-1.5 leading-10 whitespace-nowrap active:scale-95 transition-transform ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
                >
                  <span className="font-headline font-extrabold text-[15px] tabular-nums">{formatCompactNumber(recipe.kcal * multiplier)} kcal</span>
                  <span className={`text-[12.5px] tabular-nums ${selected ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{formatCompactNumber(gramsPerPortion * multiplier)} g</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 mt-7">
          <NutritionSummary
            title={t('recipeDetails.nutritionTitle')}
            subtitle={amountLabel}
            values={currentMacros}
            macroSplit={recipe}
            tableColumns={[{
              label: t('nutrients.recipePortion'),
              values: { kcal: recipe.kcal, protein: recipe.protein, fat: recipe.fat, carbs: recipe.carbs, ...extraNutrients.values },
            }]}
            tableNotes={extraNutrientNotes}
            notice={withoutProduct.length > 0 && (
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
          />
        </div>

        {ingredients.length > 0 && (
          <section className="px-4 mt-8 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-headline font-extrabold text-lg tracking-tight text-on-surface">{t('recipeDetails.ingredients')}</h2>
              <div className="flex items-center h-9 rounded-full bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setIngredientPortions(Math.max(PORTION_STEP, activeIngredientPortions - PORTION_STEP))}
                  aria-label={t('recipeDetails.fewerPortions')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface active:scale-90 transition-transform"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span className="min-w-16 px-1 text-center text-[13.5px] font-bold tabular-nums text-on-surface whitespace-nowrap">
                  {formatCompactNumber(activeIngredientPortions, 2)} {portionWord(activeIngredientPortions)}
                </span>
                <button
                  type="button"
                  onClick={() => setIngredientPortions(activeIngredientPortions + PORTION_STEP)}
                  aria-label={t('recipeDetails.morePortions')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface active:scale-90 transition-transform"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1 min-h-8">
              <span className="text-[13px] text-on-surface-variant">
                {t('recipeDetails.ingredientsFor', { portions: portionsAccusative(activeIngredientPortions) })} · {formatCompactNumber(activeIngredientPortions * gramsPerPortion)} g
              </span>
              {Math.abs(activeIngredientPortions - basePortions) > 1e-9 && (
                <button
                  type="button"
                  onClick={() => setIngredientPortions(null)}
                  className="flex items-center gap-1 text-[13px] font-bold text-primary px-2 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">restart_alt</span>
                  {t('recipeDetails.wholeRecipe')}
                </button>
              )}
            </div>

            <div className="flex flex-col divide-y divide-outline-variant/10">
              {ingredients.map((ing, idx) => {
                const exactAmount = (Number(ing.amount) || 0) * (activeIngredientPortions / basePortions);
                const scaledAmount = exactAmount.toFixed(1).replace(/\.0$/, '');
                const nutrition = ingredientNutrition({ ...ing, amount: exactAmount });
                const baseAmount = ingredientBaseAmountLabel({ ...ing, amount: exactAmount });
                return (
                  <div key={idx} data-testid="recipe-ingredient" className="flex items-start justify-between gap-3 py-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-semibold text-[15px] text-on-surface capitalize break-words leading-snug">{ing.name}</span>
                      {nutrition ? (
                        <span className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] tabular-nums leading-tight">
                          <span data-testid="ingredient-kcal" className="text-primary"><b className="font-bold">{formatCompactNumber(nutrition.kcal)}</b> kcal</span>
                          <span className="text-macro-protein">{t('plan.summary.proteinShort')} <b className="font-bold">{formatCompactNumber(nutrition.protein, 1)}</b></span>
                          <span className="text-macro-fat">{t('plan.summary.fatShort')} <b className="font-bold">{formatCompactNumber(nutrition.fat, 1)}</b></span>
                          <span className="text-macro-carbs">{t('plan.summary.carbsShort')} <b className="font-bold">{formatCompactNumber(nutrition.carbs, 1)}</b></span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] italic text-on-surface-variant">{t('nutrients.noData')}</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-on-surface-variant whitespace-nowrap shrink-0 text-right">
                      {scaledAmount} {ingredientUnitLabel(ing.unit, Number(scaledAmount), ing.product)}
                      {baseAmount && ` (${baseAmount})`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {planMode && profile && (
          <div className="px-4 mt-6">
            <DayBalanceCard
              dayWithoutItem={getConsumedForDay(activeDate, mealId)}
              item={currentMacros}
              targets={profile}
              editing={Boolean(mealId)}
            />
          </div>
        )}

        {steps.length > 0 && (
          <section className="px-4 mt-8 flex flex-col">
            <h2 className="font-headline font-extrabold text-lg tracking-tight text-on-surface mb-4">{t('recipeDetails.steps')}</h2>
            <div className="flex flex-col gap-5">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-3.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface font-headline font-extrabold flex items-center justify-center shrink-0 text-[13.5px]">
                    {idx + 1}
                  </div>
                  {step.name ? (
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
                      <h3 className="text-[15px] font-semibold text-on-surface [overflow-wrap:anywhere]">{step.name}</h3>
                      {step.text && (
                        <p className="text-[15px] text-on-surface-variant leading-relaxed [overflow-wrap:anywhere]">{step.text}</p>
                      )}
                    </div>
                  ) : (
                    <p className="min-w-0 text-[15px] text-on-surface-variant leading-relaxed [overflow-wrap:anywhere]">{step.text}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-50 px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-surface from-70% to-transparent">
        <div className="max-w-xl mx-auto">
          {planMode ? (
            <button
              onClick={() => handleAddMeal()}
              disabled={isAdding || !(consumedPortions > 0) || unchangedPlanItem}
              className="w-full h-[52px] rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-base flex items-center justify-center active:scale-[0.98] transition-transform disabled:bg-surface-container-high disabled:text-on-surface-variant"
            >
              {isAdding ? (
                <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
              ) : (
                <span>{mealId ? t('recipeDetails.update') : addToMealLabel(activeMealType, mealTypes)}</span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setShowAddToPlan(true)}
              disabled={!(consumedPortions > 0)}
              className="w-full h-[52px] rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:bg-surface-container-high disabled:text-on-surface-variant"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">add</span>
              {t('recipeDetails.addToPlan')}
            </button>
          )}
        </div>
      </div>

      {showAddToPlan && (
        <PlanTargetSheet
          mode="add"
          title={recipe.name}
          meta={`${amountLabel} · ${formatCompactNumber(currentMacros.kcal)} kcal`}
          leading={thumb}
          date={todayIsoDate()}
          mealType={null}
          meals={sheetMeals}
          item={currentMacros}
          targets={profile}
          consumedForDay={consumedForDay}
          busy={isAdding}
          onConfirm={(date, meal) => handleAddMeal(date, meal)}
          onClose={() => setShowAddToPlan(false)}
        />
      )}

      {showTarget && (
        <PlanTargetSheet
          mode="set"
          title={recipe.name}
          date={activeDate}
          mealType={activeMealType}
          meals={sheetMeals}
          item={currentMacros}
          targets={profile}
          consumedForDay={consumedForDay}
          onConfirm={(date, meal) => {
            setActiveDate(date);
            setActiveMealType(meal);
            setShowTarget(false);
          }}
          onClose={() => setShowTarget(false)}
        />
      )}

      {showMenu && (
        <PlanActionSheet
          label={t('recipeDetails.menuTitle')}
          title={recipe.name}
          meta={<span className="truncate">{`${formatCompactNumber(recipe.kcal)} kcal · ${t('recipeDetails.recipeFor', { portions: portionsAccusative(basePortions) })}`}</span>}
          leading={thumb}
          onClose={() => setShowMenu(false)}
        >
          <PlanActionGroup>
            <PlanAction icon="edit" label={t('recipeDetails.edit')} onClick={handleEdit} />
          </PlanActionGroup>
          <PlanActionGroup>
            <PlanAction icon="delete" label={t('recipeDelete.confirm')} danger onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} />
          </PlanActionGroup>
        </PlanActionSheet>
      )}

      {showDeleteConfirm && (
        <ConfirmSheet
          question={t('recipeDelete.title')}
          title={recipe.name}
          description={t('recipeDelete.text')}
          confirmLabel={t('recipeDelete.confirm')}
          busy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {notice && <UndoSnackbar message={notice} onClose={closeNotice} />}
    </div>
  );
}
