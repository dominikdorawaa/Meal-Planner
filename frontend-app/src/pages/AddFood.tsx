import { useState, useMemo, useEffect } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { RecipeCoverImage } from '../components/RecipeCoverImage';


const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Śniadanie',
  second_breakfast: '2 Śniadanie',
  lunch: 'Lunch',
  snack: 'Przekąska',
  dinner: 'Obiad',
  supper: 'Kolacja',
};

const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

const formatDateLabel = (dateStr: string) => {
  const parts = dateStr.split('.');
  if (parts.length !== 2) return dateStr;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(d) || isNaN(m) || m < 1 || m > 12) return dateStr;
  const now = new Date();
  const year = now.getFullYear();
  const date = new Date(year, m - 1, d);
  const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  return `${dayNames[date.getDay()]}, ${d} ${MONTHS[m - 1]}`;
};

export function AddFood() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { recipes, products, profile, loading: contextLoading, refreshMeals } = useAppData();

  const selectDate = searchParams.get('selectDate');
  const selectType = searchParams.get('selectType');
  const mealId = searchParams.get('mealId');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recent' | 'all' | 'recipes' | 'products'>(mealId ? 'all' : 'recent');

  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
  const [showQuickAdd, setShowQuickAdd] = useState(!!mealId);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '' });



  const getMealLabel = (type: string) => {
    if (profile?.meal_config) {
      const config = profile.meal_config.find((m: any) => m.id === type);
      if (config) return config.name;
    }
    return MEAL_TYPE_LABELS[type] || type;
  };

  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return recipes;
    const lowerQ = searchQuery.toLowerCase();
    return recipes.filter(r => r.name.toLowerCase().includes(lowerQ));
  }, [recipes, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const lowerQ = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lowerQ) || (p.brand && p.brand.toLowerCase().includes(lowerQ)));
  }, [products, searchQuery]);

  const handleSelectRecipe = (recipe: any) => {
    if (!selectDate || !selectType) return;
    navigate(`/recipe/${recipe.id}?selectDate=${selectDate}&selectType=${selectType}`);
  };

  const handleSelectProduct = (product: any) => {
    if (!selectDate || !selectType) return;
    navigate(`/product/${product.id}?selectDate=${selectDate}&selectType=${selectType}`);
  };

  const handleQuickAddSubmit = async () => {
    if (!selectDate || !selectType || isAdding) return;
    if (!quickAddForm.name || !quickAddForm.kcal) {
      alert('Podaj przynajmniej nazwę i kalorie!');
      return;
    }

    setIsAdding(true);

    const payload = {
      date_str: selectDate,
      meal_type: selectType,
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
      <header className="sticky top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-4">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex flex-col">
                <h1 className="font-headline font-bold text-lg text-on-surface tracking-tight leading-tight">
                  {mealId ? 'Edytuj w:' : 'Dodaj do:'} {getMealLabel(selectType)}
                </h1>
                <span className="text-[10px] font-medium text-on-surface-variant">
                  {formatDateLabel(selectDate)}
                </span>
              </div>
            </div>
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
                  placeholder="Szukaj przepisów, produktów..."
                  type="text"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-4 flex items-center text-on-surface-variant/60 hover:text-on-surface active:scale-90 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
              {/* Barcode Scanner Button */}
              <button
                onClick={() => alert("Uruchomienie modulu skanera kodów kreskowych...")}
                className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/20 transition-colors active:scale-95 shrink-0 border border-primary/20 shadow-sm"
                title="Skanuj kod"
              >
                <span className="material-symbols-outlined text-xl">barcode_scanner</span>
              </button>
              {/* Filter Button */}
              <button
                onClick={() => alert("Filtry: wyszukiwanie w produktach/przepisach...")}
                className="bg-surface-container-highest w-12 h-12 rounded-2xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95 shrink-0 shadow-sm"
                title="Filtruj wyniki"
              >
                <span className="material-symbols-outlined text-xl">tune</span>
              </button>
            </div>
          )}

          {/* Segmented Control */}
          {!mealId && (
            <div className="w-full pt-2 pb-1">
              <div className="flex w-full gap-1.5 sm:gap-2">
                {[
                  { id: 'recent', label: '', icon: 'history' },
                  { id: 'all', label: 'Zapisane', icon: 'favorite' },
                  { id: 'recipes', label: 'Przepisy', icon: 'menu_book' },
                  { id: 'products', label: 'Produkty', icon: 'grocery' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-1 items-center justify-center gap-1 sm:gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all overflow-hidden ${activeTab === tab.id ? 'bg-on-surface text-surface shadow-md' : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'}`}
                  >
                    <span className={`material-symbols-outlined shrink-0 ${tab.label ? 'text-[14px]' : 'text-[16px]'}`}>{tab.icon}</span>
                    {tab.label && <span className="truncate">{tab.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Szybkie akcje dodawania (Przeniesione na górę) */}
          {!mealId && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => alert("Formularz tworzenia produktu")}
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
              <span className="text-xs font-bold uppercase tracking-widest text-primary/60">Ładowanie Bazy</span>
            </div>
          )}

          {!contextLoading && (activeTab === 'recipes' || activeTab === 'all' || activeTab === 'recent') && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-4 pl-1">
                {activeTab === 'recent' ? 'Ostatnio używane przepisy' : 'Twoje Przepisy'}
              </h2>
              {filteredRecipes.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {(activeTab === 'recent' ? filteredRecipes.slice(0, 3) : filteredRecipes).map((recipe) => (
                    <div
                      key={recipe.id}
                      onClick={() => handleSelectRecipe(recipe)}
                      className="flex bg-surface-container-lowest p-2.5 rounded-[20px] shadow-sm border border-outline-variant/10 active:scale-[0.98] transition-all cursor-pointer group hover:bg-primary/5"
                    >
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 relative bg-surface-container-highest">
                        <RecipeCoverImage
                          recipe={recipe}
                          alt={recipe.name}
                          className="absolute inset-0 w-full h-full"
                          imgClassName="w-full h-full object-cover shadow-sm"
                        />
                      </div>

                      <div className="flex flex-col justify-center px-4 flex-1 overflow-hidden">
                        <h3 className="font-headline font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">{recipe.name}</h3>
                        <div className="flex items-center gap-2 mt-1.5 opacity-80 overflow-hidden">
                          <div className="flex items-center gap-0.5 bg-primary/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[10px] text-primary">local_fire_department</span>
                            <span className="text-[10px] sm:text-[11px] font-black text-primary tracking-wide leading-none">{recipe.kcal} kcal</span>
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0">{recipe.protein}g B</span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0">{recipe.fat}g T</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center pr-2">
                        <button className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-colors shadow-sm">
                          <span className="material-symbols-outlined text-[20px]">add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 border-dashed">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">search_off</span>
                  <p className="text-sm font-medium text-on-surface-variant/60">Brak dopasowanych przepisów</p>
                </div>
              )}
            </section>
          )}

          {!contextLoading && (activeTab === 'products' || activeTab === 'all' || activeTab === 'recent') && (
            <section className="mb-8 overflow-hidden">
              <h2 className="text-xs font-black uppercase tracking-widest text-primary/50 mb-4 pl-1">
                {activeTab === 'recent' ? 'Ostatnio dodawane' : 'Baza produktów'}
              </h2>
              {filteredProducts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {(activeTab === 'recent' ? filteredProducts.slice(0, 5) : filteredProducts).map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className="flex bg-surface-container-lowest p-3 rounded-[20px] shadow-sm border border-outline-variant/10 active:scale-[0.98] transition-all cursor-pointer group hover:bg-on-surface hover:text-surface"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-colors group-hover:bg-primary/20">
                        <span className="material-symbols-outlined text-[24px]">nutrition</span>
                      </div>

                      <div className="flex flex-col justify-center px-4 flex-1 overflow-hidden">
                        <h3 className="font-bold text-sm leading-tight group-hover:text-surface transition-colors truncate">{prod.name}</h3>
                        <span className="text-[10px] text-on-surface-variant group-hover:text-surface/70 truncate">{prod.brand}</span>
                      </div>

                      <div className="flex flex-col items-end justify-center px-4">
                        <span className="text-xs font-black group-hover:text-surface transition-colors">{prod.kcal} kcal</span>
                        <span className="text-[9px] font-bold text-on-surface-variant group-hover:text-surface/70 uppercase transition-colors">100g</span>
                      </div>

                      <div className="flex items-center justify-center pl-2 border-l border-outline-variant/10 group-hover:border-surface/10 ml-2">
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant group-hover:text-surface transition-colors">
                          <span className="material-symbols-outlined text-[20px]">add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 border-dashed">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">search_off</span>
                  <p className="text-sm font-medium text-on-surface-variant/60">Brak dopasowanych produktów</p>
                </div>
              )}
            </section>
          )}
        </main>
      )}


      {/* Quick Add Form - Modal for new, Page Content for edit */}
      {showQuickAdd && (
        <div className={mealId ? "flex-1 w-full max-w-xl mx-auto px-4 py-6" : "fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in"} onClick={!mealId ? () => setShowQuickAdd(false) : undefined}>
          <div className={mealId ? "bg-transparent" : "bg-surface-container-lowest rounded-t-[32px] p-6 pb-8 max-h-[90vh] overflow-y-auto animate-slide-up w-full max-w-xl mx-auto shadow-[0_-8px_30px_rgb(0,0,0,0.1)] relative"} onClick={e => e.stopPropagation()}>
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

    </div>
  );
}
