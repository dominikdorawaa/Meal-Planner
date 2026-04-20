import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, products, getConsumedForDay, profile } = useAppData();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('after');
  const [daysToAdd, setDaysToAdd] = useState(1);

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  // Stany dla kalkulatora (zgodnie ze stylem RecipeDetails)
  const [inputType, setInputType] = useState<'pieces' | 'grams'>('grams');
  const [grams, setGrams] = useState<number | ''>(100);
  const [pieces, setPieces] = useState<number | ''>(1);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => {
    if (selectDate) {
      const parts = selectDate.split('.');
      if (parts.length === 2) {
        const now = new Date();
        return new Date(now.getFullYear(), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

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
      const existing = products.find(p => p.id === id);
      if (existing) {
        setProduct(existing);
        setLoading(false);
      } else {
        const data = await api.products.getById(id).catch(() => null);
        if (data) setProduct(data);
        setLoading(false);
      }
    }
    loadProduct();

    async function loadMeal() {
      if (!mealId) return;
      const meals = await api.meals.getAll().catch(() => []);
      const data = meals.find((m: any) => m.id === mealId);
      if (data) {
        const weight = data.portions_consumed || 0;
        setGrams(weight);
        if (product?.piece_weight) {
          setPieces(parseFloat((weight / product.piece_weight).toFixed(2)));
        }
        setInputType('grams');
      }
    }
    loadMeal();
  }, [id, products, mealId, product]);

  const currentWeight = useMemo(() => {
    if (inputType === 'grams') return Number(grams) || 0;
    if (inputType === 'pieces') return (Number(pieces) || 0) * (product?.piece_weight || 0);
    return 0;
  }, [inputType, grams, pieces, product]);

  const currentMacros = useMemo(() => {
    if (!product) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    const factor = currentWeight / 100;
    return {
      kcal: Math.round(product.kcal * factor),
      protein: parseFloat((product.protein * factor).toFixed(1)),
      fat: parseFloat((product.fat * factor).toFixed(1)),
      carbs: parseFloat((product.carbs * factor).toFixed(1))
    };
  }, [product, currentWeight]);

  const totalMacros = currentMacros.protein + currentMacros.fat + currentMacros.carbs || 1;
  const pctP = Math.min(100, (currentMacros.protein / totalMacros) * 100);
  const pctF = Math.min(100, (currentMacros.fat / totalMacros) * 100);
  const pctC = Math.min(100, (currentMacros.carbs / totalMacros) * 100);

  const handleAddProduct = async () => {
    const targetDate = activeDate || selectDate;
    const targetType = activeMealType || selectType;
    if (!user || !product || !targetDate || !targetType) return;
    setIsAdding(true);

    const getNextDate = (startStr: string, offset: number) => {
      const [d, m] = startStr.split('.').map(Number);
      const year = new Date().getFullYear();
      const date = new Date(year, m - 1, d);
      date.setDate(date.getDate() + offset);
      return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const mealInserts = [];
    for (let i = 0; i < daysToAdd; i++) {
      mealInserts.push({
        product: { id: product.id },
        date_str: getNextDate(targetDate, i),
        meal_type: targetType,
        portions_consumed: currentWeight
      });
    }

    try {
      if (mealId) {
        await api.meals.update(mealId, { portions_consumed: currentWeight });
      } else {
        for (const insert of mealInserts) {
          await api.meals.add(insert);
        }
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
      alert('Błąd podczas usuwania produktu: ' + e.message);
    }
  };

  if (loading || !product) {
    return <div className="min-h-screen bg-surface flex items-center justify-center">Ładowanie...</div>;
  }

  const MEAL_TYPE_LABELS: Record<string, string> = {
    breakfast: 'Śniadanie', snack1: '2 Śniadanie', lunch: 'Lunch', snack2: 'Przekąska', dinner: 'Obiad', supper: 'Kolacja',
  };
  const mealLabel = availableMealTypes.find((m: any) => m.id === activeMealType)?.name || MEAL_TYPE_LABELS[activeMealType] || activeMealType;
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}`;
  const activeDateDisplay = activeDate === todayStr ? 'Dzisiaj' : (activeDate || selectDate);

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">
      
      {/* Top Header - Zgodny ze screenem */}
      <header className="sticky top-0 w-full z-40 bg-white px-4 py-3 flex items-center gap-4 border-b border-outline-variant/10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex flex-col pt-0.5 flex-1 relative">

          {/* Meal picker */}
          <div className="relative">
            <button
              onClick={() => { setShowMealPicker(v => !v); setShowDatePicker(false); }}
              className="flex items-center gap-1 font-headline font-bold text-base text-on-surface leading-tight active:scale-95 transition-transform"
            >
              <span>{mealId ? 'Edytujesz w: ' : 'Dodajesz do: '} <span className="text-primary">{mealLabel}</span></span>
              <span className={`material-symbols-outlined text-[14px] text-primary transition-transform ${showMealPicker ? 'rotate-180' : ''}`}>expand_more</span>
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
              onClick={() => { setShowDatePicker(v => !v); setShowMealPicker(false); }}
              className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest leading-tight active:scale-95 transition-transform w-fit"
            >
              <span>{activeDateDisplay}</span>
              <span className={`material-symbols-outlined text-[11px] text-primary/70 transition-transform ${showDatePicker ? 'rotate-180' : ''}`}>expand_more</span>
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
                      const ds = `${String(d).padStart(2,'0')}.${String(month+1).padStart(2,'0')}`;
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
            <div className="fixed inset-0 z-[199]" onClick={() => { setShowMealPicker(false); setShowDatePicker(false); }} />
          )}
        </div>

        {/* Menu button */}
        <div className="relative ml-auto">
          <button 
            onClick={() => setShowMenu(!showMenu)} 
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)} 
              />
              <div className="absolute right-0 top-12 w-48 bg-surface-container border border-outline-variant/10 rounded-xl shadow-lg z-50 overflow-hidden text-sm py-1 animate-fade-in">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full flex items-center px-4 py-3 text-left font-medium text-[#ba1a1a] hover:bg-surface-container-highest transition-colors font-body"
                >
                  <span className="material-symbols-outlined mr-3 text-[18px]">delete</span>
                  Usuń z bazy
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-sm w-full animate-scale-up text-center border border-outline-variant/10 flex flex-col items-center">
            <div className="w-16 h-16 bg-[#ba1a1a]/10 rounded-full flex items-center justify-center mb-4 text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">Usunąć trwale?</h3>
            <p className="text-on-surface-variant mb-8 text-sm leading-relaxed px-2">
              Produkt <strong className="text-on-surface">{product.name}</strong> zostanie bezpowrotnie usunięty z bazy danych wraz z przypisanymi do niego posiłkami.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 bg-surface-container-highest text-on-surface hover:bg-surface-container-highest/80 rounded-xl font-bold font-headline transition-colors active:scale-95 text-sm"
              >
                Anuluj
              </button>
              <button
                onClick={handleDeleteProduct}
                className="flex-1 py-3.5 bg-[#ba1a1a] text-white hover:bg-[#ba1a1a]/90 rounded-xl font-bold font-headline shadow-sm transition-colors active:scale-95 text-sm"
              >
                Usuń produkt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Produkt Title - Zgodny ze screenem (pod nagłówkiem, bez zdjęcia) */}
      <div className="max-w-xl mx-auto w-full px-4 pt-6">
        <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight leading-tight">{product.name}</h1>
      </div>

      {/* Kalkulator - Zgodny ze stylem "pigułek" ze screena */}
      <div className="flex flex-col gap-2 w-full max-w-xl mx-auto px-4 pt-4">
        {/* Wiersz SZTUKI (jeśli dotyczy) */}
        {product.piece_weight && (
          <div className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${inputType === 'pieces' ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}>
            <div className="flex items-center gap-2 pl-0.5">
              <input 
                type="number"
                value={pieces}
                onFocus={() => setInputType('pieces')}
                onChange={(e) => {
                  setInputType('pieces');
                  setPieces(e.target.value === '' ? '' : Number(e.target.value));
                }}
                className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${inputType === 'pieces' ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
              />
              <span className="font-bold text-on-surface-variant text-sm shrink-0 whitespace-nowrap">szt.</span>
            </div>
            <div className="flex items-baseline gap-1 ml-auto shrink-0">
              <span className={`font-black text-xl transition-colors ${inputType === 'pieces' ? 'text-primary' : 'text-on-surface'}`}>
                {Math.round(product.kcal * (Number(pieces) * product.piece_weight / 100))}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
            </div>
          </div>
        )}

        {/* Wiersz GRAMY */}
        <div className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${inputType === 'grams' ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}>
          <div className="flex items-center gap-2 pl-0.5">
            <input 
              type="number"
              value={grams}
              onFocus={() => setInputType('grams')}
              onChange={(e) => {
                setInputType('grams');
                setGrams(e.target.value === '' ? '' : Number(e.target.value));
              }}
              className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${inputType === 'grams' ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
            />
            <span className="font-bold text-on-surface-variant text-sm shrink-0 whitespace-nowrap">g</span>
          </div>
          <div className="flex items-baseline gap-1 ml-auto shrink-0">
            <span className={`font-black text-xl transition-colors ${inputType === 'grams' ? 'text-primary' : 'text-on-surface'}`}>
              {currentMacros.kcal}
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
          </div>
        </div>
      </div>

      <main className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col gap-10">
        

        {/* Wartości Odżywcze - Zgodnie ze screenem */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[#064e3b] opacity-40">
            WARTOŚCI ODŻYWCZE W {inputType === 'pieces' ? `${pieces} SZT.` : `${grams} G`}
          </h2>
          
          <div className="flex items-center justify-between gap-1 sm:gap-4 px-2">
            {/* Kalorie */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[72px] h-[72px] flex items-center justify-center">
                 <span className="font-black text-3xl text-[#064e3b] leading-none">{currentMacros.kcal}</span>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">kcal</span>
            </div>
            
            {/* Białko */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[72px] h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#4F46E5 ${pctP}%, #4F46E510 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="font-black text-base text-[#064e3b] leading-none">{currentMacros.protein}g</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">Białko</span>
            </div>

            {/* Tłuszcz */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[72px] h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#F59E0B ${pctF}%, #F59E0B10 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="font-black text-base text-[#064e3b] leading-none">{currentMacros.fat}g</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">Tłuszcz</span>
            </div>

            {/* Węglowodany */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[72px] h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10B981 ${pctC}%, #10B98110 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="font-black text-base text-[#064e3b] leading-none">{currentMacros.carbs}g</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">Węgle</span>
            </div>
          </div>
        </section>

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
                            <h3 className="font-headline font-bold text-sm text-[#064e3b] leading-tight">
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
                            <span className="text-[#064e3b] uppercase tracking-widest text-[8px] font-black">Kalorie</span>
                            <span className="text-[10px] font-black text-[#064e3b]">
                              {currentData.kcal} / <span className="opacity-40">{profile?.target_kcal || '···'} kcal</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                             <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.min(100, (currentData.kcal / profile.target_kcal) * 100)}%` : '0%' }}></div>
                             <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.max(0, Math.min(100, ((currentData.kcal / profile.target_kcal) * 100) - 100))}%` : '0%' }}></div>
                          </div>
                        </div>

                        {/* Macro Bars */}
                        <div className="grid grid-cols-1 gap-5">
                          {/* Białko */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className="text-[#064e3b] uppercase tracking-widest text-[8px] font-black">Białka</span>
                              <span className="text-[10px] font-black text-[#064e3b]">
                                {currentData.protein}g / <span className="opacity-40">{profile?.target_protein || '···'}g</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                               <div className="absolute top-0 left-0 h-full bg-[#4F46E5] rounded-full transition-all duration-300" style={{ width: profile && profile.target_protein > 0 ? `${Math.min(100, (currentData.protein / profile.target_protein) * 100)}%` : '0%' }}></div>
                            </div>
                          </div>
                          {/* Tłuszcz */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className="text-[#064e3b] uppercase tracking-widest text-[8px] font-black">Tłuszcze</span>
                              <span className="text-[10px] font-black text-[#064e3b]">
                                {currentData.fat}g / <span className="opacity-40">{profile?.target_fat || '···'}g</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                               <div className="absolute top-0 left-0 h-full bg-[#F59E0B] rounded-full transition-all duration-300" style={{ width: profile && profile.target_fat > 0 ? `${Math.min(100, (currentData.fat / profile.target_fat) * 100)}%` : '0%' }}></div>
                            </div>
                          </div>
                          {/* Węgle */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className="text-[#064e3b] uppercase tracking-widest text-[8px] font-black">Węglowodany</span>
                              <span className="text-[10px] font-black text-[#064e3b]">
                                {currentData.carbs}g / <span className="opacity-40">{profile?.target_carbs || '···'}g</span>
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
              disabled={isAdding || currentWeight <= 0}
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
