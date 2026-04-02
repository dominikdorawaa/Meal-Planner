import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../lib/AppDataContext';
import { supabase } from '../lib/supabase';

interface IngredientDraft {
  id?: string;
  name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface InstructionStep {
  text: string;
}

export default function AddRecipe() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { user, refreshRecipes } = useAppData();

  const [name, setName] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [portions, setPortions] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [baseMacros, setBaseMacros] = useState({ kcal: 0, p: 0, f: 0, c: 0 });
  
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [instructions, setInstructions] = useState<InstructionStep[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<number | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<number | null>(null);

  // Ingredient Modal Search State
  const [ingredientSearch, setIngredientSearch] = useState('');

  // Dla celów koncepcyjnych - przykładowe sztuczne produkty
  const MOCK_PRODUCTS = [
    { id: 'p1', name: 'Banan', brand: 'Świeże', kcal: 89, protein: 1.1, fat: 0.3, carbs: 22.8, serving: '100g' },
    { id: 'p2', name: 'Mleko 2%', brand: 'Mlekovita', kcal: 50, protein: 3.3, fat: 2.0, carbs: 4.8, serving: '100ml' },
    { id: 'p3', name: 'Płatki Owsiane', brand: 'Górskie', kcal: 366, protein: 11.9, fat: 7.2, carbs: 69.3, serving: '100g' },
    { id: 'p4', name: 'Jajko (L)', brand: 'Farma', kcal: 138, protein: 12.5, fat: 9.7, carbs: 0.6, serving: '100g' },
  ];

  useEffect(() => {
    async function loadEditData() {
      if (!isEditMode) return;
      
      const { data: recipe } = await supabase.from('recipes').select('*').eq('id', id).single();
      if (!recipe) {
         navigate(-1);
         return;
      }

      setName(recipe.name);
      setPrepTime(recipe.prep_time ? recipe.prep_time.toString() : '');
      setPortions(recipe.portions ? recipe.portions.toString() : '1');
      setImageUrl(recipe.image_url || '');
      setBaseMacros({ kcal: recipe.kcal, p: recipe.protein, f: recipe.fat, c: recipe.carbs });

      if (recipe.instructions && Array.isArray(recipe.instructions)) {
         setInstructions(recipe.instructions.map((step: string) => ({ text: step })));
      }

      const { data: ingData } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', id);
      if (ingData) {
         setIngredients(ingData.map(i => {
           let ikcal = 0, ip = 0, ifat = 0, ic = 0;
           const mockMatch = MOCK_PRODUCTS.find(m => m.name.toLowerCase() === i.name.toLowerCase());
           if (mockMatch) {
             const ratio = i.amount / 100;
             ikcal = mockMatch.kcal * ratio;
             ip = mockMatch.protein * ratio;
             ifat = mockMatch.fat * ratio;
             ic = mockMatch.carbs * ratio;
           }
           return {
             id: i.id,
             name: i.name,
             amount: i.amount,
             unit: i.unit,
             kcal: ikcal, protein: ip, fat: ifat, carbs: ic
           };
         }));
      }
      setIsLoading(false);
    }
    loadEditData();
  }, [id, isEditMode, navigate]);

  const filteredProducts = MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(ingredientSearch.toLowerCase()));

  const handleAddIngredient = (product: typeof MOCK_PRODUCTS[0], amount: number) => {
    // In a real app, amount should be prompted or edited later. For now, defaulting to 100
    setIngredients([...ingredients, {
      name: product.name,
      amount: amount,
      unit: product.serving === '100ml' ? 'ml' : 'g',
      kcal: Math.round((product.kcal * amount) / 100),
      protein: parseFloat(((product.protein * amount) / 100).toFixed(1)),
      fat: parseFloat(((product.fat * amount) / 100).toFixed(1)),
      carbs: parseFloat(((product.carbs * amount) / 100).toFixed(1))
    }]);
    setShowIngredientModal(false);
    setIngredientSearch('');
  };

  const handleSaveRecipe = async () => {
    if (!user || !name) return;
    setIsSaving(true);
    
    try {
      // 1. Compute totals (Only strictly accurate if using known mocked ingredients, else fallback to base DB)
      // W normalnych warunkach tu byłaby re-kalkulacja po API
      const calculatedKcal = Math.round(ingredients.reduce((sum, i) => sum + i.kcal, 0));
      const calculatedP = Math.round(ingredients.reduce((sum, i) => sum + i.protein, 0));
      const calculatedF = Math.round(ingredients.reduce((sum, i) => sum + i.fat, 0));
      const calculatedC = Math.round(ingredients.reduce((sum, i) => sum + i.carbs, 0));

      const totalKcal = calculatedKcal > 0 ? calculatedKcal : baseMacros.kcal;
      const totalProtein = calculatedP > 0 ? calculatedP : baseMacros.p;
      const totalFat = calculatedF > 0 ? calculatedF : baseMacros.f;
      const totalCarbs = calculatedC > 0 ? calculatedC : baseMacros.c;
      
      const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop';
      
      const recipePayload = {
        name,
        kcal: totalKcal,
        protein: totalProtein,
        fat: totalFat,
        carbs: totalCarbs,
        image_url: imageUrl || defaultImage,
        created_by: user.id,
        prep_time: parseInt(prepTime) || 0,
        portions: parseFloat(portions) || 1,
        instructions: instructions.map(i => i.text)
      };

      let recipeId = null;

      if (isEditMode) {
        const { error: updateError } = await supabase.from('recipes').update(recipePayload).eq('id', id);
        if (updateError) throw updateError;
        recipeId = id;
        
        // Remove old ingredients
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
      } else {
        const { data: recipeData, error: recipeError } = await supabase.from('recipes').insert(recipePayload).select().single();
        if (recipeError) throw recipeError;
        recipeId = recipeData.id;
      }
      
      // 3. Insert ingredients if any
      if (ingredients.length > 0 && recipeId) {
        const ingredientsPayload = ingredients.map(ing => ({
          recipe_id: recipeId,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit
        }));
        
        const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsPayload);
        if (ingError) throw ingError;
      }
      
      await refreshRecipes();
      navigate(-1);
    } catch (err: any) {
      alert("Błąd zapisu przepisu: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = () => {
    setInstructions([...instructions, { text: '' }]);
  };

  const handleUpdateStep = (index: number, text: string) => {
    const newInst = [...instructions];
    newInst[index].text = text;
    setInstructions(newInst);
  };

  const handleDeleteStepConfirm = (index: number) => {
    const newInst = [...instructions];
    newInst.splice(index, 1);
    setInstructions(newInst);
    setStepToDelete(null);
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col pt-safe">
      
      {/* HEADER */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform">
            <span className="material-symbols-outlined">close</span>
          </button>
          <h1 className="font-headline font-bold text-lg text-on-surface">{isEditMode ? 'Edycja przepisu' : 'Nowy Przepis'}</h1>
        </div>
        <button 
          onClick={handleSaveRecipe}
          disabled={!name || isSaving}
          className="px-5 py-2 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm"
        >
          {isSaving ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-8">
        
        {isLoading && (
          <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* IMAGE PLACEHOLDER */}
        <section className="w-full aspect-[4/3] bg-surface-container-low rounded-[32px] border border-outline-variant/20 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-lowest transition-colors active:scale-[0.98] group overflow-hidden relative">
          {imageUrl ? (
             <img src={imageUrl} alt="Podgląd" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
              </div>
              <p className="font-bold text-sm text-on-surface-variant">Dodaj zdjęcie</p>
            </>
          )}
        </section>

        {/* BASIC INFO */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pl-1">Nazwa Przepisu</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-headline font-bold text-xl transition-shadow placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder="np. Owsianka z malinami"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Czas przygotowania */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">Czas przygotowania</label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  type="number"
                  min="0"
                  value={prepTime}
                  onChange={e => setPrepTime(e.target.value)}
                  className="w-full bg-transparent py-3.5 pl-4 pr-12 outline-none text-on-surface font-bold text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-4 text-xs font-bold text-on-surface-variant">min</span>
              </div>
            </div>

            {/* Porcje */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">Ilość porcji</label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  type="number"
                  min="1"
                  value={portions}
                  onChange={e => setPortions(e.target.value)}
                  className="w-full bg-transparent py-3.5 pl-4 pr-20 outline-none text-on-surface font-bold text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="1"
                />
                <span className="absolute right-4 text-xs font-bold text-on-surface-variant whitespace-nowrap">x porcja</span>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-outline-variant/10" />

        {/* INGREDIENTS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface pl-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">kitchen</span>
            Składniki
          </h2>
          
          <div className="flex flex-col gap-3">
            {ingredients.length === 0 && (
              <p className="text-sm font-medium text-on-surface-variant/50 pl-1">Brak składników. Przynajmniej jeden jest wymagany.</p>
            )}

            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm">
                <div className="flex flex-col flex-1 truncate pr-2">
                   <span className="font-bold text-sm text-on-surface truncate capitalize">{ing.name}</span>
                   {ing.kcal > 0 && <span className="text-[10px] font-bold text-primary mt-0.5">{Math.round(ing.kcal)} kcal</span>}
                </div>
                <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-lg shrink-0">
                   {ing.amount} {ing.unit}
                </span>
                
                <button 
                  onClick={() => setIngredientToDelete(idx)}
                   className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0"
                >
                   <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setShowIngredientModal(true)}
            className="w-full py-4 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors active:scale-[0.98] border border-outline-variant/20 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Dodaj składnik
          </button>
        </section>

        <hr className="border-t border-outline-variant/10" />

        {/* INSTRUCTIONS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface pl-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">format_list_numbered</span>
            Instrukcje
          </h2>

          <div className="flex flex-col gap-4">
            {instructions.map((step, idx) => (
              <div key={idx} className="flex gap-3 items-start group relative">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant font-black text-xs flex items-center justify-center shrink-0 mt-1">
                  {idx + 1}
                </div>
                <div className="flex-1 relative">
                  <textarea
                    value={step.text}
                    onChange={(e) => handleUpdateStep(idx, e.target.value)}
                    placeholder={`Krok ${idx + 1}...`}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 pr-12 min-h-[100px] outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium text-sm transition-shadow resize-y"
                  />
                  <button 
                    onClick={() => setStepToDelete(idx)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleAddStep}
            className="w-full py-4 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors active:scale-[0.98] border border-outline-variant/20 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Dodaj krok
          </button>
        </section>
      </main>

      {/* FULLSCREEN INGREDIENT MODAL */}
      <div className={`fixed inset-0 z-[100] bg-surface flex flex-col transition-transform duration-300 ${showIngredientModal ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}>
        <header className="px-4 py-4 flex items-center gap-3 bg-surface border-b border-outline-variant/10">
          <button onClick={() => setShowIngredientModal(false)} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
          
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-on-surface-variant/60">search</span>
            </div>
            <input
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 text-on-surface text-sm font-medium transition-all"
              placeholder="Wyszukaj składnik..."
              type="text"
            />
          </div>

          <button
            onClick={() => alert("Uruchomienie skanera kodów kreskowych...")}
            className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/20 transition-colors active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-xl">barcode_scanner</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 flex flex-col">
          {filteredProducts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddIngredient(prod, 100)} // Dodaj domyślnie 100g/ml
                  className="flex bg-surface-container-lowest p-3 rounded-[20px] shadow-sm border border-outline-variant/10 active:scale-[0.98] transition-all cursor-pointer group hover:bg-on-surface hover:text-surface"
                >
                  <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant">grocery</span>
                  </div>

                  <div className="flex flex-col justify-center px-4 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                       <h3 className="font-bold text-sm leading-tight group-hover:text-surface transition-colors truncate">{prod.name}</h3>
                       <span className="text-[10px] font-bold text-primary group-hover:text-surface truncate shrink-0">{prod.kcal} kcal</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant group-hover:text-surface/70 truncate">{prod.brand} • na {prod.serving}</span>
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
            <div className="flex-1 flex flex-col items-center justify-center opacity-50 pb-20">
              <span className="material-symbols-outlined text-4xl mb-4 text-on-surface-variant">search_off</span>
              <p className="font-bold text-on-surface-variant text-sm">Brak składników</p>
            </div>
          )}
        </main>
      </div>

      {/* DELETE STEP CONFIRMATION MODAL */}
      {stepToDelete !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setStepToDelete(null)}>
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Usunąć krok?</h3>
            <p className="text-on-surface-variant text-sm font-medium mb-6">Czy na pewno chcesz usunąć krok {stepToDelete + 1} ze swojego przepisu?</p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setStepToDelete(null)}
                className="flex-1 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDeleteStepConfirm(stepToDelete)}
                className="flex-[1.5] py-3 text-sm font-bold text-white bg-[#ba1a1a] rounded-xl shadow-sm hover:bg-[#ba1a1a]/90 transition-colors active:scale-95"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE INGREDIENT CONFIRMATION MODAL */}
      {ingredientToDelete !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIngredientToDelete(null)}>
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Usunąć składnik?</h3>
            <p className="text-on-surface-variant text-sm font-medium mb-6">Czy na pewno chcesz wyrzucić <br/><b className="text-on-surface">{ingredients[ingredientToDelete]?.name}</b><br/>z tego przepisu?</p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setIngredientToDelete(null)}
                className="flex-1 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  setIngredients(ingredients.filter((_, i) => i !== ingredientToDelete));
                  setIngredientToDelete(null);
                }}
                className="flex-[1.5] py-3 text-sm font-bold text-white bg-[#ba1a1a] rounded-xl shadow-sm hover:bg-[#ba1a1a]/90 transition-colors active:scale-95"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
