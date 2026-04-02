import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppData } from '../lib/AppDataContext';
import { BottomNav } from '../components/BottomNav';

export function ShoppingList() {
  const { shoppingList, shoppingListRecipes, refreshShoppingList } = useAppData();
  const [items, setItems] = useState<any[]>(shoppingList || []);
  const [sourceRecipes, setSourceRecipes] = useState<any[]>(shoppingListRecipes || []);
  const [activeTab, setActiveTab] = useState<'categories' | 'recipes'>('categories');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setItems(shoppingList || []);
    setSourceRecipes(shoppingListRecipes || []);
  }, [shoppingList, shoppingListRecipes]);

  const toggleCheck = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setItems(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, is_checked: !currentStatus } : item);
      return updated.sort((a,b) => {
         if (a.is_checked === b.is_checked) return a.ingredient_name.localeCompare(b.ingredient_name);
         return a.is_checked ? 1 : -1;
      });
    });
    await supabase.from('shopping_list').update({ is_checked: !currentStatus }).eq('id', id);
    refreshShoppingList();
  };

  const clearList = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('shopping_list').delete().eq('user_id', user.id);
    await supabase.from('shopping_list_recipes').delete().eq('user_id', user.id);
    refreshShoppingList();
    setShowConfirm(false);
  };

  const getCategory = (name: string) => {
    const n = name.toLowerCase();
    
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
          <button className="bg-primary-gradient text-on-primary px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-ambient active:scale-95 transition-transform font-semibold text-sm">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
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
                       <div className="flex items-center gap-2 mb-4">
                         <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>{catInfo.icon}</span>
                         <h3 className="font-headline font-bold text-xl text-on-surface">{categoryName}</h3>
                       </div>
                       <div className="bg-surface-container-low rounded-xl p-2 space-y-1">
                         {groupedItems[categoryName].map((item: any) => (
                           <label key={item.id} className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group cursor-pointer active:scale-[0.99] transition-all">
                             <div className="flex items-center gap-4">
                               <div className="relative flex items-center">
                                 <input 
                                   checked={item.is_checked} 
                                   onChange={() => toggleCheck(item.id, item.is_checked)} 
                                   className="w-6 h-6 rounded-md border-outline-variant text-primary focus:ring-primary-container bg-surface-container-low cursor-pointer" 
                                   type="checkbox"
                                 />
                               </div>
                               <div>
                                 <p className={`font-semibold transition-opacity duration-300 ${item.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-on-surface'}`}>{item.ingredient_name}</p>
                               </div>
                             </div>
                             <span className={`font-bold transition-opacity duration-300 ${item.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-primary'}`}>{item.amount} {item.unit}</span>
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
                 {sourceRecipes.map((r, idx) => (
                    <section key={idx} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 mb-6 relative">
                       <div className="absolute top-3 right-3 bg-surface/80 backdrop-blur-md px-2 py-1 rounded-lg border border-outline-variant/20 z-10 flex items-center gap-0.5 shadow-sm">
                          <span className="material-symbols-outlined text-[12px] text-primary">local_fire_department</span>
                          <span className="text-[10px] uppercase font-bold text-primary leading-none">{r.kcal} kcal</span>
                       </div>
                       <div className="absolute top-3 left-3 bg-primary text-on-primary px-2.5 py-1 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.15)] z-10 flex items-center gap-1.5 border border-primary-container/20">
                          <span className="material-symbols-outlined text-[14px]">restaurant</span>
                          <span className="text-[10px] uppercase font-black tracking-wide">{r.portions} {r.portions === 1 ? 'Porcja' : (r.portions > 1 && r.portions < 5 ? 'Porcje' : 'Porcji')}</span>
                       </div>
                       <div className="h-28 sm:h-32 w-full relative">
                          <img src={r.image_url} alt={r.name} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                          <div className="absolute bottom-3 left-4 right-4">
                             <h3 className="font-headline font-bold text-lg text-white leading-tight drop-shadow-md">{r.name}</h3>
                          </div>
                       </div>
                       <div className="p-2 space-y-1 bg-surface-container-low">
                          {r.recipe_ingredients && r.recipe_ingredients.map((ing: any, i: number) => {
                             const shopItem = items.find(it => it.ingredient_name.toLowerCase() === ing.name.toLowerCase());
                             return (
                               <label key={i} className={`flex items-center justify-between p-3 sm:p-4 bg-surface-container-lowest rounded-lg transition-all ${shopItem ? 'group cursor-pointer active:scale-[0.99] hover:bg-surface-container-highest/20' : 'opacity-50'}`}>
                                 <div className="flex items-center gap-4">
                                   <div className="relative flex items-center">
                                     <input 
                                       checked={shopItem ? shopItem.is_checked : false} 
                                       onChange={() => shopItem && toggleCheck(shopItem.id, shopItem.is_checked)} 
                                       disabled={!shopItem}
                                       className="w-5 h-5 sm:w-6 sm:h-6 rounded-md border-outline-variant text-primary focus:ring-primary-container bg-surface-container-low cursor-pointer disabled:opacity-50" 
                                       type="checkbox"
                                     />
                                   </div>
                                   <div>
                                     <p className={`font-semibold text-sm sm:text-base transition-opacity duration-300 ${shopItem?.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-on-surface'}`}>{ing.name}</p>
                                   </div>
                                 </div>
                                 <span className={`font-bold text-sm transition-opacity duration-300 ${shopItem?.is_checked ? 'text-on-surface-variant line-through opacity-60' : 'text-primary'}`}>{Number(ing.amount) * r.portions} {ing.unit}</span>
                               </label>
                             );
                          })}
                          {(!r.recipe_ingredients || r.recipe_ingredients.length === 0) && (
                             <p className="text-center text-xs text-on-surface-variant p-4">Brak wprowadzonych składników dla tego przepisu.</p>
                          )}
                       </div>
                    </section>
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
