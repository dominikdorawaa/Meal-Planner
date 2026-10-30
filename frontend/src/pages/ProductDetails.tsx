import { useEffect, useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Product } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { addDaysToIsoDate, formatShortDayLabel } from '../lib/planDates';
import { productDisplayName } from '../lib/productName';
import { canEditProduct, isOwnItem, isUnverified } from '../lib/productPermissions';
import { NutritionSummary } from '../components/NutritionSummary';
import { ItemBadges, SaveHeartButton } from '../components/FoodRows';
import { OPEN_HEADER_CLASS, OutsidePressLayer } from '../components/OutsidePressLayer';
import { PlanTargetPicker } from '../components/PlanTargetPicker';
import { NewProductSheet, type ProductFormMode } from '../components/NewProductSheet';
import { draftFromProduct } from '../lib/productDraft';
import { MeasureAmountRows } from '../components/MeasureAmountRows';
import { DayBalancePreview } from '../components/DayBalancePreview';
import { measureUnit } from '../lib/nutrients';
import { ingredientAmountLabel, ingredientFactor } from '../lib/recipeIngredient';
import { baseMeasureCode, defaultMeasure, findMeasure, initialMeasureValues, isBaseMeasure, measureBaseAmount, type MeasureValues } from '../lib/measures';
import { t } from '../i18n';
import { useCloseOnBack } from '../lib/backNavigation';
import { addSelectionAfterItem, readPlanSelection } from '../lib/planSelection';
import { scaleMacros } from '../lib/macros';
import { profileMealTypes } from '../lib/mealTypes';

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, getConsumedForDay, profile } = useAppData();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [daysToAdd, setDaysToAdd] = useState(1);

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [activeCode, setActiveCode] = useState('');
  const [values, setValues] = useState<MeasureValues>({});
  const [savedAmount, setSavedAmount] = useState<{ weight: number; code: string } | null>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formMode, setFormMode] = useState<ProductFormMode | null>(null);

  useCloseOnBack(showMenu, () => setShowMenu(false));
  useCloseOnBack(showDeleteConfirm, () => setShowDeleteConfirm(false));

  const availableMealTypes = useMemo(() => profileMealTypes(profile), [profile]);

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
        const saved = measure ? { amount: data.measure_amount, unit: measure.code } : { amount: weight, unit: baseMeasureCode(product) };
        setValues(initialMeasureValues(product, saved));
        setActiveCode(saved.unit);
        setSavedAmount({ weight, code: saved.unit });
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
    const mealInserts = [];
    for (let i = 0; i < daysToAdd; i++) {
      mealInserts.push({
        product: { id: product.id },
        meal_date: addDaysToIsoDate(targetDate, i),
        meal_type: targetType,
        ...chosenAmount
      });
    }

    try {
      if (mealId) {
        await api.meals.update(mealId, chosenAmount);
      } else {
        for (const insert of mealInserts) {
          await api.meals.add(insert);
        }
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
  const activeDateDisplay = formatShortDayLabel(activeDate || selectDate || '');

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">
      
      {/* Top Header - Zgodny ze screenem */}
      <header className={`sticky top-0 w-full ${showMenu ? OPEN_HEADER_CLASS : 'z-40'} bg-surface-container-lowest px-4 py-3 pt-safe-3 flex items-center gap-4 border-b border-outline-variant/10`}>
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <PlanTargetPicker
          meals={availableMealTypes}
          mealType={activeMealType}
          date={activeDate}
          editing={Boolean(mealId)}
          onMealTypeChange={setActiveMealType}
          onDateChange={setActiveDate}
        />

        {user && !product.deleted && (
        <div className="relative ml-auto flex items-center">
          <SaveHeartButton saved={saved} name={productDisplayName(product)} onToggle={toggleSaved} className="w-10 h-10" />
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label={t('product.menu')}
            aria-expanded={showMenu}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>

          {showMenu && (
            <>
              <OutsidePressLayer onClose={() => setShowMenu(false)} />
              <div role="menu" className="absolute right-0 top-12 pointer-events-auto w-56 bg-surface-container border border-outline-variant/10 rounded-xl shadow-lg z-50 overflow-hidden text-sm py-1 animate-fade-in">
                {editable ? (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => { setShowMenu(false); setFormMode('edit'); }}
                      className="w-full flex items-center px-4 py-3 text-left font-medium text-on-surface hover:bg-surface-container-highest transition-colors font-body"
                    >
                      <span className="material-symbols-outlined mr-3 text-[18px]">edit</span>
                      {t('product.edit')}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                      className="w-full flex items-center px-4 py-3 text-left font-medium text-error hover:bg-surface-container-highest transition-colors font-body"
                    >
                      <span className="material-symbols-outlined mr-3 text-[18px]">delete</span>
                      {t('product.delete')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => { setShowMenu(false); setFormMode('ownVersion'); }}
                      className="w-full flex items-center px-4 py-3 text-left font-medium text-on-surface hover:bg-surface-container-highest transition-colors font-body"
                    >
                      <span className="material-symbols-outlined mr-3 text-[18px]">content_copy</span>
                      {t('product.makeOwnVersion')}
                    </button>
                    {saved && (
                      <button
                        role="menuitem"
                        onClick={() => { setShowMenu(false); toggleSaved(); }}
                        className="w-full flex items-center px-4 py-3 text-left font-medium text-error hover:bg-surface-container-highest transition-colors font-body"
                      >
                        <span className="material-symbols-outlined mr-3 text-[18px]">heart_minus</span>
                        {t('product.unsave')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        )}
      </header>

      {/* Confirmation Modal */}
      {showDeleteConfirm && (
        <div data-scroll-lock className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-sm w-full animate-scale-up text-center border border-outline-variant/10 flex flex-col items-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4 text-error">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">{t('product.deleteTitle')}</h3>
            <p className="text-on-surface-variant mb-8 text-sm leading-relaxed px-2">
              {t('product.deleteText', { name: productDisplayName(product) })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 bg-surface-container-highest text-on-surface hover:bg-surface-container-highest/80 rounded-xl font-bold font-headline transition-colors active:scale-95 text-sm"
              >
                {t('product.cancel')}
              </button>
              <button
                onClick={handleDeleteProduct}
                className="flex-1 py-3.5 bg-error text-on-error hover:bg-error/90 rounded-xl font-bold font-headline shadow-sm transition-colors active:scale-95 text-sm"
              >
                {t('product.deleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Produkt Title - Zgodny ze screenem (pod nagłówkiem, bez zdjęcia) */}
      <div className="max-w-xl mx-auto w-full px-4 pt-6">
        <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight leading-tight">{productDisplayName(product)}</h1>
        <div className="mt-2 empty:hidden">
          <ItemBadges own={own} unverified={isUnverified(product)} />
        </div>
      </div>

      {/* Kalkulator - Zgodny ze stylem "pigułek" ze screena */}
      <div className="flex flex-col gap-2 w-full max-w-xl mx-auto px-4 pt-4">
        <MeasureAmountRows
          product={product}
          values={values}
          activeCode={activeCode}
          onActivate={setActiveCode}
          onChange={(code, next) => setValues(previous => ({ ...previous, [code]: next }))}
        />
      </div>

      <main className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col gap-10">
        

        <NutritionSummary
          title={t('product.nutritionFor', { amount: chosenLabel })}
          values={currentMacros}
          macroSplit={product}
          tableColumns={[{ label: t('nutrients.per100', { unit: measureUnit(product.unit) }), values: product }]}
        />

        {selectDate && profile && (
          <DayBalancePreview
            dayLabel={activeDateDisplay}
            dayWithoutItem={getConsumedForDay(activeDate || selectDate, mealId)}
            item={currentMacros}
            targets={profile}
            editing={Boolean(mealId)}
          />
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

      {/* Floating Add to Plan Bar - Zgodnie ze screenem */}
      {selectDate && selectType && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/10 p-4 pb-safe z-50 shadow-ambient">
          <div className="max-w-xl mx-auto w-full flex gap-3 items-center">
            
            {/* Stepper Dni */}
            {!mealId && (
              <div className="flex items-center bg-surface-container-low border border-outline-variant/20 rounded-2xl p-1 h-[56px]">
                <button 
                  onClick={() => setDaysToAdd(prev => Math.max(1, prev - 1))}
                  className="w-10 h-full flex items-center justify-center text-on-surface rounded-xl hover:bg-surface-container-highest transition-all font-bold"
                >
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                <div className="px-2 min-w-[60px] flex flex-col items-center justify-center -space-y-1">
                  <span className="font-black text-lg text-on-surface">{daysToAdd}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">dni</span>
                </div>
                <button 
                  onClick={() => setDaysToAdd(prev => Math.min(30, prev + 1))}
                  className="w-10 h-full flex items-center justify-center text-on-surface rounded-xl hover:bg-surface-container-highest transition-all font-bold"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            )}

            <button 
              onClick={handleAddProduct}
              disabled={isAdding || !(currentWeight > 0) || !withinLimit || unchangedPlanItem}
              className="flex-1 h-[56px] bg-[#6B8E23] text-white font-black text-base rounded-[20px] shadow-lg shadow-[#6B8E23]/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {isAdding ? 'Czekaj...' : (mealId ? 'Zaktualizuj' : 'Dodaj')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
