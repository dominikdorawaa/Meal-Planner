import { BottomNav } from '../components/BottomNav';
import { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { useNavigate } from 'react-router-dom';
import { recipeImageFallbackUrl } from '../lib/recipeImage';
import { RecipeCoverImage } from '../components/RecipeCoverImage';

const PLACEHOLDER_IMAGE = "PLAN_PLACEHOLDER_TOKEN"; // Tylko marker do logiki poniżej


// Dni są teraz generowane dynamicznie wewnątrz komponentu Plan

const CARD_WRAPPER = "w-[33.3333vw] sm:w-[150px] shrink-0 px-2 sm:px-3 snap-start flex justify-center";

const formatMacrosShort = (p: number, f: number) => {
  return `${p}g B. · ${f}g Tł.`;
};


const formatFullDate = (dayName: string, dateStr: string) => {
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const parts = dateStr.split('.');
  if (parts.length !== 2) return `${dayName} (${dateStr})`;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(d) || isNaN(m) || m < 1 || m > 12) return `${dayName} (${dateStr})`;
  return `${dayName}, ${d} ${months[m - 1]}`;
};

const MEAL_TYPES = [
  { id: 'breakfast', name: 'Śniadanie', icon: 'light_mode' },
  { id: 'snack1', name: '2 Śniadanie', icon: 'bakery_dining' },
  { id: 'lunch', name: 'Lunch', icon: 'lunch_dining' },
  { id: 'snack2', name: 'Przekąska', icon: 'nutrition' },
  { id: 'dinner', name: 'Obiad', icon: 'restaurant' },
  { id: 'supper', name: 'Kolacja', icon: 'dark_mode' },
];

const getMealTypeName = (type: string, mealConfig?: any[]) => {
  if (mealConfig) {
    const config = mealConfig.find(m => m.id === type);
    if (config) return config.name;
  }
  return MEAL_TYPES.find(m => m.id === type)?.name || type;
};

export function Plan() {
  const navigate = useNavigate();
  const { recipes, products, profile, userMeals, setUserMeals, loading: contextLoading, refreshMeals, getConsumedForDay, refreshShoppingList } = useAppData();
  const [mealToDelete, setMealToDelete] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeMealMenu, setActiveMealMenu] = useState<any | null>(null);
  const [copyModeMeal, setCopyModeMeal] = useState<any | null>(null);
  const [selectedCopySlots, setSelectedCopySlots] = useState<string[]>([]);
  const [slotsToOverwrite, setSlotsToOverwrite] = useState<any[]>([]);

  // Stany dla dni
  const [activeDayMenu, setActiveDayMenu] = useState<string | null>(null);
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  const [copyModeDay, setCopyModeDay] = useState<string | null>(null);
  const [selectedCopyDays, setSelectedCopyDays] = useState<string[]>([]);

  // Stany dla zakupów
  const [shoppingSelectionMode, setShoppingSelectionMode] = useState<boolean>(false);
  const [selectedShoppingDays, setSelectedShoppingDays] = useState<string[]>([]);
  const [selectedShoppingMeals, setSelectedShoppingMeals] = useState<string[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Kalendarz dynamiczny - zapamiętaj pozycję między nawigacjami
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const saved = sessionStorage.getItem('planBaseDate');
    if (saved) {
      const d = new Date(saved);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    sessionStorage.setItem('planBaseDate', baseDate.toISOString());
  }, [baseDate]);

  const generateDays = (startDate: Date, count: number = 14) => {
    const daysList = [];
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    for (let i = 0; i < count; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dayName = dayNames[d.getDay()];
      const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const today = new Date();
      const isToday = d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
      daysList.push({ name: dayName, date: dateStr, active: true, isToday });
    }
    return daysList;
  };

  const days = generateDays(baseDate);

  const handlePrevWeek = () => {
    setBaseDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setBaseDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleGoToToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setBaseDate(d);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Sprawdź onboarding (tylko gdy profil jest załadowany, a cel kaloryczny jest nadal zerowy/null)
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!contextLoading) {
        if (!profile || !profile.target_kcal || profile.target_kcal === 0) {
           navigate('/onboarding');
        }
      }
    };
    checkOnboarding();
  }, [contextLoading, profile, navigate]);

  // Odśwież meals po powrocie na stronę (np. po dodaniu przepisu w /recipes)
  useEffect(() => {
    refreshMeals();
    // Przywróć pozycję scrolla bez animacji
    const savedScroll = sessionStorage.getItem('planScrollLeft');
    if (savedScroll && scrollRef.current) {
      const el = scrollRef.current;
      el.classList.remove('scroll-smooth');
      el.scrollLeft = parseInt(savedScroll, 10);
      requestAnimationFrame(() => el.classList.add('scroll-smooth'));
    }
  }, []);

  // Zapamiętaj pozycję scrolla
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      sessionStorage.setItem('planScrollLeft', String(el.scrollLeft));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleDeleteMeal = async (mealId: string) => {
    // Optimistic update
    setUserMeals(prev => prev.filter(m => m.id !== mealId));
    try {
      await api.meals.delete(mealId);
      await refreshMeals();
    } catch (err) {
      console.error("Error deleting meal:", err);
      refreshMeals(); // Rollback if needed
    }
  };

  const handleCopyToNextDay = async (meal: any) => {
    const todayIdx = days.findIndex(d => d.date === meal.date_str);

    let tomorrowDateStr;
    if (todayIdx === -1 || todayIdx === days.length - 1) {
      // Jeśli nie ma jutra w tablicy, obliczamy datę na podstawie meal.date_str
      const parts = meal.date_str.split('.');
      const d = new Date();
      d.setDate(parseInt(parts[0]));
      d.setMonth(parseInt(parts[1]) - 1);
      d.setDate(d.getDate() + 1);
      tomorrowDateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    } else {
      tomorrowDateStr = days[todayIdx + 1].date;
    }

    try {
      await api.meals.add({
        recipe: (meal.recipe?.id || meal.recipe) ? { id: (meal.recipe?.id || meal.recipe) } : null,
        product: (meal.product?.id || meal.product) ? { id: (meal.product?.id || meal.product) } : null,
        date_str: tomorrowDateStr,
        meal_type: meal.meal_type,
        portions_consumed: meal.portions_consumed,
        manual_name: meal.manual_name,
        manual_kcal: meal.manual_kcal,
        manual_protein: meal.manual_protein,
        manual_fat: meal.manual_fat,
        manual_carbs: meal.manual_carbs
      });
      setActiveMealMenu(null);
      await refreshMeals();
    } catch (err) {
      console.error("Error copying meal:", err);
    }
  };

  const handlePreSubmitCopyMode = () => {
    let conflicts: any[] = [];

    if (copyModeMeal && selectedCopySlots.length > 0) {
      conflicts = userMeals.filter(m => selectedCopySlots.includes(`${m.date_str}_${m.meal_type}`));
    } else if (copyModeDay && selectedCopyDays.length > 0) {
      conflicts = userMeals.filter(m => selectedCopyDays.includes(m.date_str));
    } else {
      return;
    }

    if (conflicts.length > 0) {
      setSlotsToOverwrite(conflicts);
    } else {
      executeCopyAction();
    }
  };

  const executeCopyAction = async () => {
    try {
      if (slotsToOverwrite.length > 0) {
        const idsToDelete = slotsToOverwrite.map(m => m.id);
        await Promise.all(idsToDelete.map(id => api.meals.delete(id)));
      }

      const promises: Promise<any>[] = [];

      if (copyModeMeal) {
        selectedCopySlots.forEach(slotStr => {
          const [dateStr, mealType] = slotStr.split('_');
          const rid = copyModeMeal.recipe?.id || copyModeMeal.recipe;
          const pid = copyModeMeal.product?.id || copyModeMeal.product;
          promises.push(api.meals.add({
            recipe: rid ? { id: rid } : null,
            product: pid ? { id: pid } : null,
            date_str: dateStr,
            meal_type: mealType,
            portions_consumed: copyModeMeal.portions_consumed,
            manual_name: copyModeMeal.manual_name,
            manual_kcal: copyModeMeal.manual_kcal,
            manual_protein: copyModeMeal.manual_protein,
            manual_fat: copyModeMeal.manual_fat,
            manual_carbs: copyModeMeal.manual_carbs
          }));
        });
      } else if (copyModeDay) {
        const mealsToCopy = userMeals.filter(m => m.date_str === copyModeDay);
        selectedCopyDays.forEach(targetDate => {
          mealsToCopy.forEach(meal => {
            const rid = meal.recipe?.id || meal.recipe;
            const pid = meal.product?.id || meal.product;
            promises.push(api.meals.add({
              recipe: rid ? { id: rid } : null,
              product: pid ? { id: pid } : null,
              date_str: targetDate,
              meal_type: meal.meal_type,
              portions_consumed: meal.portions_consumed,
              manual_name: meal.manual_name,
              manual_kcal: meal.manual_kcal,
              manual_protein: meal.manual_protein,
              manual_fat: meal.manual_fat,
              manual_carbs: meal.manual_carbs
            }));
          });
        });
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      setCopyModeMeal(null);
      setSelectedCopySlots([]);
      setCopyModeDay(null);
      setSelectedCopyDays([]);
      setSlotsToOverwrite([]);
      await refreshMeals();
    } catch (err) {
      console.error("Error in bulk copy action:", err);
    }
  };

  const handleDeleteDay = async (dateStr: string) => {
    // Optimistic update
    setUserMeals(prev => prev.filter(m => m.date_str !== dateStr));
    try {
      const mealsToDelete = userMeals.filter(m => m.date_str === dateStr);
      await Promise.all(mealsToDelete.map(m => api.meals.delete(m.id)));
      setDayToDelete(null);
      await refreshMeals();
    } catch (err) {
      console.error("Error deleting day meals:", err);
      refreshMeals();
    }
  };

  const generateShoppingList = async () => {
    try {
      let mealsToProcess: any[] = [];
      const explicitMeals = userMeals.filter(m => selectedShoppingMeals.includes(m.id));
      const dayMeals = userMeals.filter(m => selectedShoppingDays.includes(m.date_str) && !selectedShoppingMeals.includes(m.id));
      mealsToProcess = [...explicitMeals, ...dayMeals];

      if (mealsToProcess.length === 0) return;

      const recipeIds = Array.from(new Set(mealsToProcess.map(m => (m.recipe?.id || m.recipe)).filter(Boolean)));
      if (recipeIds.length === 0) {
        alert("Wybrane posiłki nie są przepisami, nie można wygenerować listy składników.");
        return;
      }

      // Fetch ingredients for these recipes
      const recipesWithIngs = await Promise.all(recipeIds.map(rid => api.recipes.getById(rid.toString())));
      
      const ingredients: any[] = [];
      recipesWithIngs.forEach(r => {
        if (r.ingredients) {
          r.ingredients.forEach((ing: any) => ingredients.push({ ...ing, recipe_id: r.id }));
        }
      });

      if (ingredients.length === 0) {
        alert("Wybrane przepisy nie posiadają składników.");
        return;
      }

      const localAccumulator = new Map<string, any>();
      const recipePortions = new Map<string, number>();

      mealsToProcess.forEach(meal => {
        const rid = meal.recipe?.id || meal.recipe;
        if (!rid) return;
        const recipe = recipesWithIngs.find(r => r.id === rid);
        if (!recipe) return;

        const basePortions = recipe.portions || 1.0;
        const consumedPortions = meal.portions_consumed || 1.0;
        const ratio = consumedPortions / basePortions;

        // Sumujemy całkowitą proporcję dla przepisu z wszystkich dni (na potrzeby widoku ShoppingList wg przepisów)
        recipePortions.set(rid, (recipePortions.get(rid) || 0) + ratio);

        const mealIngredients = ingredients.filter(i => i.recipe_id === rid);
        mealIngredients.forEach(ing => {
          const key = `${ing.name.toLowerCase()}_${ing.unit.toLowerCase()}`;
          const scaledAmount = Number(ing.amount) * ratio;

          if (localAccumulator.has(key)) {
            const existing = localAccumulator.get(key);
            existing.quantity = Number(existing.quantity) + scaledAmount;
          } else {
            localAccumulator.set(key, {
              ingredient_name: ing.name,
              quantity: scaledAmount,
              unit: ing.unit
            });
          }
        });
      });

      const promises: Promise<any>[] = [];
      localAccumulator.forEach(item => {
        promises.push(api.shoppingList.addItem(item));
      });

      recipePortions.forEach((ratioAccumulated, rid) => {
        promises.push(api.shoppingList.addRecipe({ recipe: { id: rid }, portions: ratioAccumulated }));
      });

      await Promise.all(promises);
      await refreshShoppingList();

      setShoppingSelectionMode(false);
      setSelectedShoppingDays([]);
      setSelectedShoppingMeals([]);
      setSuccessToast("Składniki dodano pomyślnie do listy zakupów");
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error("Error generating shopping list:", err);
    }
  };

  const handleCopyDayNext = async (dateStr: string) => {
    const todayIdx = days.findIndex(d => d.date === dateStr);
    if (todayIdx === -1 || todayIdx === days.length - 1) {
      alert("Niestety nie ma następnego dnia w kalendarzu, aby skopiować listę dań.");
      return;
    }
    const tomorrow = days[todayIdx + 1];

    const mealsToCopy = userMeals.filter(m => m.date_str === dateStr);
    if (mealsToCopy.length === 0) return;

    // Jeżeli jutro ma jakieś posiłki - zrób małą symulację konfliktu by powiadomić usera (tutaj zrobimy bez, ale to miejsce na hot-fix jeśli trzeba)
    const existingTomorrowMeals = userMeals.filter(m => m.date_str === tomorrow.date);
    if (existingTomorrowMeals.length > 0) {
      // Dla szybkiej ścieżki po prostu wywołujemy modal:
      setCopyModeDay(dateStr);
      setSelectedCopyDays([tomorrow.date]);
      setActiveDayMenu(null);
      setSlotsToOverwrite(existingTomorrowMeals);
      return;
    }

    try {
      await Promise.all(mealsToCopy.map(m => api.meals.add({
        recipe: (m.recipe?.id || m.recipe) ? { id: (m.recipe?.id || m.recipe) } : null,
        product: (m.product?.id || m.product) ? { id: (m.product?.id || m.product) } : null,
        date_str: tomorrow.date,
        meal_type: m.meal_type,
        portions_consumed: m.portions_consumed,
        manual_name: m.manual_name,
        manual_kcal: m.manual_kcal,
        manual_protein: m.manual_protein,
        manual_fat: m.manual_fat,
        manual_carbs: m.manual_carbs
      })));
      setActiveDayMenu(null);
      await refreshMeals();
    } catch (err) {
      console.error("Error copying day to next:", err);
    }
  };


  const toggleCopySlot = (slotKey: string) => {
    setSelectedCopySlots(prev => prev.includes(slotKey) ? prev.filter(s => s !== slotKey) : [...prev, slotKey]);
  };

  const renderSlot = (date: string, mealType: string, isToday: boolean = false) => {
    const slotKey = `${date}_${mealType}`;
    const isCopyMode = !!copyModeMeal || !!copyModeDay;
    const isSelected = !!copyModeMeal ? selectedCopySlots.includes(slotKey) : selectedCopyDays.includes(date);

    const assignedMeals = userMeals.filter(m => m.date_str === date && m.meal_type === mealType);

    const validMeals = assignedMeals.filter(m => {
      const rid = m.recipe?.id || m.recipe;
      return !rid || recipes.some(r => r.id === rid);
    });

    const onSlotClick = () => {
      if (shoppingSelectionMode) return;
      if (!!copyModeDay) return;
      if (copyModeMeal) {
        toggleCopySlot(slotKey);
        return;
      }
      navigate(`/add-food?selectDate=${date}&selectType=${mealType}`);
    };

    if (validMeals.length > 0) {
      return (
        <div className={CARD_WRAPPER}>
          <div className={`flex flex-col gap-3 w-full max-w-[130px] h-full transition-all duration-300 ${isToday ? 'ring-2 ring-[#ff9800]/30 bg-[#ff9800]/[0.05] p-2 -mx-2 -my-2 rounded-3xl shadow-[0_0_15px_rgba(255,152,0,0.05)]' : ''}`}>
            {validMeals.map(assignedMeal => {
              const isSelectedShopping = selectedShoppingMeals.includes(assignedMeal.id);
              const rid = assignedMeal.recipe?.id || assignedMeal.recipe;
              const pid = assignedMeal.product?.id || assignedMeal.product;

              if (rid) {
                const recipe = recipes.find(r => r.id === rid);
                if (!recipe) return <PlanCard key={assignedMeal.id} onClick={onSlotClick} isCopyMode={isCopyMode} isSelected={isSelected} disabled={shoppingSelectionMode || !!copyModeDay} noWrap />;

                const mult = assignedMeal.portions_consumed || 1;
                return (
                  <RecipeCard
                    key={assignedMeal.id}
                    title={recipe.name}
                    kcal={String(Math.round(recipe.kcal * mult))}
                    macros={formatMacrosShort(parseFloat((recipe.protein * mult).toFixed(1)), parseFloat((recipe.fat * mult).toFixed(1)))}
                    imgSrc={recipe.image_url || PLACEHOLDER_IMAGE}
                    imageFallbackSrc={recipeImageFallbackUrl(recipe)}
                    noWrap
                    onClick={() => {
                      if (!shoppingSelectionMode && !copyModeDay && !copyModeMeal) {
                        navigate(`/recipe/${recipe.id}?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
                      }
                    }}
                    onMenuClick={() => {
                      if (shoppingSelectionMode) {
                        setSelectedShoppingMeals(prev => {
                          if (prev.includes(assignedMeal.id)) {
                            setSelectedShoppingDays(dPrev => dPrev.filter(d => d !== date));
                            return prev.filter(id => id !== assignedMeal.id);
                          } else {
                            return [...prev, assignedMeal.id];
                          }
                        });
                      } else if (copyModeMeal) {
                        toggleCopySlot(slotKey);
                      } else {
                        setActiveMealMenu(assignedMeal);
                      }
                    }}
                    isCopyMode={isCopyMode}
                    isSelected={isSelected}
                    isShoppingMode={shoppingSelectionMode}
                    isSelectedShopping={isSelectedShopping}
                    isProduct={false}
                  />
                );
              } else if (pid) {
                const product = products.find(p => p.id === pid);
                if (!product) return <PlanCard key={assignedMeal.id} onClick={onSlotClick} isCopyMode={isCopyMode} isSelected={isSelected} disabled={shoppingSelectionMode || !!copyModeDay} noWrap />;

                const weight = assignedMeal.portions_consumed || 100;
                const factor = product.unit === 'pc' ? weight : (weight / 100);
                const kcal = Math.round(product.kcal * factor);
                const p = parseFloat((product.protein * factor).toFixed(1));
                const f = parseFloat((product.fat * factor).toFixed(1));

                return (
                  <RecipeCard
                    key={assignedMeal.id}
                    title={product.name}
                    kcal={String(kcal)}
                    macros={formatMacrosShort(p, f)}
                    imgSrc={product.image_url || PLACEHOLDER_IMAGE}
                    noWrap
                    onClick={() => {
                      if (!shoppingSelectionMode && !copyModeDay && !copyModeMeal) {
                        navigate(`/product/${product.id}?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
                      }
                    }}
                    onMenuClick={() => {
                      if (shoppingSelectionMode) {
                        setSelectedShoppingMeals(prev => {
                          if (prev.includes(assignedMeal.id)) {
                            setSelectedShoppingDays(dPrev => dPrev.filter(d => d !== date));
                            return prev.filter(item => item !== assignedMeal.id);
                          } else {
                            return [...prev, assignedMeal.id];
                          }
                        });
                      } else if (copyModeMeal) {
                        toggleCopySlot(slotKey);
                      } else {
                        setActiveMealMenu(assignedMeal);
                      }
                    }}
                    isCopyMode={isCopyMode}
                    isSelected={isSelected}
                    isShoppingMode={shoppingSelectionMode}
                    isSelectedShopping={isSelectedShopping}
                    isProduct={true}
                  />
                );
              } else {
                // Render manual entry
                return (
                  <RecipeCard
                    key={assignedMeal.id}
                    title={assignedMeal.manual_name || 'Szybki posiłek'}
                    kcal={String(assignedMeal.manual_kcal || 0)}
                    macros={formatMacrosShort(Number(assignedMeal.manual_protein || 0), Number(assignedMeal.manual_fat || 0))}
                    imgSrc={PLACEHOLDER_IMAGE}
                    noWrap
                    onClick={() => {
                      if (!shoppingSelectionMode && !copyModeDay && !copyModeMeal) {
                        navigate(`/add-food?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
                      }
                    }}
                    onMenuClick={() => {
                      if (!shoppingSelectionMode && !copyModeDay && !copyModeMeal) {
                        setActiveMealMenu(assignedMeal);
                      }
                    }}
                    isCopyMode={isCopyMode}
                    isSelected={isSelected}
                    isShoppingMode={shoppingSelectionMode}
                    isSelectedShopping={isSelectedShopping}
                    isManual={true}
                  />
                );
              }
            })}

            {/* Przycisk dodaj kolejny posiłek (Przywrócony na dół) */}
            {!shoppingSelectionMode && !copyModeDay && !copyModeMeal && (
              <div 
                onClick={onSlotClick} 
                className="w-full py-2 bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/20 rounded-xl flex items-center justify-center gap-1 text-primary cursor-pointer transition-all active:scale-95 mt-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="text-[9px] font-bold uppercase tracking-widest leading-none translate-y-px">Więcej</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return <PlanCard onClick={onSlotClick} isCopyMode={isCopyMode} isSelected={isSelected} disabled={shoppingSelectionMode || !!copyModeDay} isToday={isToday} />;
  };

  if (contextLoading || !profile || profile.target_kcal === 0 || !profile.target_kcal) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
        </div>
        <p className="text-primary font-bold tracking-widest uppercase text-xs animate-pulse">Przygotowujemy Twój profil...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">
      {/* Toast Sukcesu */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-primary/10 backdrop-blur-md border border-primary/20 text-primary px-4 py-2.5 rounded-full shadow-sm z-[60] flex items-center justify-center gap-2 animate-slide-up whitespace-nowrap">
          <span className="material-symbols-outlined text-[16px] font-bold">check_circle</span>
          <span className="font-headline font-bold text-xs tracking-wide">{successToast}</span>
        </div>
      )}

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-screen-xl mx-auto">
          <button className="text-primary focus:outline-none">
            <span className="material-symbols-outlined text-[28px]">calendar_month</span>
          </button>
          <h1 className="font-headline font-bold text-xl tracking-tight text-primary">Twój Plan</h1>
          <button
            onClick={() => {
              setActiveDayMenu(null);
              setActiveMealMenu(null);
              setCopyModeDay(null);
              setCopyModeMeal(null);
              setShoppingSelectionMode(prev => !prev);
              setSelectedShoppingDays([]);
              setSelectedShoppingMeals([]);
            }}
            className={`focus:outline-none transition-colors ${shoppingSelectionMode ? 'text-on-primary bg-primary p-1.5 rounded-xl shadow-sm' : 'text-primary p-1.5 rounded-xl hover:bg-surface-container-highest'}`}
          >
            <span className="material-symbols-outlined text-[28px]">shopping_cart_checkout</span>
          </button>
        </div>
      </header>

      <main className="pt-32 max-w-[600px] mx-auto pb-6 relative">
        {/* Navigation Bar */}
        <div className="fixed top-16 left-0 right-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant/5 h-12 flex items-center justify-between px-6 max-w-[600px] mx-auto">
          <button onClick={handlePrevWeek} className="flex items-center text-primary/70 hover:text-primary active:scale-90 transition-all font-bold text-xs gap-1 group">
            <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </div>
            Poprzedni tydzień
          </button>
          <button onClick={handleGoToToday} className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-[11px] font-extrabold shadow-sm hover:bg-primary/20 transition-all active:scale-95 border border-primary/5">
            Dzisiaj
          </button>
          <button onClick={handleNextWeek} className="flex items-center text-primary/70 hover:text-primary active:scale-90 transition-all font-bold text-xs gap-1 group">
            Następny tydzień
            <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </div>
          </button>
        </div>
        <div ref={scrollRef} className="w-full overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth">
          <div className="w-max flex flex-col">

            {/* ROW 1: Dni Tygodnia Główka Makro */}
            <section className="flex mb-8 pt-1">
              {days.map((day, i) => {
                const consumed = getConsumedForDay(day.date);
                const isDayCopyMode = !!copyModeDay;
                const isSelectedCopyDay = selectedCopyDays.includes(day.date);

                return (
                  <div key={i} className={CARD_WRAPPER}>
                    <div
                      onClick={() => {
                        if (shoppingSelectionMode) {
                          const isDaySelected = selectedShoppingDays.includes(day.date);
                          if (isDaySelected) {
                            setSelectedShoppingDays(prev => prev.filter(d => d !== day.date));
                            const dayMealIds = userMeals.filter(m => m.date_str === day.date).map(m => m.id);
                            setSelectedShoppingMeals(prev => prev.filter(id => !dayMealIds.includes(id)));
                          } else {
                            setSelectedShoppingDays(prev => [...prev, day.date]);
                            const dayMealIds = userMeals.filter(m => m.date_str === day.date).map(m => m.id);
                            setSelectedShoppingMeals(prev => [...new Set([...prev, ...dayMealIds])]);
                          }
                        } else if (isDayCopyMode) {
                          setSelectedCopyDays(prev => prev.includes(day.date) ? prev.filter(d => d !== day.date) : [...prev, day.date]);
                        }
                      }}
                      className={`w-full max-w-[130px] bg-surface-container-lowest rounded-3xl p-2.5 sm:p-3 shadow-ambient flex flex-col gap-2 relative transition-all duration-300 ${day.isToday ? 'ring-2 ring-[#ff9800] bg-[#ff9800]/[0.04] shadow-lg shadow-[#ff9800]/10' : ''} ${!day.active ? 'opacity-80 scale-[0.98]' : ''} ${copyModeMeal ? 'opacity-40 grayscale-[30%]' : ''} ${(isDayCopyMode || shoppingSelectionMode) ? 'cursor-pointer hover:bg-primary/5 ring-inset' : ''} ${(isSelectedCopyDay || selectedShoppingDays.includes(day.date)) ? 'bg-primary/10 ring-2 ring-primary' : ''}`}
                    >
                      {!day.active && <div className="absolute inset-0 bg-surface/30 rounded-3xl pointer-events-none z-10 transition-all"></div>}

                      <div className="flex flex-col w-full">
                        <div className="flex justify-between items-center w-full">
                          <div className={`w-11 h-11 rounded-full text-[13px] font-headline font-extrabold flex items-center justify-center shadow-md transition-all duration-500 ${day.isToday ? 'bg-[#ff9800] text-white ring-4 ring-[#ff9800]/20' : (day.active ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary')}`}>
                            {day.date}
                          </div>

                          {shoppingSelectionMode ? (
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 border ${selectedShoppingDays.includes(day.date) ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline-variant/40 text-transparent hover:border-primary/50'}`}>
                              <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                            </div>
                          ) : isDayCopyMode ? (
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 border ${isSelectedCopyDay ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline-variant/40 text-transparent hover:border-primary/50'}`}>
                              <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                            </div>
                          ) : !copyModeMeal ? (
                            <button onClick={(e) => { e.stopPropagation(); setActiveDayMenu(day.date); }} className="bg-surface-container-highest/50 rounded-lg w-6 h-6 flex items-center justify-center text-on-surface-variant shrink-0 hover:bg-surface-container-highest transition-colors cursor-pointer shadow-sm active:scale-95">
                              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>edit_square</span>
                            </button>
                          ) : <div className="w-6 h-6 shrink-0"></div>}

                        </div>
                        <span className="uppercase text-[8px] font-extrabold tracking-widest text-on-surface-variant font-body line-clamp-1 mt-2 pl-0.5">{day.name}</span>
                      </div>
                      <div className="flex flex-col gap-2 mt-1.5 w-full">
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <div className="flex items-center gap-0.5 text-primary shrink-0">
                            <span className="uppercase tracking-normal text-[8px] font-extrabold pb-0.5">Kcal</span>
                          </div>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[10px] font-extrabold ${profile && consumed.kcal > profile.target_kcal ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {consumed.kcal}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile?.target_kcal || '···'}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden -mt-0.5 relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000" style={{ width: profile && profile.target_kcal > 0 ? `${Math.min(100, (consumed.kcal / profile.target_kcal) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-1000" style={{ width: profile && profile.target_kcal > 0 ? `${Math.max(0, Math.min(100, ((consumed.kcal / profile.target_kcal) * 100) - 100))}%` : '0%' }}></div>
                        </div>

                        {/* Białko */}
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold shrink-0">Białka</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && consumed.protein > (profile.target_protein_max || profile.target_protein * 1.1) ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {consumed.protein}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            <span className="text-[7px] opacity-80">
                              {profile ? `${profile.target_protein_min || Math.round(profile.target_protein * 0.9)}-${profile.target_protein_max || Math.round(profile.target_protein * 1.1)}` : '··'}g
                            </span>
                          </span>
                        </div>
                        <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden -mt-0.5 relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.min(100, (consumed.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((consumed.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>

                        {/* Tłuszcz */}
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold shrink-0">Tłuszcz</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && consumed.fat > (profile.target_fat_max || profile.target_fat * 1.1) ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {consumed.fat}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            <span className="text-[7px] opacity-80">
                              {profile ? `${profile.target_fat_min || Math.round(profile.target_fat * 0.9)}-${profile.target_fat_max || Math.round(profile.target_fat * 1.1)}` : '··'}g
                            </span>
                          </span>
                        </div>
                        <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden -mt-0.5 relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.min(100, (consumed.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((consumed.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>

                        {/* Węglowodany */}
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold shrink-0">Węgle</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && consumed.carbs > (profile.target_carbs_max || profile.target_carbs * 1.1) ? 'text-[#ba1a1a]' : 'text-primary'}`}>
                              {consumed.carbs}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            <span className="text-[7px] opacity-80">
                              {profile ? `${profile.target_carbs_min || Math.round(profile.target_carbs * 0.9)}-${profile.target_carbs_max || Math.round(profile.target_carbs * 1.1)}` : '··'}g
                            </span>
                          </span>
                        </div>
                        <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden -mt-0.5 relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.min(100, (consumed.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-[#ba1a1a] rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((consumed.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>

            {/* Dynamiczne rzędy posiłków na podstawie preferencji usera (kolejność i nazwy) */}
            {((Array.isArray(profile?.meal_config) ? profile.meal_config : null) || MEAL_TYPES.map(m => ({ 
                ...m, 
                visible: !Array.isArray(profile?.visible_meals) || profile.visible_meals.includes(m.id) 
              })))
              .filter((mt: any) => mt.visible)
              .map((mt: any) => (
                <div key={mt.id} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3 px-4 z-20">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl font-semibold">{mt.icon}</span>
                      <h2 className="font-headline font-bold text-xl text-on-surface tracking-tight">{mt.name}</h2>
                    </div>
                  </div>
                  <section className="flex mb-8">
                    {days.map((day, i) => (
                      <div key={i} className="shrink-0">
                        {renderSlot(day.date, mt.id, day.isToday)}
                      </div>
                    ))}
                  </section>
                </div>
              ))}

          </div>
        </div>
      </main>

      {/* Wybór przepisu przeniesiony do zakładki /recipes */}

      <BottomNav />

      {/* Menu zarządzania DNIEM (BottomSheet) */}
      {activeDayMenu && (
        <div className="fixed inset-0 bg-black/10 z-[200] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-6 animate-fade-in" onClick={() => setActiveDayMenu(null)}>
          <div className="bg-surface-container-lowest rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-ambient w-full max-w-sm border-t sm:border border-outline-variant/10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-6 sm:hidden"></div>

            <h3 className="font-headline font-bold text-xl text-on-surface mb-6 tracking-tight text-center">Zarządzaj całym dniem</h3>

            <div className="flex flex-col gap-3 mb-6">
              <button onClick={() => handleCopyDayNext(activeDayMenu)} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">event_upcoming</span>
                <span className="font-bold text-sm">Skopiuj na następny dzień</span>
              </button>

              <button onClick={() => { setCopyModeDay(activeDayMenu); setSelectedCopyDays([]); setActiveDayMenu(null); }} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">edit_calendar</span>
                <span className="font-bold text-sm">Skopiuj posiłki na inne dni</span>
              </button>

              <div className="h-px w-full bg-outline-variant/20 my-2"></div>

              <button onClick={() => { setDayToDelete(activeDayMenu); setActiveDayMenu(null); }} className="w-full py-4 px-5 bg-[#ba1a1a]/5 rounded-2xl flex items-center gap-4 hover:bg-[#ba1a1a]/10 transition-colors active:scale-95 text-[#ba1a1a]">
                <span className="material-symbols-outlined">delete_sweep</span>
                <span className="font-bold text-sm">Usuń posiłki z całego dnia</span>
              </button>
            </div>

            <button onClick={() => setActiveDayMenu(null)} className="w-full py-4 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-2xl transition-colors tracking-wide active:scale-95">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Tryb masowego kopiowania DNIA - Pływający pasek akcji */}
      {copyModeDay && (() => {
        const copyDay = days.find(d => d.date === copyModeDay);
        return (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-[2rem] p-3 pl-5 flex items-center justify-between z-[200] animate-slide-up border border-outline-variant/30 overflow-hidden">

            <div className="flex items-center w-[55%] gap-2 overflow-hidden">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">event_repeat</span>
              </div>
              <div className="flex flex-col truncate w-full">
                <span className="font-bold text-xs text-on-surface truncate pr-2">Kopiowanie dnia</span>
                <span className="text-[10px] text-on-surface-variant font-medium truncate">Szablon: {copyDay ? formatFullDate(copyDay.name, copyDay.date) : ''}</span>
              </div>
            </div>

            <div className="flex gap-2 ml-2 flex-shrink-0">
              <button onClick={() => { setCopyModeDay(null); setSelectedCopyDays([]); }} className="px-3 py-2.5 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors text-xs active:scale-95">
                Anuluj
              </button>
              <button
                onClick={handlePreSubmitCopyMode}
                disabled={selectedCopyDays.length === 0}
                className="px-4 py-2.5 font-bold text-on-primary bg-primary rounded-xl shadow-sm hover:bg-primary/90 transition-colors text-xs disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                Wklej ({selectedCopyDays.length})
              </button>
            </div>
          </div>
        );
      })()}

      {/* Menu zarządzania posiłkiem (BottomSheet na mobilce) */}
      {activeMealMenu && (
        <div className="fixed inset-0 bg-black/10 z-[200] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-6 animate-fade-in" onClick={() => setActiveMealMenu(null)}>
          <div className="bg-surface-container-lowest rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-ambient w-full max-w-sm border-t sm:border border-outline-variant/10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-6 sm:hidden"></div>

            <h3 className="font-headline font-bold text-xl text-on-surface mb-6 tracking-tight text-center">Zarządzaj posiłkiem</h3>

            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => {
                  const meal = activeMealMenu;
                  const rid = meal.recipe?.id || meal.recipe;
                  const pid = meal.product?.id || meal.product;
                  if (rid) {
                    navigate(`/recipe/${rid}?selectDate=${meal.date_str}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  } else if (pid) {
                    navigate(`/product/${pid}?selectDate=${meal.date_str}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  } else {
                    navigate(`/add-food?selectDate=${meal.date_str}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  }
                  setActiveMealMenu(null);
                }}
                className="w-full py-4 px-5 bg-primary/10 rounded-2xl flex items-center gap-4 hover:bg-primary/20 transition-colors active:scale-95 text-primary"
              >
                <span className="material-symbols-outlined">edit</span>
                <span className="font-bold text-sm">Edytuj posiłek</span>
              </button>

              <button onClick={() => handleCopyToNextDay(activeMealMenu)} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">event_upcoming</span>
                <span className="font-bold text-sm">Skopiuj na następny dzień</span>
              </button>

              <button onClick={() => { setCopyModeMeal(activeMealMenu); setSelectedCopySlots([]); setActiveMealMenu(null); }} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">edit_calendar</span>
                <span className="font-bold text-sm">Skopiuj na inne dni</span>
              </button>

              <div className="h-px w-full bg-outline-variant/20 my-2"></div>

              <button onClick={() => { setMealToDelete(activeMealMenu); setActiveMealMenu(null); }} className="w-full py-4 px-5 bg-[#ba1a1a]/5 rounded-2xl flex items-center gap-4 hover:bg-[#ba1a1a]/10 transition-colors active:scale-95 text-[#ba1a1a]">
                <span className="material-symbols-outlined">delete</span>
                <span className="font-bold text-sm">Usuń posiłek</span>
              </button>
            </div>

            <button onClick={() => setActiveMealMenu(null)} className="w-full py-4 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-2xl transition-colors tracking-wide active:scale-95">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Tryb masowego kopiowania - Pływający pasek akcji */}
      {copyModeMeal && (() => {
        const rid = copyModeMeal.recipe?.id || copyModeMeal.recipe;
        const copyRecipe = recipes.find(r => r.id === rid);
        const copyDay = days.find(d => d.date === copyModeMeal.date_str);
        return (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-[2rem] p-3 pl-4 flex items-center justify-between z-[200] animate-slide-up border border-outline-variant/30 overflow-hidden">

            <div className="flex items-center w-[55%] gap-3 overflow-hidden">
              {copyRecipe && (
                <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                  <RecipeCoverImage
                    recipe={copyRecipe}
                    alt="Kopiowany posiłek"
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col truncate w-full">
                <span className="font-bold text-xs text-on-surface truncate pr-2">{copyRecipe?.name || "Kopiowanie"}</span>
                <span className="text-[10px] text-on-surface-variant font-medium truncate">Z: {copyDay ? formatFullDate(copyDay.name, copyDay.date) : ''}</span>
              </div>
            </div>

            <div className="flex gap-2 ml-2 flex-shrink-0">
              <button onClick={() => { setCopyModeMeal(null); setSelectedCopySlots([]); }} className="px-3 py-2.5 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors text-xs active:scale-95">
                Anuluj
              </button>
              <button
                onClick={handlePreSubmitCopyMode}
                disabled={selectedCopySlots.length === 0}
                className="px-4 py-2.5 font-bold text-on-primary bg-primary rounded-xl shadow-sm hover:bg-primary/90 transition-colors text-xs disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                Wklej ({selectedCopySlots.length})
              </button>
            </div>
          </div>
        );
      })()}

      {/* Pasek Wyboru do Listy Zakupów */}
      {shoppingSelectionMode && (() => {
        const uniqueMealsCount = new Set([
          ...selectedShoppingMeals,
          ...userMeals.filter(m => selectedShoppingDays.includes(m.date_str)).map(m => m.id)
        ]).size;

        return (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[95%] max-w-[460px] bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-[2rem] p-3 flex items-center justify-between z-[200] animate-slide-up border border-outline-variant/30">
            <div className="flex items-center w-[60%] gap-2.5 pl-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px] sm:text-xl">shopping_cart_checkout</span>
              </div>
              <div className="flex flex-col w-full">
                <span className="font-bold text-[11px] sm:text-xs text-on-surface leading-tight">Generator Zakupów</span>
                <span className="text-[9px] sm:text-[10px] text-on-surface-variant font-medium leading-[1.25] mt-0.5">Zaznacz dni lub potrawy, z których zliczymy składniki na listę</span>
              </div>
            </div>

            <div className="flex gap-1.5 sm:gap-2 mr-1 flex-shrink-0">
              <button onClick={() => { setShoppingSelectionMode(false); setSelectedShoppingDays([]); setSelectedShoppingMeals([]); }} className="px-2.5 sm:px-3 py-2 sm:py-2.5 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors text-[11px] sm:text-xs active:scale-95">
                Anuluj
              </button>
              <button
                onClick={generateShoppingList}
                disabled={uniqueMealsCount === 0}
                className="px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-on-primary bg-primary rounded-xl shadow-sm hover:bg-primary/90 transition-colors text-[11px] sm:text-xs disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                Dalej ({uniqueMealsCount})
              </button>
            </div>
          </div>
        );
      })()}

      {/* Zastępowanie potraw przy Wklejaniu */}
      {slotsToOverwrite.length > 0 && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[230] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSlotsToOverwrite([])}>
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[320px] w-full border border-outline-variant/20 text-center flex flex-col max-h-[85vh] animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
              <span className="material-symbols-outlined text-[28px]">warning</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2 tracking-tight">Potwierdź podmianę</h3>
            <p className="text-on-surface-variant text-xs mb-5 leading-relaxed">Poniższe zaplanowane wcześniej posiłki zostaną bezpowrotnie usunięte z kalendarza:</p>

            <div className="flex flex-col gap-2 overflow-y-auto w-full mb-6 scroll-smooth pr-1">
              {slotsToOverwrite.map((m, idx) => {
                const rid = m.recipe?.id || m.recipe;
                const recipe = recipes.find(r => r.id === rid);
                const day = days.find(d => d.date === m.date_str);
                if (!recipe || !day) return null;
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[#ba1a1a]/5 border border-[#ba1a1a]/10 rounded-2xl w-full">
                    <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm shrink-0">
                      <RecipeCoverImage
                        recipe={recipe}
                        alt=""
                        className="w-full h-full"
                        imgClassName="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col overflow-hidden text-left w-full">
                      <span className="text-xs font-bold text-on-surface truncate">{recipe.name}</span>
                      <span className="text-[10px] text-[#ba1a1a] font-medium truncate mt-0.5 opacity-80">{formatFullDate(day.name, day.date)} • {getMealTypeName(m.meal_type)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => setSlotsToOverwrite([])}
                className="flex-1 py-3.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-2xl transition-colors active:scale-95 bg-surface-container-low"
              >
                Anuluj
              </button>
              <button
                onClick={executeCopyAction}
                className="flex-[1.5] py-3.5 text-sm font-bold text-white bg-[#ba1a1a] rounded-2xl shadow-sm hover:bg-[#ba1a1a]/90 transition-colors active:scale-95"
              >
                Podmień ({slotsToOverwrite.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ostrzeżenie przed usunięciem jednego posiłku */}
      {mealToDelete && (() => {
        const rid = mealToDelete.recipe?.id || mealToDelete.recipe;
        const recipe = recipes.find(r => r.id === rid);
        const day = days.find(d => d.date === mealToDelete.date_str);

        return (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in pointer-events-none">
            <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center pointer-events-auto flex flex-col items-center">

              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm">
                  {recipe && (
                    <RecipeCoverImage
                      recipe={recipe}
                      alt=""
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-surface-container-lowest rounded-full flex items-center justify-center z-10">
                  <div className="w-5 h-5 bg-[#ba1a1a] text-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[12px] font-bold">delete</span>
                  </div>
                </div>
              </div>

              <h3 className="font-headline font-bold text-lg text-on-surface mb-1">Usunąć {recipe?.name}?</h3>
              <p className="text-on-surface-variant text-xs mb-3">Zniknie z zaplanowanego menu:</p>

              <div className="flex flex-col items-center gap-1.5 bg-[#ba1a1a]/5 border border-[#ba1a1a]/10 rounded-2xl p-3 mb-6 w-full">
                <span className="text-[#ba1a1a] font-bold text-xs">
                  {day ? formatFullDate(day.name, day.date) : ''}
                </span>
                <div className="bg-[#ba1a1a]/10 px-2 py-0.5 rounded-md text-[#ba1a1a] font-bold text-[10px] tracking-wide uppercase">
                  {getMealTypeName(mealToDelete.meal_type)}
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setMealToDelete(null)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => {
                    handleDeleteMeal(mealToDelete.id);
                    setMealToDelete(null);
                  }}
                  className="flex-1 py-3 text-sm font-bold text-white bg-[#ba1a1a] rounded-xl shadow-sm hover:bg-[#ba1a1a]/90 transition-colors active:scale-95"
                >
                  Usuń
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ostrzeżenie przed usunięciem całego dnia */}
      {dayToDelete && (() => {
        const d = days.find(x => x.date === dayToDelete);
        return (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in pointer-events-none">
            <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center pointer-events-auto flex flex-col items-center">
              <div className="w-14 h-14 bg-[#ba1a1a]/10 text-[#ba1a1a] rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">delete_sweep</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-1">Czyszczenie dnia</h3>
              <p className="text-on-surface-variant text-xs mb-6">Trwale usuniesz wszystkie posiłki z: <b>{d ? formatFullDate(d.name, d.date) : ''}</b></p>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setDayToDelete(null)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => handleDeleteDay(dayToDelete)}
                  className="flex-[1.5] py-3 text-sm font-bold text-white bg-[#ba1a1a] rounded-xl shadow-sm hover:bg-[#ba1a1a]/90 transition-colors active:scale-95"
                >
                  Wyczyść listę
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function RecipeCard({ title, kcal, macros, imgSrc, imageFallbackSrc, onMenuClick, onClick, isCopyMode, isSelected, isShoppingMode, isSelectedShopping, noWrap, isProduct, isManual }: { title: string, kcal: string, macros: string, imgSrc: string, imageFallbackSrc?: string, onMenuClick: () => void, onClick?: () => void, isCopyMode?: boolean, isSelected?: boolean, isShoppingMode?: boolean, isSelectedShopping?: boolean, noWrap?: boolean, isProduct?: boolean, isManual?: boolean }) {

  const isSelectionMode = isCopyMode || isShoppingMode;
  const isSelectedState = isSelected || isSelectedShopping;

  const imageUrls = useMemo(() => {
    if (isProduct) {
      const primary = imgSrc && !imgSrc.includes('PLAN_PLACEHOLDER_TOKEN') ? imgSrc : null;
      return primary ? [primary] : [];
    }
    const primary = imgSrc && !imgSrc.includes('PLAN_PLACEHOLDER_TOKEN') ? imgSrc : null;
    const fb = imageFallbackSrc;
    if (primary && fb && primary !== fb) return [primary, fb];
    if (primary) return [primary];
    if (fb) return [fb];
    return [];
  }, [isProduct, imgSrc, imageFallbackSrc]);

  const [imageUrlIdx, setImageUrlIdx] = useState(0);

  useEffect(() => {
    setImageUrlIdx(0);
  }, [imageUrls.join('|')]);

  const renderImage = () => {
    if (imageUrlIdx < imageUrls.length) {
      return (
        <img
          src={imageUrls[imageUrlIdx]}
          alt={title}
          onError={() => setImageUrlIdx(i => i + 1)}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isSelectionMode && !isSelectedState ? 'grayscale opacity-70' : 'group-hover:scale-105'}`}
        />
      );
    }
    return (
      <div className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-1.5 transition-all ${isManual ? 'bg-orange-50 group-hover:bg-orange-100' : isProduct ? 'bg-primary/[0.03] group-hover:bg-primary/[0.06]' : 'bg-[#f1f6ed] group-hover:bg-[#e8f1e2]'}`}>
        <div className={`${isManual ? 'w-7 h-7' : 'w-10 h-10'} rounded-full flex items-center justify-center shadow-inner ${isManual ? 'bg-orange-100/50 text-orange-500' : isProduct ? 'bg-primary/10 text-primary' : 'bg-white/50 text-[#6B8E23]'}`}>
          <span className={`material-symbols-outlined ${isManual ? 'text-sm' : 'text-xl'} opacity-80`}>
            {isManual ? 'bolt' : isProduct ? 'nutrition' : 'photo_camera'}
          </span>
        </div>
      </div>
    );
  };

  const content = (
    <div onClick={isSelectionMode ? onMenuClick : onClick} className={`w-full max-w-[130px] flex flex-col gap-1.5 group relative transition-all duration-300 ${isSelectionMode || onClick ? 'cursor-pointer hover:scale-105' : ''}`}>

      <div className={`${isManual ? 'h-[85px]' : 'h-[120px] sm:h-[135px]'} w-full rounded-2xl overflow-hidden bg-surface-container-lowest relative shadow-sm border transition-all ${isSelectedState ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-outline-variant/10'}`}>
        {renderImage()}

        <div className={`absolute ${isManual ? 'bottom-1.5 left-1.5' : 'bottom-2 left-2'} z-10 bg-surface/90 backdrop-blur-xl px-1.5 h-[14px] flex items-center justify-center gap-0.5 rounded-md shadow-sm`}>
          <span className="text-[9px] font-bold text-primary tracking-wide leading-none translate-y-[0.5px]">{kcal} kcal</span>
        </div>

        {isSelectionMode ? (
          <div className={`absolute ${isManual ? 'top-1.5 right-1.5' : 'top-2 right-2'} w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelectedState ? 'bg-primary border-primary text-on-primary' : 'bg-surface/50 backdrop-blur-md border-white/80 text-transparent'}`}>
            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
          </div>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onMenuClick(); }} className={`absolute ${isManual ? 'top-1.5 right-1.5 w-5 h-5' : 'top-2 right-2 w-6 h-6'} bg-black/30 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center text-white hover:bg-black/40 transition-colors active:scale-90`}>
            <span className="material-symbols-outlined text-[13px]">more_horiz</span>
          </button>
        )}
      </div>

      <div className="flex flex-col px-0.5">
        <h3 className="font-headline font-bold text-[11px] sm:text-[13px] text-on-surface leading-tight line-clamp-1">{title}</h3>
        <span className="text-[9px] sm:text-[10px] font-body font-medium text-on-surface-variant tracking-wide mt-1 truncate block bg-surface-container-highest/50 px-1.5 py-0.5 rounded-md w-fit">{macros}</span>
      </div>
    </div>
  );

  if (noWrap) return content;
  return <div className={CARD_WRAPPER}>{content}</div>;
}

function PlanCard({ onClick, isCopyMode, isSelected, disabled, isToday, noWrap }: { onClick: () => void, isCopyMode?: boolean, isSelected?: boolean, disabled?: boolean, isToday?: boolean, noWrap?: boolean }) {
  const content = (
    <div onClick={disabled ? undefined : onClick} className={`relative w-full max-w-[130px] h-[120px] sm:h-[135px] rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 group overflow-hidden ${disabled ? 'opacity-30 bg-surface-container-highest/10 pointer-events-none' : isCopyMode ? 'bg-surface-container-highest/20 cursor-pointer' : 'bg-transparent border border-dashed border-outline-variant/20 hover:bg-surface-container-highest/30 hover:border-primary/30 cursor-pointer active:scale-95'} ${isSelected ? '!bg-primary/10 border-solid border-primary ring-2 ring-primary' : ''} ${isToday ? 'ring-2 ring-[#ff9800]/25 bg-[#ff9800]/[0.01]' : ''}`}>

      {isCopyMode && (
        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-highest border-primary/30 text-transparent'}`}>
          <span className="material-symbols-outlined text-[14px] font-bold">check</span>
        </div>
      )}

      <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary text-on-primary' : 'border-primary/40 text-primary/60 bg-primary/5 group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary'}`}>
        <span className="material-symbols-outlined text-[16px]">{isCopyMode ? 'file_copy' : 'add'}</span>
      </div>
      {!isCopyMode && !noWrap && (
        <span className="text-primary/60 text-[9px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">Plan</span>
      )}
      {isCopyMode && (
        <span className="text-primary/70 text-[9px] font-bold tracking-widest uppercase">Wklej</span>
      )}
    </div>
  );

  if (noWrap) return content;
  return <div className={CARD_WRAPPER}>{content}</div>;
}
