import { useEffect, useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Product } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { addDaysToIsoDate, firstDayOfMonth, formatShortDayLabel, toIsoDate, todayIsoDate } from '../lib/planDates';
import { productDisplayName } from '../lib/productName';
import { canEditProduct, isOwnItem, isUnverified } from '../lib/productPermissions';
import { ProductNutritionTable } from '../components/ProductNutritionTable';
import { ItemBadges, SaveHeartButton } from '../components/FoodRows';
import { NewProductSheet, type ProductFormMode } from '../components/NewProductSheet';
import { draftFromProduct } from '../lib/productDraft';
import { MeasureAmountRows } from '../components/MeasureAmountRows';
import { measureUnit, scaleNutritionFacts } from '../lib/nutrients';
import { ingredientAmountLabel, ingredientFactor } from '../lib/recipeIngredient';
import { baseMeasureCode, defaultMeasure, findMeasure, initialMeasureValues, isBaseMeasure, measureBaseAmount, type MeasureValues } from '../lib/measures';
import { t } from '../i18n';
import { useCloseOnBack } from '../lib/backNavigation';
import { addSelectionAfterItem, readPlanSelection } from '../lib/planSelection';
import { formatCompactNumber } from '../lib/compactNumber';
import { KCAL_HERO_SIZES, RING_VALUE_SIZES, fitTextClass } from '../lib/fitText';

function gramsLabel(value: number): string {
  return `${formatCompactNumber(value, 1)}g`;
}

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, getConsumedForDay, profile } = useAppData();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('after');
  const [daysToAdd, setDaysToAdd] = useState(1);

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [activeCode, setActiveCode] = useState('');
  const [values, setValues] = useState<MeasureValues>({});
  const [savedAmount, setSavedAmount] = useState<{ weight: number; code: string } | null>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formMode, setFormMode] = useState<ProductFormMode | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => firstDayOfMonth(selectDate));

  useCloseOnBack(showMealPicker || showDatePicker, () => { setShowMealPicker(false); setShowDatePicker(false); });
  useCloseOnBack(showMenu, () => setShowMenu(false));
  useCloseOnBack(showDeleteConfirm, () => setShowDeleteConfirm(false));

  const availableMealTypes = useMemo(() => {
    if (profile?.meal_config && profile.meal_config.length > 0) {
      return profile.meal_config.map((m: any) => ({ id: m.id, name: m.name }));
    }
    return [
      { id: 'breakfast', name: 'Śniadanie' },
      { id: 'snack1', name: '2 Śniadanie' },
      { id: 'lunch', name: 'Lunch' },
      { id: 'snack2', name: 'Przekąska' },
      { id: 'dinner', name: 'Obiad' },
      { id: 'supper', name: 'Kolacja' },
    ];
  }, [profile]);

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
        const measure = data.measure_code && data.measure_amount != null ? findMeasure(product, data.measure_code) : null;
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

  const currentMacros = product ? {
    kcal: Math.round(product.kcal * chosenFactor),
    protein: parseFloat((product.protein * chosenFactor).toFixed(1)),
    fat: parseFloat((product.fat * chosenFactor).toFixed(1)),
    carbs: parseFloat((product.carbs * chosenFactor).toFixed(1))
  } : { kcal: 0, protein: 0, fat: 0, carbs: 0 };

  const totalMacros = currentMacros.protein + currentMacros.fat + currentMacros.carbs || 1;
  const pctP = Math.min(100, (currentMacros.protein / totalMacros) * 100);
  const pctF = Math.min(100, (currentMacros.fat / totalMacros) * 100);
  const pctC = Math.min(100, (currentMacros.carbs / totalMacros) * 100);

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

  const MEAL_TYPE_LABELS: Record<string, string> = {
    breakfast: 'Śniadanie', snack1: '2 Śniadanie', lunch: 'Lunch', snack2: 'Przekąska', dinner: 'Obiad', supper: 'Kolacja',
  };
  const own = isOwnItem(product, user);
  const editable = canEditProduct(product, user);
  const mealLabel = availableMealTypes.find((m: any) => m.id === activeMealType)?.name || MEAL_TYPE_LABELS[activeMealType] || activeMealType;
  const todayStr = todayIsoDate();
  const activeDateDisplay = formatShortDayLabel(activeDate || selectDate || '');

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">
      
      {/* Top Header - Zgodny ze screenem */}
      <header className="sticky top-0 w-full z-40 bg-surface-container-lowest px-4 py-3 pt-safe-3 flex items-center gap-4 border-b border-outline-variant/10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex flex-col pt-0.5 flex-1 relative">

          {/* Meal picker */}
          <div className="relative">
            <button
              disabled={Boolean(mealId)}
              onClick={() => { setShowMealPicker(v => !v); setShowDatePicker(false); }}
              className="flex items-center gap-1 font-headline font-bold text-base text-on-surface leading-tight active:scale-95 transition-transform"
            >
              <span>{mealId ? 'Edytujesz w: ' : 'Dodajesz do: '} <span className="text-primary">{mealLabel}</span></span>
              {!mealId && <span className={`material-symbols-outlined text-[14px] text-primary transition-transform ${showMealPicker ? 'rotate-180' : ''}`}>expand_more</span>}
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

          {/* Date picker */}
          <div className="relative">
            <button
              disabled={Boolean(mealId)}
              onClick={() => { setShowDatePicker(v => !v); setShowMealPicker(false); }}
              className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest leading-tight active:scale-95 transition-transform w-fit"
            >
              <span>{activeDateDisplay}</span>
              {!mealId && <span className={`material-symbols-outlined text-[11px] text-primary/70 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}>expand_more</span>}
            </button>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-1 z-[200] bg-surface rounded-2xl shadow-xl border border-outline-variant/20 p-3 w-[260px]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="text-xs font-black text-on-surface uppercase tracking-widest">{calendarDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant active:scale-90">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
                    <span key={d} className="text-center text-[9px] font-bold text-on-surface-variant/50 py-0.5">{d}</span>
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

        {user && !product.deleted && (
        <div className="relative ml-auto flex items-center">
          {!own && <SaveHeartButton saved={saved} name={productDisplayName(product)} onToggle={toggleSaved} className="w-10 h-10" />}
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
              <div
                data-scroll-lock className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div role="menu" className="absolute right-0 top-12 w-56 bg-surface-container border border-outline-variant/10 rounded-xl shadow-lg z-50 overflow-hidden text-sm py-1 animate-fade-in">
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
        

        {/* Wartości Odżywcze - Zgodnie ze screenem */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">
            {t('product.nutritionFor', { amount: chosenLabel })}
          </h2>
          
          <div className="flex items-center justify-between gap-1 sm:gap-4 px-2">
            {/* Kalorie */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px] flex items-center justify-center">
                 <span data-testid="kcal-value" className={`font-black ${fitTextClass(formatCompactNumber(currentMacros.kcal), KCAL_HERO_SIZES, 3)} text-on-surface leading-none text-center max-w-full break-words`}>{formatCompactNumber(currentMacros.kcal)}</span>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">kcal</span>
            </div>
            
            {/* Białko */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#4F46E5 ${pctP}%, #4F46E510 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="protein-value" className={`font-black ${fitTextClass(gramsLabel(currentMacros.protein), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentMacros.protein)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">Białko</span>
            </div>

            {/* Tłuszcz */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#F59E0B ${pctF}%, #F59E0B10 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="fat-value" className={`font-black ${fitTextClass(gramsLabel(currentMacros.fat), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentMacros.fat)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">Tłuszcz</span>
            </div>

            {/* Węglowodany */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 min-[360px]:w-[72px] min-[360px]:h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10B981 ${pctC}%, #10B98110 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span data-testid="carbs-value" className={`font-black ${fitTextClass(gramsLabel(currentMacros.carbs), RING_VALUE_SIZES, 4)} text-on-surface leading-none text-center px-1 break-words`}>{gramsLabel(currentMacros.carbs)}</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-on-surface uppercase tracking-widest leading-none">Węgle</span>
            </div>
          </div>
        </section>

        <ProductNutritionTable
          title={t('nutrients.productTitle')}
          unit={measureUnit(product.unit)}
          per100={product}
          columns={[
            { label: t('nutrients.per100', { unit: measureUnit(product.unit) }), values: product },
            {
              label: t('nutrients.perPortion', { amount: chosenLabel }),
              values: scaleNutritionFacts(product, chosenFactor),
            },
          ]}
        />

        {/* Podgląd bilansu */}
        {selectDate && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`w-full py-4 px-6 rounded-3xl flex items-center justify-between transition-all duration-300 border ${showPreview ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-surface-container-low border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-[22px]">analytics</span>
                <span className="font-headline font-bold text-sm">Sprawdź wpływ na bilans dnia</span>
              </div>
              <span className={`material-symbols-outlined transition-transform duration-300 ${showPreview ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {showPreview && (
              <div className="bg-surface-container-lowest rounded-[32px] p-6 border border-outline-variant/10 shadow-sm animate-fade-in">
                {(() => {
                  const before = getConsumedForDay(selectDate);
                  const currentData = {
                    kcal: Math.round((before?.kcal || 0) + (previewMode === 'after' ? currentMacros.kcal : 0)),
                    protein: parseFloat(((before?.protein || 0) + (previewMode === 'after' ? currentMacros.protein : 0)).toFixed(1)),
                    fat: parseFloat(((before?.fat || 0) + (previewMode === 'after' ? currentMacros.fat : 0)).toFixed(1)),
                    carbs: parseFloat(((before?.carbs || 0) + (previewMode === 'after' ? currentMacros.carbs : 0)).toFixed(1))
                  };

                  return (
                    <div className="flex flex-col gap-8">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                          </div>
                          <div>
                            <h3 className="font-headline font-bold text-sm text-on-surface leading-tight">
                              {previewMode === 'after' ? 'Bilans po dodaniu' : 'Aktualny bilans'}
                            </h3>
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{activeDateDisplay}</p>
                          </div>
                        </div>

                        {/* Switcher */}
                        <div className="flex bg-surface-container-highest p-1 rounded-2xl border border-outline-variant/5">
                          <button 
                            onClick={() => setPreviewMode('before')}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === 'before' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                          >
                            Przed
                          </button>
                          <button 
                            onClick={() => setPreviewMode('after')}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === 'after' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                          >
                            Po
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-6">
                        {/* Kcal */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-baseline leading-none">
                            <span className="text-on-surface uppercase tracking-widest text-[8px] font-black">Kalorie</span>
                            <span className="text-[10px] font-black text-on-surface">
                              {formatCompactNumber(currentData.kcal)} / <span className="opacity-40">{profile?.target_kcal || '···'} kcal</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                             <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.min(100, (currentData.kcal / profile.target_kcal) * 100)}%` : '0%' }}></div>
                             <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.max(0, Math.min(100, ((currentData.kcal / profile.target_kcal) * 100) - 100))}%` : '0%' }}></div>
                          </div>
                        </div>

                        {/* Macro Bars */}
                        <div className="grid grid-cols-1 gap-5">
                          {/* Białko */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className="text-on-surface uppercase tracking-widest text-[8px] font-black">Białka</span>
                              <span className="text-[10px] font-black text-on-surface">
                                {gramsLabel(currentData.protein)} / <span className="opacity-40">{profile?.target_protein || '···'}g</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                               <div className="absolute top-0 left-0 h-full bg-[#4F46E5] rounded-full transition-all duration-300" style={{ width: profile && profile.target_protein > 0 ? `${Math.min(100, (currentData.protein / profile.target_protein) * 100)}%` : '0%' }}></div>
                            </div>
                          </div>
                          {/* Tłuszcz */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className="text-on-surface uppercase tracking-widest text-[8px] font-black">Tłuszcze</span>
                              <span className="text-[10px] font-black text-on-surface">
                                {gramsLabel(currentData.fat)} / <span className="opacity-40">{profile?.target_fat || '···'}g</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                               <div className="absolute top-0 left-0 h-full bg-[#F59E0B] rounded-full transition-all duration-300" style={{ width: profile && profile.target_fat > 0 ? `${Math.min(100, (currentData.fat / profile.target_fat) * 100)}%` : '0%' }}></div>
                            </div>
                          </div>
                          {/* Węgle */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className="text-on-surface uppercase tracking-widest text-[8px] font-black">Węglowodany</span>
                              <span className="text-[10px] font-black text-on-surface">
                                {gramsLabel(currentData.carbs)} / <span className="opacity-40">{profile?.target_carbs || '···'}g</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                               <div className="absolute top-0 left-0 h-full bg-[#10B981] rounded-full transition-all duration-300" style={{ width: profile && profile.target_carbs > 0 ? `${Math.min(100, (currentData.carbs / profile.target_carbs) * 100)}%` : '0%' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
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
