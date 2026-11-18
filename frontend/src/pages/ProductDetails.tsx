import { useEffect, useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Product } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { productDisplayName } from '../lib/productName';
import { canEditProduct, isCalendoriesProduct, isOwnItem, isUnverified } from '../lib/productPermissions';
import { NutritionSummary } from '../components/NutritionSummary';
import { ItemBadges } from '../components/FoodRows';
import { OPEN_HEADER_CLASS, OutsidePressLayer } from '../components/OutsidePressLayer';
import { NewProductSheet, type ProductFormMode } from '../components/NewProductSheet';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { draftFromProduct } from '../lib/productDraft';
import { measureUnit } from '../lib/nutrients';
import { ingredientAmountLabel, ingredientFactor } from '../lib/recipeIngredient';
import {
  baseMeasureCode,
  defaultMeasure,
  findMeasure,
  genericMeasures,
  initialMeasureValues,
  isBaseMeasure,
  isPerPiece,
  measureBaseAmount,
  measureLabel,
  measureRowLabel,
  measureRowUnit,
  productMeasures,
  type MeasureValues,
} from '../lib/measures';
import { t } from '../i18n';
import { useCloseOnBack } from '../lib/backNavigation';
import { addSelectionAfterItem, readPlanSelection } from '../lib/planSelection';
import { scaleMacros } from '../lib/macros';
import { mealColor, mealTypeName, profileMealTypes } from '../lib/mealTypes';
import { formatCompactNumber } from '../lib/compactNumber';
import { AmountField } from '../components/AmountField';
import { DayBalanceCard } from '../components/DayBalanceCard';
import { DetailsTopBar } from '../components/DetailsTopBar';
import { PlanTargetSheet } from '../components/PlanTargetSheet';
import { addToMealLabel, planTargetMeals } from '../lib/planTarget';

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, getConsumedForDay, profile } = useAppData();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [activeCode, setActiveCode] = useState('');
  const [values, setValues] = useState<MeasureValues>({});
  const [savedAmount, setSavedAmount] = useState<{ weight: number; code: string } | null>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');
  const [showMenu, setShowMenu] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formMode, setFormMode] = useState<ProductFormMode | null>(null);

  useCloseOnBack(showMenu, () => setShowMenu(false));

  const mealTypes = useMemo(() => profileMealTypes(profile), [profile]);
  const sheetMeals = useMemo(() => planTargetMeals(mealTypes), [mealTypes]);

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      const data = await api.products.getById(id).catch(() => null);
      if (data) {
        setProduct(data);
        setValues(initialMeasureValues(data));
        setActiveCode(defaultMeasure(data).code);
      }
      setLoading(false);
    }
    loadProduct();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    let current = true;
    api.products.saved()
      .then(list => { if (current) setSaved(list.some(item => item.id === id)); })
      .catch(() => {});
    return () => { current = false; };
  }, [id, user]);

  useEffect(() => {
    async function loadMeal() {
      if (!mealId || !product) return;
      const meals = await api.meals.getAll().catch(() => []);
      const data = meals.find((m: any) => m.id === mealId);
      if (data) {
        const weight = data.portions_consumed || 0;
        const found = data.measure_code && data.measure_amount != null ? findMeasure(product, data.measure_code) : null;
        const measure = found && Math.abs(data.measure_amount * found.base_amount - weight) < 0.001 ? found : null;
        const savedValue = measure ? { amount: data.measure_amount, unit: measure.code } : { amount: weight, unit: baseMeasureCode(product) };
        setValues(initialMeasureValues(product, savedValue));
        setActiveCode(savedValue.unit);
        setSavedAmount({ weight, code: savedValue.unit });
      }
    }
    loadMeal();
  }, [mealId, product]);

  const activeAmount = Number(values[activeCode]) || 0;
  const currentWeight = product ? measureBaseAmount(product, activeCode, activeAmount) ?? 0 : 0;
  const activeMeasure = product ? findMeasure(product, activeCode) : null;
  const withinLimit = activeMeasure !== null && activeAmount <= activeMeasure.max_amount;
  const chosen = { amount: activeAmount, unit: activeCode, product };
  const chosenLabel = product ? ingredientAmountLabel(chosen) : '';
  const chosenFactor = product ? ingredientFactor(chosen) ?? 0 : 0;

  const unchangedPlanItem = Boolean(mealId) && (savedAmount === null
    || (savedAmount.code === activeCode && Math.abs(currentWeight - savedAmount.weight) < 0.001));

  const currentMacros = product ? scaleMacros(product, chosenFactor) : scaleMacros({ kcal: 0, protein: 0, fat: 0, carbs: 0 }, 0);

  const handleAddProduct = async () => {
    const targetDate = activeDate || selectDate;
    const targetType = activeMealType || selectType;
    if (!user || !product || !targetDate || !targetType) return;
    setIsAdding(true);

    const baseChosen = isBaseMeasure(product, activeCode);
    const chosenAmount = {
      portions_consumed: currentWeight,
      measure_code: baseChosen ? null : activeCode,
      measure_amount: baseChosen ? null : activeAmount,
    };

    try {
      if (mealId) {
        await api.meals.update(mealId, chosenAmount);
      } else {
        await api.meals.add({ product: { id: product.id }, meal_date: targetDate, meal_type: targetType, ...chosenAmount });
        await addSelectionAfterItem(readPlanSelection(location.state), { kind: 'product', id: String(product.id) }, targetDate, targetType);
      }
      await refreshMeals();
      navigate('/');
    } catch (error: any) {
      alert('Błąd: ' + error.message);
      setIsAdding(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    try {
      await api.products.delete(product.id);
      navigate('/?refresh=true');
    } catch (e: any) {
      alert(t('product.deleteFailed', { message: e.message }));
    }
  };

  const toggleSaved = async () => {
    if (!product) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      await (wasSaved ? api.products.unsave(product.id) : api.products.save(product.id));
    } catch {
      setSaved(wasSaved);
    }
  };

  const handleFormSaved = (result: Product) => {
    const mode = formMode;
    setFormMode(null);
    if (mode === 'ownVersion') {
      navigate(`/product/${result.id}${location.search}`, { state: location.state });
    } else {
      setProduct(result);
    }
  };

  if (loading || !product) {
    return <div className="min-h-screen bg-surface flex items-center justify-center">Ładowanie...</div>;
  }

  const own = isOwnItem(product, user);
  const editable = canEditProduct(product, user);
  const planMode = Boolean(selectDate && selectType);
  const measures = [...productMeasures(product), ...genericMeasures(product)];
  const measure = activeMeasure ?? measures[0];
  const mealIndex = mealTypes.findIndex(meal => meal.id === activeMealType);
  const per100 = isPerPiece(product)
    ? t('product.kcalPerPiece', { kcal: formatCompactNumber(product.kcal) })
    : t('product.kcalPer100', { kcal: formatCompactNumber(product.kcal), unit: measureUnit(product.unit) });
  const menuItemClass = 'w-full h-12 flex items-center gap-3.5 px-4 text-left text-[15px] font-medium text-on-surface hover:bg-surface-container-highest transition-colors';

  const changeUnit = (code: string) => {
    const next = findMeasure(product, code);
    if (!next) return;
    if (currentWeight > 0) {
      const carried = Math.min(next.max_amount, Math.max(0.1, Math.round((currentWeight / next.base_amount) * 10) / 10));
      setValues(previous => ({ ...previous, [next.code]: carried }));
    }
    setActiveCode(next.code);
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">
      <header className={`sticky top-0 w-full ${showMenu ? OPEN_HEADER_CLASS : 'z-40'} bg-surface pt-safe`}>
        <div className="max-w-xl mx-auto">
          <DetailsTopBar
            overPhoto={false}
            backLabel={t('recipeDetails.back')}
            onBack={() => navigate(-1)}
            target={planMode ? {
              mealName: mealTypeName(activeMealType, mealTypes),
              mealColor: mealColor(mealIndex),
              date: activeDate,
              editing: Boolean(mealId),
              onOpen: () => setShowTarget(true),
            } : null}
            menu={user && !product.deleted ? { label: t('product.menu'), expanded: showMenu, onOpen: () => setShowMenu(!showMenu) } : null}
          >
            {showMenu && (
              <>
                <OutsidePressLayer onClose={() => setShowMenu(false)} />
                <div role="menu" className="absolute right-4 top-[58px] pointer-events-auto w-60 bg-surface-container-high rounded-2xl shadow-ambient z-50 overflow-hidden py-1.5 animate-fade-in">
                  <button role="menuitem" onClick={() => { setShowMenu(false); toggleSaved(); }} className={menuItemClass}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">{saved ? 'heart_minus' : 'favorite'}</span>
                    {t(saved ? 'product.unsave' : 'product.save')}
                  </button>
                  {editable ? (
                    <>
                      <button role="menuitem" onClick={() => { setShowMenu(false); setFormMode('edit'); }} className={menuItemClass}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">edit</span>
                        {t('product.edit')}
                      </button>
                      <button role="menuitem" onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} className={`${menuItemClass} !text-error`}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span>
                        {t('product.delete')}
                      </button>
                    </>
                  ) : (
                    <button role="menuitem" onClick={() => { setShowMenu(false); setFormMode('ownVersion'); }} className={menuItemClass}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">content_copy</span>
                      {t('product.makeOwnVersion')}
                    </button>
                  )}
                </div>
              </>
            )}
          </DetailsTopBar>
        </div>
      </header>

      {showDeleteConfirm && (
        <ConfirmSheet
          question={t('product.deleteTitle')}
          title={productDisplayName(product)}
          description={t('product.deleteText')}
          confirmLabel={t('product.deleteConfirm')}
          cancelLabel={t('product.cancel')}
          onConfirm={handleDeleteProduct}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <main className="w-full max-w-xl mx-auto flex flex-col">
        <div className="px-4 pt-3">
          <h1 className="font-headline font-extrabold text-[26px] text-on-surface tracking-tight leading-tight">{productDisplayName(product)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13.5px] text-on-surface-variant">
            <span>{per100}</span>
            <span className="empty:hidden">
              <ItemBadges own={own} unverified={isUnverified(product)} calendories={isCalendoriesProduct(product)} />
            </span>
          </div>
        </div>

        <div className="px-4 mt-5">
          <AmountField
            label={measureRowLabel(product, measure)}
            value={values[measure.code] ?? ''}
            max={measure.max_amount}
            unit={measure.code}
            unitLabel={isBaseMeasure(product, measure.code) ? measureRowUnit(product, measure, activeAmount) : measureLabel(measure, activeAmount)}
            units={measures.map(option => ({
              value: option.code,
              label: measureRowUnit(product, option, 1),
            }))}
            note={isBaseMeasure(product, measure.code) ? undefined : `${formatCompactNumber(currentWeight, 1)} ${baseMeasureCode(product)}`}
            kcal={currentMacros.kcal}
            onChange={next => setValues(previous => ({ ...previous, [measure.code]: next }))}
            onUnitChange={changeUnit}
          />
        </div>

        <div className="px-4 mt-7">
          <NutritionSummary
            title={t('recipeDetails.nutritionTitle')}
            subtitle={chosenLabel}
            values={currentMacros}
            macroSplit={product}
            tableColumns={[{ label: t('nutrients.per100', { unit: measureUnit(product.unit) }), values: product }]}
          />
        </div>

        {planMode && profile && (
          <div className="px-4 mt-6">
            <DayBalanceCard
              dayWithoutItem={getConsumedForDay(activeDate, mealId)}
              item={currentMacros}
              targets={profile}
              previousItem={mealId && savedAmount ? scaleMacros(product, ingredientFactor({ amount: savedAmount.weight, unit: baseMeasureCode(product), product }) ?? 0) : null}
            />
          </div>
        )}
      </main>

      {formMode && (
        <NewProductSheet
          draft={draftFromProduct(product)}
          mode={formMode}
          source={product}
          onClose={() => setFormMode(null)}
          onCreated={handleFormSaved}
          existingProductAction={{ href: existing => `/product/${existing.id}${location.search}` }}
        />
      )}

      {showTarget && (
        <PlanTargetSheet
          mode="set"
          title={productDisplayName(product)}
          date={activeDate}
          mealType={activeMealType}
          meals={sheetMeals}
          item={currentMacros}
          targets={profile}
          consumedForDay={date => getConsumedForDay(date, mealId)}
          onConfirm={(date, meal) => {
            setActiveDate(date);
            setActiveMealType(meal);
            setShowTarget(false);
          }}
          onClose={() => setShowTarget(false)}
        />
      )}

      {planMode && (
        <div className="fixed bottom-0 inset-x-0 z-50 px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-surface from-70% to-transparent">
          <div className="max-w-xl mx-auto">
            <button
              onClick={handleAddProduct}
              disabled={isAdding || !(currentWeight > 0) || !withinLimit || unchangedPlanItem}
              className="w-full h-[52px] rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-base flex items-center justify-center active:scale-[0.98] transition-transform disabled:bg-surface-container-high disabled:text-on-surface-variant"
            >
              {isAdding ? (
                <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></span>
              ) : (
                mealId ? t('recipeDetails.update') : addToMealLabel(activeMealType, mealTypes)
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
