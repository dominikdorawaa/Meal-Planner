import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { BottomNav } from '../components/BottomNav';
import { RecipeCoverImage } from '../components/RecipeCoverImage';

export function ShoppingList() {
  const navigate = useNavigate();
  const { shoppingList, shoppingListRecipes, refreshShoppingList, setShoppingList } = useAppData();
  const [items, setItems] = useState<any[]>(shoppingList || []);
  const [sourceRecipes, setSourceRecipes] = useState<any[]>(shoppingListRecipes || []);
  const [activeTab, setActiveTab] = useState<'categories' | 'recipes'>('categories');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnit, setNewUnit] = useState('szt');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    setItems(shoppingList || []);
    setSourceRecipes(shoppingListRecipes || []);
  }, [shoppingList, shoppingListRecipes]);

  const toggleCheck = async (id: string, currentStatus: boolean) => {
    // Functional Optimistic update local
    setItems(prev => prev.map(item => item.id === id ? { ...item, is_checked: !currentStatus } : item));
    
    // Functional Optimistic update context
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_checked: !currentStatus } : item));

    try {
      await api.shoppingList.toggleItem(id, !currentStatus);
      await refreshShoppingList();
    } catch (err) {
      console.error("Error toggling item:", err);
      refreshShoppingList();
    }
  };

  const openAddModal = () => {
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddProduct = async () => {
    const name = newIngredientName.trim();
    if (!name) {
      setAddError('Podaj nazwę produktu.');
      return;
    }
    const qty = parseFloat(String(newQuantity).replace(',', '.'));
    if (Number.isNaN(qty) || qty <= 0) {
      setAddError('Podaj dodatnią ilość.');
      return;
    }
    const unit = newUnit.trim() || 'szt';
    setAddError(null);
    setAddSubmitting(true);
    try {
      await api.shoppingList.addItem({
        ingredient_name: name,
        quantity: qty,
        unit,
        is_checked: false,
      });
      await refreshShoppingList();
      setShowAddModal(false);
      setNewIngredientName('');
      setNewQuantity('1');
      setNewUnit('szt');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się dodać produktu.';
      setAddError(msg);
    } finally {
      setAddSubmitting(false);
    }
  };

  const clearList = async () => {
    // Ukrywamy od razu dla płynnego UX
    setShowConfirm(false);
    
    // Optimistic update
    setItems([]);
    setShoppingList([]);
    try {
      await api.shoppingList.clearAll();
      await refreshShoppingList();
    } catch (err) {
      console.error("Error clearing list:", err);
      refreshShoppingList();
    }
  };

  const getCategory = (name: string) => {
    const n = (name || '').toLowerCase();
    
    if (/awokado|sałat|pomidor|owoc|warzyw|szparag|cytryn|mieszanka|fasol|ziemniak|cebul|czosn|jabłk|banan|marchew|papryk|ogórek|brokuł|kalafior|pieczark/i.test(n)) 
      return { title: 'Warzywa i Owoce', icon: 'eco' };
      
    if (/chleb|bułk|bagietk|rogal|tortill|pumpernikiel/i.test(n)) 
      return { title: 'Pieczywo', icon: 'bakery_dining' };
      
    if (/kurczak|mięs|indyk|wołow|wieprzow|stek|ryb|łosoś|tuńczyk|krewet|szynk|boczek|kiełbas|parówk/i.test(n)) 
      return { title: 'Mięso i Ryby', icon: 'set_meal' };
      
    if (/mleko|jaj|białko|ser|parmezan|masło|jogurt|śmietan|kefir|twar|tofu/i.test(n)) 
      return { title: 'Nabiał i Jaja', icon: 'egg' };

    if (/ryż|makaron|kasza|komosa|płatki|mąka|cukier|sól|quinoa|ciecierzyc/i.test(n))
      return { title: 'Zbożowe i Sypkie', icon: 'grain' };

    if (/oliw|olej|sos|pesto|ketchup|majonez|musztard|pieprz|zioł/i.test(n))
      return { title: 'Dodatki i Sosy', icon: 'local_dining' };
      
    return { title: 'Inne', icon: 'shopping_basket' };
  };

  const formatIngredientAmount = (amount: number, unit: string) => {
    const u = (unit || '').toLowerCase().trim();
    
    // Jednostki płynne / sypkie -> tu zaokrąglenie do pełnych wartości ma sens (np. 134g ryżu, nie 134.25g)
    if (['g', 'ml', 'kcal', 'mg'].includes(u)) {
      return String(Math.round(amount));
    }
    
    // Zostawiamy oryginalną wartość ułamkową (do max 2 miejsc po przecinku) dla sztuk, opakowań, itd.
    // Dzięki temu ułamek (np. 1.25 avokado) jest widoczny bez narzutów.
    const rounded = Math.round(amount * 100) / 100;
    return String(rounded);
  };

  // Grupowanie
  const groupedItems = items.reduce((acc: any, item: any) => {
    const cat = getCategory(item.ingredient_name).title;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">shopping_basket</span>
            <h1 className="font-headline font-bold text-lg tracking-tight text-primary">Meal Planner</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowConfirm(true)} className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant group relative">
              <span className="material-symbols-outlined group-hover:text-[#ba1a1a] transition-colors">delete_sweep</span>
            </button>
            <button className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-24 px-6 max-w-screen-md mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-on-surface-variant font-medium text-sm mb-1 uppercase tracking-widest">Twoja Kolekcja</p>
            <h2 className="font-headline font-extrabold text-3xl text-primary tracking-tight">Koszyk</h2>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="bg-primary-gradient text-on-primary px-3 py-2 sm:px-4 sm:py-2 rounded-xl flex items-center gap-1.5 shadow-ambient active:scale-95 transition-transform font-semibold text-[13px] sm:text-sm whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Dodaj produkt
          </button>
        </div>

        <div className="flex bg-surface-container-highest/30 p-1.5 rounded-xl mb-6">
           <button onClick={() => setActiveTab('categories')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'categories' ? 'bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'}`}>Według Działów</button>
           <button onClick={() => setActiveTab('recipes')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'recipes' ? 'bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'}`}>Według Przepisów</button>
        </div>

        {items.length === 0 ? (
           <div className="flex flex-col items-center justify-center text-center mt-20 opacity-60">
              <span className="material-symbols-outlined text-[64px] text-on-surface-variant mb-4">shopping_cart</span>
              <p className="text-on-surface-variant font-medium">Twój koszyk jest pusty.</p>
              <p className="text-xs text-on-surface-variant mt-2">Wygeneruj listę z kalendarza lub dodaj manualnie.</p>
           </div>
        ) : (
          <div className="space-y-10">
            {activeTab === 'categories' && (
              <>
                {['Warzywa i Owoce', 'Pieczywo', 'Mięso i Ryby', 'Nabiał i Jaja', 'Zbożowe i Sypkie', 'Dodatki i Sosy', 'Inne'].filter(cat => groupedItems[cat]).map(categoryName => {
                   const catInfo = getCategory(groupedItems[categoryName][0].ingredient_name);
                   return (
                     <section key={categoryName}>
                       <div className="flex items-center gap-1.5 mb-3">
                         <span className="material-symbols-outlined text-primary-container text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{catInfo.icon}</span>
                         <h3 className="font-headline font-bold text-lg text-on-surface">{categoryName}</h3>
                       </div>
                       <div className="bg-surface-container-low rounded-xl p-1.5 space-y-0.5">
                         {groupedItems[categoryName].map((item: any) => (
                           <label key={item.id} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg group cursor-pointer active:scale-[0.99] transition-all">
                             <div className="flex items-center gap-3 min-w-0 flex-1">
                               <div className="relative flex items-center shrink-0">
                                 <input 
                                   checked={item.is_checked} 
                                   onChange={() => toggleCheck(item.id, !!item.is_checked)} 
                                   className="w-5 h-5 rounded-md border-outline-variant text-primary focus:ring-primary-container bg-surface-container-low cursor-pointer" 
                                   type="checkbox"
                                 />
                               </div>
                               <div className="min-w-0 flex-1 truncate pr-2">
                                 <p className={`font-medium text-sm truncate transition-opacity duration-300 ${item.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-on-surface'}`}>{item.ingredient_name}</p>
                               </div>
                             </div>
                             <span className={`font-bold text-sm shrink-0 transition-opacity duration-300 ${item.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-primary'}`}>
                               {formatIngredientAmount(item.quantity, item.unit)} {item.unit}
                             </span>
                           </label>
                         ))}
                       </div>
                     </section>
                   );
                })}
              </>
            )}

            {activeTab === 'recipes' && (
              <>
                 {sourceRecipes.map((r: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10 mb-6 relative">
                       <div className="absolute top-3 right-3 bg-surface/80 backdrop-blur-md px-2 py-1 rounded-lg border border-outline-variant/20 z-10 flex items-center gap-0.5 shadow-sm">
                          <span className="material-symbols-outlined text-[12px] text-primary">local_fire_department</span>
                          <span className="text-[10px] uppercase font-bold text-primary leading-none">{r.recipe?.kcal || r.kcal} kcal</span>
                       </div>
                       <div className="absolute top-3 left-3 bg-primary text-on-primary px-2.5 py-1 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.15)] z-10 flex items-center gap-1.5 border border-primary-container/20">
                          <span className="material-symbols-outlined text-[14px]">restaurant</span>
                          <span className="text-[10px] uppercase font-black tracking-wide">{r.portions} {r.portions === 1 ? 'Porcja' : (r.portions > 1 && r.portions < 5 ? 'Porcje' : 'Porcji')}</span>
                       </div>
                       <div 
                           className="h-28 sm:h-32 w-full relative cursor-pointer active:scale-[0.98] transition-transform overflow-hidden rounded-t-2xl"
                           onClick={() => navigate(`/recipe/${r.recipe?.id ?? r.id}`)}
                       >
                          <RecipeCoverImage
                            recipe={{
                              id: r.recipe?.id ?? r.id,
                              name: r.recipe?.name ?? r.name,
                              image_url: r.recipe?.image_url ?? r.image_url,
                            }}
                            alt={r.recipe?.name || r.name}
                            className="absolute inset-0 w-full h-full"
                            imgClassName="absolute inset-0 w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                          <div className="absolute bottom-3 left-4 right-4">
                             <h3 className="font-headline font-bold text-lg text-white leading-tight drop-shadow-md">{r.recipe?.name || r.name}</h3>
                          </div>
                       </div>
                       <div className="p-2 space-y-1 bg-surface-container-low">
                           {(r.ingredients && r.ingredients.length > 0) ? r.ingredients.map((ing: any, i: number) => {
                              const shopItem = items.find(it => (it.ingredient_name || '').toLowerCase() === (ing.name || '').toLowerCase());
                              return (
                                <label key={i} className={`flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg transition-all ${shopItem ? 'group cursor-pointer active:scale-[0.99] hover:bg-surface-container-highest/20' : 'opacity-50'}`}>
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="relative flex items-center shrink-0">
                                      <input 
                                        checked={shopItem ? shopItem.is_checked : false} 
                                        onChange={() => shopItem && toggleCheck(shopItem.id, !!shopItem.is_checked)} 
                                        disabled={!shopItem}
                                        className="w-5 h-5 rounded-md border-outline-variant text-primary focus:ring-primary-container bg-surface-container-low cursor-pointer disabled:opacity-50" 
                                        type="checkbox"
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1 truncate pr-2">
                                      <p className={`font-medium text-sm truncate transition-opacity duration-300 ${shopItem?.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-on-surface'}`}>{ing.name}</p>
                                    </div>
                                  </div>
                                  <span className={`font-bold text-sm shrink-0 transition-opacity duration-300 ${shopItem?.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-primary'}`}>
                                    {formatIngredientAmount(Number(ing.amount) * r.portions, ing.unit)} {ing.unit}
                                  </span>
                                </label>
                              );
                           }) : (
                              <p className="text-center text-xs text-on-surface-variant p-4">Brak wprowadzonych składników dla tego przepisu.</p>
                           )}
                       </div>
                    </div>
                 ))}
                 {sourceRecipes.length === 0 && (
                    <div className="text-center opacity-60 mt-10">
                       <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-2">restaurant_menu</span>
                       <p className="text-sm font-medium text-on-surface-variant">Brak przepisów powiązanych ze składnikami.</p>
                    </div>
                 )}
              </>
            )}
          </div>
        )}
      </main>
      
      <BottomNav />

      {/* Dodaj produkt */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !addSubmitting && setShowAddModal(false)}
          />
          <div className="bg-surface w-full sm:max-w-md sm:rounded-[28px] rounded-t-[28px] overflow-hidden shadow-2xl relative z-10 border border-outline-variant/15 max-h-[90vh] flex flex-col">
            <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mt-3 sm:hidden shrink-0" />
            <div className="p-6 pb-4 flex items-center justify-between gap-3">
              <h3 className="font-headline font-bold text-lg text-on-surface">Dodaj produkt</h3>
              <button
                type="button"
                disabled={addSubmitting}
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                aria-label="Zamknij"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Nazwa</label>
                <input
                  type="text"
                  value={newIngredientName}
                  onChange={e => setNewIngredientName(e.target.value)}
                  placeholder="np. Mleko 2%"
                  className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface font-medium text-sm outline-none focus:ring-2 focus:ring-primary/25 border border-transparent"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Ilość</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newQuantity}
                    onChange={e => setNewQuantity(e.target.value)}
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface font-medium text-sm outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
                <div className="w-28 shrink-0">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Jedn.</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    placeholder="szt"
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface font-medium text-sm outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>
              {addError && (
                <p className="text-error text-sm font-medium">{addError}</p>
              )}
              <button
                type="button"
                disabled={addSubmitting}
                onClick={handleAddProduct}
                className="w-full h-12 bg-primary text-on-primary font-bold text-sm rounded-xl active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {addSubmitting ? (
                  <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                    Dodaj do listy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-black/40 animate-in fade-in duration-300" 
            onClick={() => setShowConfirm(false)}
          />
          <div className="bg-white w-full max-w-[320px] rounded-[24px] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 border border-outline-variant/20">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">delete_sweep</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-[#1c1b1f] mb-2">Wyczyścić listę?</h3>
              <p className="text-[#49454f] leading-relaxed text-xs mb-6">
                Czy na pewno chcesz usunąć wszystkie produkty? Tej operacji nie można cofnąć.
              </p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={clearList}
                  className="w-full bg-[#ba1a1a] text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all outline-none"
                >
                  Tak, wyczyść wszystko
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="w-full bg-[#f4f3f7] text-[#1c1b1f] py-3 rounded-xl font-bold text-sm active:scale-95 transition-all outline-none"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
