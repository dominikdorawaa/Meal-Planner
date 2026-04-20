import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { RecipeCoverImage } from '../components/RecipeCoverImage';

export function RecipeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshMeals, recipes, refreshRecipes, getConsumedForDay, profile } = useAppData();
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

  // States for calculator
  const [inputType, setInputType] = useState<'portions' | 'grams' | 'quick-pick'>('portions');
  const [portionInput, setPortionInput] = useState<number | ''>(1);
  const [gramInput, setGramInput] = useState<number | ''>(100);
  const [quickPickPortions, setQuickPickPortions] = useState<number | null>(null);
  const [ingredientPortions, setIngredientPortions] = useState<number | null>(null);
  const [daysToAdd, setDaysToAdd] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const [quickDate, setQuickDate] = useState('');
  const [quickDateInput, setQuickDateInput] = useState('');
  const [quickMealType, setQuickMealType] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [activeDate, setActiveDate] = useState(selectDate || '');
  const [activeMealType, setActiveMealType] = useState(selectType || '');
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const basePortions = recipe?.portions || 1;
  const safeWeight = (totalWeight && totalWeight > 0) ? totalWeight : 300;



  useEffect(() => {
    async function loadRecipe() {
      if (!id) return;
      
      try {
        const data = await api.recipes.getById(id);
        if (data) setRecipe(data);

        // Ingredients are already included in the recipe object from our API
        if (data.ingredients) {
          setIngredients(data.ingredients);
          let weight = 0;
          data.ingredients.forEach((i: any) => {
            if (i.unit === 'g' || i.unit === 'ml') weight += Number(i.amount);
          });
          setTotalWeight(weight || 300);
        } else {
          setTotalWeight(300);
        }
      } catch (err) {
        console.error("Error loading recipe:", err);
      }

      // If editing existing meal, fetch its data
      if (mealId) {
        try {
          const meals = await api.meals.getAll();
          const mealData = meals.find((m: any) => m.id === mealId);
          if (mealData) {
            const portions = mealData.portions_consumed;
            setPortionInput(portions);
            
            // Przy edycji - pokaż gramy zamiast przeliczonej liczby porcji (np. 0.77)
            const gramPerPortion = safeWeight / basePortions;
            const grams = Math.round(portions * gramPerPortion);
            setGramInput(grams);
            
            setInputType('grams');  // domyślnie gramy przy edycji
          }
        } catch (err) {
          console.error("Error fetching meal data:", err);
        }
      } else {
        setGramInput(100); // domyślnie 100g przy nowym dodaniu
      }
      setLoading(false);
    }
    loadRecipe();
  }, [id, recipes, mealId, safeWeight, basePortions]);


  const consumedPortions = 
    inputType === 'portions' ? (Number(String(portionInput).replace(',', '.')) || 0) :
    inputType === 'grams' ? (Number(String(gramInput).replace(',', '.')) ? (Number(String(gramInput).replace(',', '.')) / (safeWeight / basePortions)) : 0) :
    (quickPickPortions || 0);
  
  // Składniki skalują się automatycznie wraz z wielkością posiłku (consumedPortions),
  // dopóki użytkownik ręcznie nie nadpisze ich w stepperze (ingredientPortions)
  const activeIngredientPortions = ingredientPortions !== null ? ingredientPortions : consumedPortions;

  const handleAddMeal = async (overrideDate?: string, overrideMealType?: string) => {
    const targetDate = overrideDate || activeDate || selectDate;
    const targetType = overrideMealType || activeMealType || selectType;
    if (!user || !recipe || !targetDate || !targetType) return;
    
    setIsAdding(true);

    if (mealId) {
      // Update existing meal
      try {
        await api.meals.update(mealId, { portions_consumed: consumedPortions });
        await refreshMeals();
        navigate('/');
      } catch (err) {
        alert("Błąd podczas aktualizacji posiłku.");
        setIsAdding(false);
      }
      return;
    }

    // Funkcja do obliczania daty DD.MM na podstawie offsetu dni
    const getNextDate = (startStr: string, offset: number) => {
      const [d, m] = startStr.split('.').map(Number);
      const year = new Date().getFullYear();
      const date = new Date(year, m - 1, d);
      date.setDate(date.getDate() + offset);
      
      const resD = String(date.getDate()).padStart(2, '0');
      const resM = String(date.getMonth() + 1).padStart(2, '0');
      return `${resD}.${resM}`;
    };

    for (let i = 0; i < daysToAdd; i++) {
      try {
        await api.meals.add({
          recipe: { id: recipe.id },
          date_str: getNextDate(targetDate, i),
          meal_type: targetType,
          portions_consumed: consumedPortions
        });
      } catch (err) {
        console.error("Error adding meal:", err);
      }
    }

    await refreshMeals();
    if (overrideDate) {
      setShowAddToPlan(false);
      setSuccessToast('Dodano do planu! ✔');
      setTimeout(() => setSuccessToast(null), 3000);
    } else {
      navigate('/');
    }
  };

  const handleArchive = async () => {
    if (!recipe) return;
    try {
      await api.recipes.archive(recipe.id);
      refreshRecipes();
      navigate(-1);
    } catch (err) {
      alert("Błąd podczas operacji archiwizacji.");
      setShowDeleteConfirm(false);
    }
  };

  const handleEdit = () => {
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
        <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Przepis nie znaleziony</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl active:scale-95 transition-transform mt-6">Wróć</button>
      </div>
    );
  }

  const displaySuffix = 
    inputType === 'portions' ? `w ${portionInput === '' ? 0 : portionInput} porcja` :
    inputType === 'grams' ? `w ${gramInput === '' ? 0 : Math.round(Number(gramInput))} g` :
    '';
  const currentKcal = Math.round(recipe.kcal * consumedPortions);
  const currentP = parseFloat((recipe.protein * consumedPortions).toFixed(1));
  const currentF = parseFloat((recipe.fat * consumedPortions).toFixed(1));
  const currentC = parseFloat((recipe.carbs * consumedPortions).toFixed(1));

  // Pie chart calculation for 1 base portion
  const calP = recipe.protein * 4;
  const calF = recipe.fat * 9;
  const calC = recipe.carbs * 4;
  const totalCal = calP + calF + calC || 1;
  
  const pctP = Math.round((calP / totalCal) * 100);
  const pctF = Math.round((calF / totalCal) * 100);
  const pctC = Math.round((calC / totalCal) * 100);

  const today = new Date();
  const todayDateStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const isToday = selectDate === todayDateStr;
  const dateDisplay = isToday ? 'Dzisiaj' : selectDate;

  const mealLabel = availableMealTypes.find((m: any) => m.id === activeMealType)?.name || activeMealType || selectType || '';

  const today2 = new Date();
  const todayStr2 = `${String(today2.getDate()).padStart(2,'0')}.${String(today2.getMonth()+1).padStart(2,'0')}`;
  const activeDateDisplay = activeDate === todayStr2 ? 'Dzisiaj' : (activeDate || dateDisplay);

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col animate-fade-in relative">

      {/* Toast sukcesu */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${successToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-3 bg-primary/10 backdrop-blur-md border border-primary/20 text-primary px-5 py-3 rounded-full shadow-lg whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
          <span className="font-headline font-bold text-sm tracking-wide">{successToast}</span>
        </div>
      </div>      {/* Top Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl px-4 py-3 flex items-center gap-4 border-b border-outline-variant/10">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform hover:text-on-surface shrink-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        {selectType && selectDate ? (
          <div className="flex flex-col pt-0.5 flex-1 relative">

            {/* Meal picker */}
            <div className="relative">
              <button
                onClick={() => { setShowMealPicker(v => !v); setShowDatePicker(false); }}
                className="flex items-center gap-1 font-headline font-bold text-[15px] sm:text-base text-on-surface leading-tight active:scale-95 transition-transform"
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
                className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-widest leading-tight active:scale-95 transition-transform w-fit"
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
                        const isTodayDay = todayStr2 === ds;
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

            {/* Close on outside click */}
            {(showMealPicker || showDatePicker) && (
              <div className="fixed inset-0 z-[199]" onClick={() => { setShowMealPicker(false); setShowDatePicker(false); }} />
            )}
          </div>
        ) : (
          <h1 className="font-headline font-bold text-[15px] sm:text-base text-on-surface leading-tight flex-1">Szczegóły Przepisu</h1>
        )}
        <button 
          onClick={() => setShowMenu(true)} 
          className="w-10 h-10 ml-auto rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform hover:bg-surface-container-highest shrink-0"
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>
      
      {/* Header Image */}
      <div className="relative w-full h-48 sm:h-64 bg-surface-container-highest shrink-0 overflow-hidden">
        <RecipeCoverImage
          recipe={recipe}
          alt={recipe.name}
          className="absolute inset-0 w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
      </div>

      {/* Tytuł przepisu – mniejszy, pod zdjęciem */}
      <div className="max-w-xl mx-auto w-full px-4 pt-3">
        <h1 className="font-headline font-bold text-xl text-on-surface tracking-tight leading-tight shrink-0">{recipe.name}</h1>
      </div>

      {/* Kalkulator porcji – zaraz pod tytułem */}
      <div className="flex flex-col gap-2 w-full max-w-xl mx-auto px-4 pt-2">
            {/* Porcje */}
            <div className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${inputType === 'portions' ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}>
              <div className="flex items-center gap-2 pl-0.5">
                  <input
                    type="number"
                    value={portionInput}
                    onFocus={() => setInputType('portions')}
                    onChange={(e) => {
                      setInputType('portions');
                      setPortionInput(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${inputType === 'portions' ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
                  />
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-on-surface-variant text-sm shrink-0 whitespace-nowrap">
                    porcj{Number(portionInput) === 1 ? 'a' : (Math.floor(Number(portionInput)) >= 2 && Math.floor(Number(portionInput)) <= 4 ? 'e' : 'i')}
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant/60 ml-0.5">({Math.round(Number(portionInput || 0) * (safeWeight / basePortions))}g)</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 ml-auto shrink-0">
                <span className={`font-black text-xl transition-colors ${inputType === 'portions' ? 'text-primary' : 'text-on-surface'}`}>{Math.round(recipe.kcal * (Number(portionInput) || 0))}</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
              </div>
            </div>


            {/* Gramy */}
            <div className={`flex items-center rounded-2xl p-1.5 pr-4 border transition-all gap-3 ${inputType === 'grams' ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-surface-container-low border-outline-variant/10'}`}>
              <div className="flex items-center gap-2 pl-0.5">
                  <input
                    type="number"
                    value={gramInput}
                    onFocus={() => setInputType('grams')}
                    onChange={(e) => {
                      setInputType('grams');
                      setGramInput(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className={`w-[72px] border rounded-xl py-2 px-2 outline-none transition-all text-on-surface font-bold text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${inputType === 'grams' ? 'bg-surface border-primary/50' : 'bg-surface-container-lowest border-outline-variant/20'}`}
                  />
                <span className="font-bold text-on-surface-variant text-sm shrink-0 whitespace-nowrap">g</span>
              </div>
              <div className="flex items-baseline gap-1 ml-auto shrink-0">
                <span className={`font-black text-xl transition-colors ${inputType === 'grams' ? 'text-primary' : 'text-on-surface'}`}>
                  {Math.round(recipe.kcal * (Number(gramInput) ? (Number(gramInput) / (safeWeight / basePortions)) : 0))}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">kcal</span>
              </div>
            </div>
      </div>

      <main className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col gap-10">

        {/* Kalorie - szybki wybór */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">Kalorie <span className="text-on-surface-variant font-medium text-sm">na 1 porcję ({Math.round(consumedPortions * (safeWeight / basePortions))}g)</span></h2>
            <p className="text-xs text-on-surface-variant mt-1">Możesz dopasować energię i makroskładniki.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-hide snap-x">
            {(() => {
              const baseKcal = Math.round(recipe.kcal);
              // Używamy ułamków kulinarnych, żeby po przeliczeniu makro/składników wychodziły sensowne wartości do gotowania (np. pół, ćwierć)
              const multipliers = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];
              
              return multipliers.map((m) => {
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
                        ? 'bg-[#e2f0d9] text-[#2d4d1e] border-[#b5ccaa] shadow-sm'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/20 hover:border-on-surface/30'
                    }`}
                  >
                    {kcalOption} kcal
                  </button>
                );
              });
            })()}
          </div>
        </section>

        {/* Makro zależne od wpisanych porcji */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#064e3b] opacity-40">
              Wartości Odżywcze {displaySuffix}
            </h2>
          </div>
          
          <div className="flex items-center justify-between gap-1 sm:gap-4 px-2">
            
            {/* Kalorie */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[72px] h-[72px] flex items-center justify-center">
                 <span className="font-black text-3xl text-[#064e3b] leading-none">{currentKcal}</span>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">kcal</span>
            </div>
            
            {/* Białko */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[72px] h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#4F46E5 ${pctP}%, #4F46E510 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="font-black text-base text-[#064e3b] leading-none">{currentP}g</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">Białko</span>
            </div>

            {/* Tłuszcz */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[72px] h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#F59E0B ${pctF}%, #F59E0B10 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="font-black text-base text-[#064e3b] leading-none">{currentF}g</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">Tłuszcz</span>
            </div>

            {/* Węglowodany */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[72px] h-[72px]">
                 <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10B981 ${pctC}%, #10B98110 0)` }}></div>
                 <div className="absolute inset-[6px] bg-surface rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="font-black text-base text-[#064e3b] leading-none">{currentC}g</span>
                 </div>
              </div>
              <span className="text-[11px] font-black text-[#064e3b] uppercase tracking-widest leading-none">Węgle</span>
            </div>

          </div>
        </section>

        {/* Składniki */}
        {ingredients && ingredients.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-on-surface-variant flex items-center gap-1 flex-wrap leading-tight">
                <span>Składniki na {activeIngredientPortions} porcj{activeIngredientPortions === 1 ? 'ę' : (Math.floor(activeIngredientPortions) >= 2 && Math.floor(activeIngredientPortions) <= 4 && activeIngredientPortions % 1 === 0 ? 'e' : 'i')}</span>
                <span className="normal-case opacity-70">({Math.round(activeIngredientPortions * (safeWeight / basePortions))}g)</span>
              </h2>

              {/* Stepper porcji składników */}
              <div className="flex items-center bg-surface-container-low rounded-xl p-1 shadow-sm border border-outline-variant/10">
                <button 
                  onClick={() => setIngredientPortions(p => Math.max(0.25, (p !== null ? p : consumedPortions) - 0.25))}
                  className="w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <div className="w-8 text-center font-bold text-sm text-on-surface select-none">
                  {Math.round(activeIngredientPortions * 100) / 100}
                </div>
                <button 
                  onClick={() => setIngredientPortions(p => (p !== null ? p : consumedPortions) + 0.25)}
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
                    <span className="font-bold text-sm text-on-surface capitalize">{ing.name}</span>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-lg">
                      {scaledAmount} {ing.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Podgląd wpływu na dzień */}
        {selectDate && !loading && (
          <section className="mt-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`w-full py-4 px-6 rounded-3xl flex items-center justify-between transition-all duration-300 border ${showPreview ? 'bg-primary/5 border-primary/20 mb-4' : 'bg-surface-container-highest/30 border-transparent hover:bg-surface-container-highest/50'}`}
            >
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-[22px]">{showPreview ? 'visibility_off' : 'analytics'}</span>
                <span className="font-headline font-bold text-sm tracking-tight">
                  {showPreview ? 'Ukryj podgląd dnia' : 'Sprawdź wpływ na bilans dnia'}
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
                          {previewMode === 'after' ? 'Bilans po dodaniu' : 'Aktualny bilans'}
                        </h3>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{dateDisplay}</p>
                      </div>
                    </div>

                    {/* Przełącznik Przed/Po */}
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

                  <div className="flex flex-col gap-5">
                    {/* Kcal Preview */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-baseline leading-none gap-1">
                        <span className="text-primary uppercase tracking-normal text-[8px] font-bold">Kalorie</span>
                        <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                          <span className={`text-[10px] font-extrabold ${profile && currentData.kcal > profile.target_kcal ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                            {currentData.kcal}
                          </span>
                          <span className="mx-0.5 opacity-50">/</span>
                          {profile?.target_kcal || '···'} kcal
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.min(100, (currentData.kcal / profile.target_kcal) * 100)}%` : '0%' }}></div>
                        <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-300" style={{ width: profile && profile.target_kcal > 0 ? `${Math.max(0, Math.min(100, ((currentData.kcal / profile.target_kcal) * 100) - 100))}%` : '0%' }}></div>
                      </div>
                    </div>

                    {/* Macro Previews */}
                    <div className="grid grid-cols-1 gap-4">
                      {/* Protein */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold">Białka</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && currentData.protein > (profile.target_protein_max || profile.target_protein * 1.1) ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {currentData.protein}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile ? `${profile.target_protein_min}-${profile.target_protein_max}` : '··'}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative text-primary">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.min(100, (currentData.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-300" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((currentData.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>

                      {/* Fat */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold">Tłuszcz</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                             <span className={`text-[9px] font-extrabold ${profile && currentData.fat > (profile.target_fat_max || profile.target_fat * 1.1) ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {currentData.fat}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile ? `${profile.target_fat_min}-${profile.target_fat_max}` : '··'}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.min(100, (currentData.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-300" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((currentData.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>

                      {/* Carbs */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold">Węgle</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                             <span className={`text-[9px] font-extrabold ${profile && currentData.carbs > (profile.target_carbs_max || profile.target_carbs * 1.1) ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {currentData.carbs}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile ? `${profile.target_carbs_min}-${profile.target_carbs_max}` : '··'}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.min(100, (currentData.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-300" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((currentData.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Przygotowanie */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-2">Przygotowanie</h2>
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

      {/* Floating Add to Plan Bar */}
      {selectDate && selectType && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/10 p-4 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-xl mx-auto w-full flex gap-3 items-center">
            
            {/* Stepper Dni - ukryty przy edycji */}
            {!mealId && (
              <div className="flex items-center bg-surface-container-low border border-outline-variant/20 rounded-2xl p-1 h-[56px] shadow-sm">
                <button 
                  onClick={() => setDaysToAdd(prev => Math.max(1, prev - 1))}
                  className="w-10 h-full flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-xl transition-all font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                
                <div className="px-2 min-w-[60px] flex flex-col items-center justify-center -space-y-1">
                  <span className="font-black text-lg text-on-surface leading-none">{daysToAdd}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">dni</span>
                </div>
                
                <button 
                  onClick={() => setDaysToAdd(prev => Math.min(30, prev + 1))}
                  className="w-10 h-full flex items-center justify-center text-on-surface hover:bg-surface-container-highest rounded-xl transition-all font-bold active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            )}

            {/* Przycisk Akcji */}
            <button 
              onClick={() => handleAddMeal()}
              disabled={isAdding || consumedPortions <= 0}
              className="flex-1 h-[56px] bg-[#6B8E23] hover:bg-[#5a781d] text-white font-black text-base rounded-[20px] transition-all active:scale-[0.98] disabled:opacity-50 shadow-[0_4px_12px_rgba(107,142,35,0.3)] flex items-center justify-center gap-3"
            >
              {isAdding ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{mealId ? 'Aktualizuj' : 'Dodaj'}</span>
                </>
              )}
            </button>

          </div>
        </div>
      )}

      {/* Przycisk Dodaj do planu (gdy brak kontekstu daty) */}
      {!selectDate && !selectType && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/10 p-4 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-xl mx-auto w-full">
            <button
              onClick={() => setShowAddToPlan(true)}
              className="w-full h-[56px] bg-[#6B8E23] hover:bg-[#5a781d] text-white font-black text-base rounded-[20px] transition-all active:scale-[0.98] shadow-[0_4px_12px_rgba(107,142,35,0.3)] flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-[22px]">add_circle</span>
              Dodaj do planu
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sheet – Wybierz dzień i porę */}
      {showAddToPlan && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowAddToPlan(false)}>
          <div className="w-full max-w-xl bg-surface rounded-t-[32px] p-6 pb-8 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6" />
            <h2 className="font-headline font-bold text-xl text-on-surface mb-5">Wybierz dzień i porę</h2>

            {/* Szybki wybór dnia */}
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Dzień</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(() => {
                const fmt = (offset: number) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
                };
                const fmtISO = (offset: number) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  return d.toISOString().slice(0, 10);
                };
                return [
                  { label: 'Dziś', val: fmt(0), iso: fmtISO(0) },
                  { label: 'Jutro', val: fmt(1), iso: fmtISO(1) },
                  { label: 'Pojutrze', val: fmt(2), iso: fmtISO(2) },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => { setQuickDate(opt.val); setQuickDateInput(opt.iso); }}
                    className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all active:scale-95 ${
                      quickDate === opt.val
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] font-medium opacity-60">{opt.val}</div>
                  </button>
                ));
              })()}
            </div>
            {/* Pole kalendarza - ukryte, otwierane przyciskiem */}
            <div className="relative mb-5">
              <button
                type="button"
                onClick={() => {
                  try { (dateInputRef.current as any)?.showPicker(); } catch { dateInputRef.current?.click(); }
                }}
                className={`w-full flex items-center gap-3 py-3 px-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  quickDateInput && !['', undefined].includes(quickDateInput)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                <span className="font-bold text-sm flex-1 text-left">
                  {quickDateInput ? new Date(quickDateInput + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Wybierz inną datę...'}
                </span>
                <span className="material-symbols-outlined text-[18px] opacity-40">chevron_right</span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={quickDateInput}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                onChange={e => {
                  const iso = e.target.value;
                  setQuickDateInput(iso);
                  if (iso) {
                    const d = new Date(iso + 'T00:00:00');
                    const ds = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
                    setQuickDate(ds);
                  }
                }}
              />
            </div>

            {/* Wybór pory */}
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Pora posiłku</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {(profile?.meal_config || [
                { id: 'breakfast', name: 'Śniadanie' },
                { id: 'second_breakfast', name: '2 Śniadanie' },
                { id: 'lunch', name: 'Lunch' },
                { id: 'dinner', name: 'Obiad' },
                { id: 'snack', name: 'Przekąska' },
                { id: 'supper', name: 'Kolacja' },
              ]).filter((m: any) => m.visible !== false).map((meal: any) => (
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
              {isAdding ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Dodaj do planu'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sheet Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl p-6 pb-safe flex flex-col gap-2 animate-slide-up sm:animate-fade-in relative shadow-ambient">
            <button
              onClick={() => setShowMenu(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-4 mt-2">Zarządzaj przepisem</h3>
            
            <button onClick={handleEdit} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-left group">
               <span className="material-symbols-outlined text-primary">edit</span>
               <div className="flex flex-col">
                  <span className="font-bold text-on-surface">Edytuj przepis</span>
                  <span className="text-xs text-on-surface-variant">Zmień składniki, makro i przygotowanie</span>
               </div>
            </button>
            
            <button onClick={() => { alert('Opcja wkrótce dostępna! Ten projekt jeszcze nie obsługuje Uploadu Media Object Storage.'); setShowMenu(false); }} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-left group">
               <span className="material-symbols-outlined text-primary">add_a_photo</span>
               <div className="flex flex-col">
                  <span className="font-bold text-on-surface">Zmień zdjęcie</span>
                  <span className="text-xs text-on-surface-variant">Dodaj nową fotografię potrawy z menu</span>
               </div>
            </button>

            <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} className="flex items-center gap-4 p-4 rounded-xl bg-red-50 hover:bg-red-100 transition-colors text-left mt-2 border border-red-100">
               <span className="material-symbols-outlined text-red-600">delete</span>
               <div className="flex flex-col">
                  <span className="font-bold text-red-700">Usuń przepis</span>
                  <span className="text-[10px] text-red-600">Zniknie z wyszukiwarki (w planach pozostanie zachowany)</span>
               </div>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
           <div className="w-full max-w-sm bg-surface rounded-[32px] p-8 shadow-2xl relative animate-scale-up" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-3xl text-red-600">delete_forever</span>
              </div>
              <h2 className="font-headline font-bold text-xl text-center text-on-surface mb-8">Usunąć przepis?</h2>
              <div className="flex flex-col gap-3">
                 <button 
                   onClick={handleArchive}
                   className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-red-200"
                 >
                   Tak, usuń przepis
                 </button>
                 <button 
                   onClick={() => setShowDeleteConfirm(false)}
                   className="w-full py-4 bg-surface-container-highest text-on-surface font-bold rounded-2xl active:scale-95 transition-all"
                 >
                   Anuluj
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
