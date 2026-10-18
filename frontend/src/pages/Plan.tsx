import { BottomNav } from '../components/BottomNav';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { productDisplayName } from '../lib/productName';
import { resolveMealProduct } from '../lib/mealProducts';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_RECIPE_IMAGE_URL } from '../lib/recipeImage';
import { formatMacrosShort } from '../lib/macros';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { MEAL_TYPES, profileMealTypes } from '../lib/mealTypes';
import { addDaysToIsoDate, formatDayMonth, formatDayWithMonthName, formatRelativeDayLabel, parseIsoDate, planDays } from '../lib/planDates';
import { PlanConflictDialog } from '../components/PlanConflictDialog';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { pluralForm, t, type MessageKey } from '../i18n';
import {
  deleteMeals,
  entityId,
  findConflicts,
  mealsOfDay,
  placeDayOnDates,
  placeMealInSlots,
  slotKey as toSlotKey,
  transferMeals,
  undoTransfer,
  type ConflictMode,
  type Placement,
  type PlanMeal,
  type TransferResult,
} from '../lib/planTransfer';

type PendingTransfer = {
  placements: Placement[];
  conflicts: PlanMeal[];
  removedSources: PlanMeal[];
  successKey: MessageKey;
};

type Snackbar = { id: number; message: string; result?: TransferResult };

const PLACEHOLDER_IMAGE = "PLAN_PLACEHOLDER_TOKEN"; // Tylko marker do logiki poniżej


// Dni są teraz generowane dynamicznie wewnątrz komponentu Plan

const CARD_WRAPPER = "w-[33.3333vw] sm:w-[150px] shrink-0 px-2 sm:px-3 snap-start flex justify-center";



const getMealTypeName = (type: string, mealConfig?: any[]) => {
  if (mealConfig) {
    const config = mealConfig.find(m => m.id === type);
    if (config) return config.name;
  }
  return MEAL_TYPES.find(m => m.id === type)?.name || type;
};

export function Plan() {
  const navigate = useNavigate();
  const { recipes, profile, userMeals, setUserMeals, loading: contextLoading, refreshMeals, getConsumedForDay } = useAppData();
  const [mealToDelete, setMealToDelete] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeMealMenu, setActiveMealMenu] = useState<any | null>(null);
  const [copyModeMeal, setCopyModeMeal] = useState<any | null>(null);
  const [selectedCopySlots, setSelectedCopySlots] = useState<string[]>([]);
  const [mealSelectionAction, setMealSelectionAction] = useState<'copy' | 'move'>('copy');
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const transferInFlight = useRef(false);

  // Stany dla dni
  const [activeDayMenu, setActiveDayMenu] = useState<string | null>(null);
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  const [copyModeDay, setCopyModeDay] = useState<string | null>(null);
  const [selectedCopyDays, setSelectedCopyDays] = useState<string[]>([]);

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

  const days = planDays(baseDate);

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

  const resetSelectionModes = () => {
    setCopyModeMeal(null);
    setSelectedCopySlots([]);
    setCopyModeDay(null);
    setSelectedCopyDays([]);
    setMealSelectionAction('copy');
  };

  const closeSnackbar = useCallback(() => setSnackbar(null), []);

  const showSnackbar = (message: string, result?: TransferResult) => {
    setSnackbar(previous => ({ id: (previous?.id ?? 0) + 1, message, result }));
  };

  const visibleMeals: PlanMeal[] = userMeals.filter(meal => {
    const rid = entityId(meal.recipe);
    return !rid || recipes.some(r => r.id === rid);
  });

  const copyTransfer = (placements: Placement[]): PendingTransfer => ({
    placements,
    conflicts: findConflicts(visibleMeals, placements),
    removedSources: [],
    successKey: 'plan.snackbar.copied',
  });

  const moveTransfer = (meal: PlanMeal, targetSlot: string): PendingTransfer => {
    const placements = placeMealInSlots(meal, [targetSlot]);
    return {
      placements,
      conflicts: findConflicts(visibleMeals, placements, [meal]),
      removedSources: [meal],
      successKey: 'plan.snackbar.moved',
    };
  };

  const runTransfer = async (transfer: PendingTransfer, mode: ConflictMode) => {
    if (transferInFlight.current) return;
    transferInFlight.current = true;
    setTransferBusy(true);
    try {
      const conflicts = findConflicts(visibleMeals, transfer.placements, transfer.removedSources);
      const result = await transferMeals(transfer.placements, conflicts, mode, transfer.removedSources);
      showSnackbar(t(result.complete ? transfer.successKey : 'plan.snackbar.failed'), result);
    } catch (err) {
      console.error("Error transferring meals:", err);
      showSnackbar(t('plan.snackbar.failed'));
    }
    setPendingTransfer(null);
    resetSelectionModes();
    await refreshMeals();
    transferInFlight.current = false;
    setTransferBusy(false);
  };

  const startTransfer = (transfer: PendingTransfer) => {
    setActiveMealMenu(null);
    setActiveDayMenu(null);
    if (transfer.placements.length === 0) {
      resetSelectionModes();
      showSnackbar(t('plan.snackbar.emptyDay'));
    } else if (transfer.conflicts.length > 0) {
      setPendingTransfer(transfer);
    } else {
      runTransfer(transfer, 'append');
    }
  };

  const handleUndo = async (result: TransferResult) => {
    setSnackbar(null);
    try {
      await undoTransfer(result);
    } catch (err) {
      console.error("Error undoing meal transfer:", err);
      showSnackbar(t('plan.snackbar.failed'));
    }
    await refreshMeals();
  };

  const handleCopyToNextDay = (meal: PlanMeal) => {
    startTransfer(copyTransfer(placeMealInSlots(meal, [toSlotKey(addDaysToIsoDate(meal.meal_date, 1), meal.meal_type)])));
  };

  const handleCopyDayNext = (dateStr: string) => {
    startTransfer(copyTransfer(placeDayOnDates(visibleMeals, dateStr, [addDaysToIsoDate(dateStr, 1)])));
  };

  const handlePreSubmitCopyMode = () => {
    if (copyModeMeal && selectedCopySlots.length > 0) {
      startTransfer(mealSelectionAction === 'move'
        ? moveTransfer(copyModeMeal, selectedCopySlots[0])
        : copyTransfer(placeMealInSlots(copyModeMeal, selectedCopySlots)));
    } else if (copyModeDay && selectedCopyDays.length > 0) {
      startTransfer(copyTransfer(placeDayOnDates(visibleMeals, copyModeDay, selectedCopyDays)));
    }
  };

  const handleDeleteDay = async (dateStr: string) => {
    const mealsToDelete = mealsOfDay(visibleMeals, dateStr);
    setDayToDelete(null);
    const deletedIds = new Set(mealsToDelete.map(m => m.id));
    setUserMeals(prev => prev.filter(m => !deletedIds.has(m.id)));
    try {
      await deleteMeals(mealsToDelete);
    } catch (err) {
      console.error("Error deleting day meals:", err);
      showSnackbar(t('plan.snackbar.failed'));
    }
    await refreshMeals();
  };

  const requestDeleteDay = (dateStr: string) => {
    setActiveDayMenu(null);
    if (mealsOfDay(visibleMeals, dateStr).length === 0) {
      showSnackbar(t('plan.snackbar.emptyDay'));
      return;
    }
    setDayToDelete(dateStr);
  };

  const mealTitle = (meal: PlanMeal) => {
    const rid = entityId(meal.recipe);
    if (rid) return recipes.find(r => r.id === rid)?.name || '';
    const product = resolveMealProduct(meal, userMeals);
    if (product) return productDisplayName(product);
    return meal.manual_name || t('plan.quickMeal');
  };

  const toggleCopySlot = (slotKey: string) => {
    if (mealSelectionAction === 'move') {
      if (copyModeMeal && slotKey === toSlotKey(copyModeMeal.meal_date, copyModeMeal.meal_type)) return;
      setSelectedCopySlots(prev => prev.includes(slotKey) ? [] : [slotKey]);
      return;
    }
    setSelectedCopySlots(prev => prev.includes(slotKey) ? prev.filter(s => s !== slotKey) : [...prev, slotKey]);
  };

  const renderSlot = (date: string, mealType: string, isToday: boolean = false) => {
    const slotKey = toSlotKey(date, mealType);
    const isCopyMode = !!copyModeMeal || !!copyModeDay;
    const isSelected = !!copyModeMeal ? selectedCopySlots.includes(slotKey) : selectedCopyDays.includes(date);
    const copyLabel = mealSelectionAction === 'move' ? t('plan.move.slot') : t('plan.paste');

    const assignedMeals = userMeals.filter(m => m.meal_date === date && m.meal_type === mealType);

    const validMeals = assignedMeals.filter(m => {
      const rid = m.recipe?.id || m.recipe;
      return !rid || recipes.some(r => r.id === rid);
    });

    const onSlotClick = () => {
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
              const rid = assignedMeal.recipe?.id || assignedMeal.recipe;
              const pid = assignedMeal.product?.id || assignedMeal.product;

              if (rid) {
                const recipe = recipes.find(r => r.id === rid);
                if (!recipe) return <PlanCard key={assignedMeal.id} onClick={onSlotClick} isCopyMode={isCopyMode} copyLabel={copyLabel} isSelected={isSelected} disabled={!!copyModeDay} noWrap />;

                const mult = assignedMeal.portions_consumed || 1;
                return (
                  <RecipeCard
                    key={assignedMeal.id}
                    title={recipe.name}
                    kcal={String(Math.round(recipe.kcal * mult))}
                    macros={formatMacrosShort(recipe.protein * mult, recipe.fat * mult, recipe.carbs * mult)}
                    imgSrc={recipe.image_url || PLACEHOLDER_IMAGE}
                    imageFallbackSrc={DEFAULT_RECIPE_IMAGE_URL}
                    noWrap
                    onClick={() => {
                      if (!copyModeDay && !copyModeMeal) {
                        navigate(`/recipe/${recipe.id}?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
                      }
                    }}
                    onMenuClick={() => {
                      if (copyModeMeal) {
                        toggleCopySlot(slotKey);
                      } else {
                        setActiveMealMenu(assignedMeal);
                      }
                    }}
                    isCopyMode={isCopyMode}
                    isSelected={isSelected}
                    isProduct={false}
                  />
                );
              } else if (pid) {
                const product = resolveMealProduct(assignedMeal, userMeals);
                if (!product) return <PlanCard key={assignedMeal.id} onClick={onSlotClick} isCopyMode={isCopyMode} copyLabel={copyLabel} isSelected={isSelected} disabled={!!copyModeDay} noWrap />;

                const weight = assignedMeal.portions_consumed || 100;
                const factor = product.unit === 'pc' ? weight : (weight / 100);
                const kcal = Math.round(product.kcal * factor);
                const p = parseFloat((product.protein * factor).toFixed(1));
                const f = parseFloat((product.fat * factor).toFixed(1));
                const c = parseFloat((product.carbs * factor).toFixed(1));

                return (
                  <RecipeCard
                    key={assignedMeal.id}
                    title={productDisplayName(product)}
                    kcal={String(kcal)}
                    macros={formatMacrosShort(p, f, c)}
                    imgSrc={product.image_url || PLACEHOLDER_IMAGE}
                    noWrap
                    onClick={() => {
                      if (!copyModeDay && !copyModeMeal) {
                        navigate(`/product/${product.id}?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
                      }
                    }}
                    onMenuClick={() => {
                      if (copyModeMeal) {
                        toggleCopySlot(slotKey);
                      } else {
                        setActiveMealMenu(assignedMeal);
                      }
                    }}
                    isCopyMode={isCopyMode}
                    isSelected={isSelected}
                    isProduct={true}
                  />
                );
              } else {
                // Render manual entry
                return (
                  <RecipeCard
                    key={assignedMeal.id}
                    title={assignedMeal.manual_name || t('plan.quickMeal')}
                    kcal={String(assignedMeal.manual_kcal || 0)}
                    macros={formatMacrosShort(Number(assignedMeal.manual_protein || 0), Number(assignedMeal.manual_fat || 0), Number(assignedMeal.manual_carbs || 0))}
                    imgSrc={PLACEHOLDER_IMAGE}
                    noWrap
                    onClick={() => {
                      if (!copyModeDay && !copyModeMeal) {
                        navigate(`/add-food?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
                      }
                    }}
                    onMenuClick={() => {
                      if (copyModeMeal) {
                        toggleCopySlot(slotKey);
                      } else if (!copyModeDay) {
                        setActiveMealMenu(assignedMeal);
                      }
                    }}
                    isCopyMode={isCopyMode}
                    isSelected={isSelected}
                    isManual={true}
                  />
                );
              }
            })}

            {/* Przycisk dodaj kolejny posiłek (Przywrócony na dół) */}
            {!copyModeDay && !copyModeMeal && (
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
    return <PlanCard onClick={onSlotClick} isCopyMode={isCopyMode} copyLabel={copyLabel} isSelected={isSelected} disabled={!!copyModeDay} isToday={isToday} />;
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
      <main className="pt-[calc(4rem+env(safe-area-inset-top))] max-w-[600px] mx-auto pb-6 relative">
        {/* Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant/5 pt-safe max-w-[600px] mx-auto">
          <div className="h-12 flex items-center justify-between px-6">
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
                        if (isDayCopyMode && day.date !== copyModeDay) {
                          setSelectedCopyDays(prev => prev.includes(day.date) ? prev.filter(d => d !== day.date) : [...prev, day.date]);
                        }
                      }}
                      className={`w-full max-w-[130px] bg-surface-container-lowest rounded-3xl p-2.5 sm:p-3 shadow-ambient flex flex-col gap-2 relative transition-all duration-300 ${day.isToday ? 'ring-2 ring-[#ff9800] bg-[#ff9800]/[0.04] shadow-lg shadow-[#ff9800]/10' : ''} ${!day.active ? 'opacity-80 scale-[0.98]' : ''} ${copyModeMeal ? 'opacity-40 grayscale-[30%]' : ''} ${isDayCopyMode ? 'cursor-pointer hover:bg-primary/5 ring-inset' : ''} ${isSelectedCopyDay ? 'bg-primary/10 ring-2 ring-primary' : ''}`}
                    >
                      {!day.active && <div className="absolute inset-0 bg-surface/30 rounded-3xl pointer-events-none z-10 transition-all"></div>}

                      <div className="flex flex-col w-full">
                        <div className="flex justify-between items-center w-full">
                          <div className={`w-11 h-11 rounded-full text-[13px] font-headline font-extrabold flex items-center justify-center shadow-md transition-all duration-500 ${day.isToday ? 'bg-[#ff9800] text-white ring-4 ring-[#ff9800]/20' : (day.active ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary')}`}>
                            {formatDayMonth(day.date)}
                          </div>

                          {isDayCopyMode ? (
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
                            <span className={`text-[10px] font-extrabold ${profile && consumed.kcal > profile.target_kcal ? 'text-error' : 'text-primary'}`}>
                              {consumed.kcal}
                            </span>
                            <span className="mx-0.5 opacity-50">/</span>
                            {profile?.target_kcal || '···'}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden -mt-0.5 relative">
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000" style={{ width: profile && profile.target_kcal > 0 ? `${Math.min(100, (consumed.kcal / profile.target_kcal) * 100)}%` : '0%' }}></div>
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-1000" style={{ width: profile && profile.target_kcal > 0 ? `${Math.max(0, Math.min(100, ((consumed.kcal / profile.target_kcal) * 100) - 100))}%` : '0%' }}></div>
                        </div>

                        {/* Białko */}
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold shrink-0">Białka</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && consumed.protein > (profile.target_protein_max || profile.target_protein * 1.1) ? 'text-error' : 'text-primary'}`}>
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
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_protein_max || profile.target_protein * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((consumed.protein / (profile.target_protein_max || profile.target_protein * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>

                        {/* Tłuszcz */}
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold shrink-0">Tłuszcz</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && consumed.fat > (profile.target_fat_max || profile.target_fat * 1.1) ? 'text-error' : 'text-primary'}`}>
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
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_fat_max || profile.target_fat * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((consumed.fat / (profile.target_fat_max || profile.target_fat * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>

                        {/* Węglowodany */}
                        <div className="flex justify-between items-baseline leading-none gap-1">
                          <span className="text-primary uppercase tracking-normal text-[7px] font-bold shrink-0">Węgle</span>
                          <span className="text-[7px] text-on-surface-variant font-bold uppercase">
                            <span className={`text-[9px] font-extrabold ${profile && consumed.carbs > (profile.target_carbs_max || profile.target_carbs * 1.1) ? 'text-error' : 'text-primary'}`}>
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
                          <div className="absolute top-0 right-0 h-full bg-error rounded-full transition-all duration-1000" style={{ width: profile && (profile.target_carbs_max || profile.target_carbs * 1.1) > 0 ? `${Math.max(0, Math.min(100, ((consumed.carbs / (profile.target_carbs_max || profile.target_carbs * 1.1)) * 100) - 100))}%` : '0%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>

            {/* Dynamiczne rzędy posiłków na podstawie preferencji usera (kolejność i nazwy) */}
            {profileMealTypes(profile)
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
                      <div key={i} className="shrink-0" data-slot={toSlotKey(day.date, mt.id)}>
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
                <span className="font-bold text-sm">{t('plan.copyToNextDay')}</span>
              </button>

              <button onClick={() => { setCopyModeDay(activeDayMenu); setSelectedCopyDays([]); setActiveDayMenu(null); }} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">edit_calendar</span>
                <span className="font-bold text-sm">{t('plan.day.copyToOtherDays')}</span>
              </button>

              <div className="h-px w-full bg-outline-variant/20 my-2"></div>

              <button onClick={() => requestDeleteDay(activeDayMenu)} className="w-full py-4 px-5 bg-error/5 rounded-2xl flex items-center gap-4 hover:bg-error/10 transition-colors active:scale-95 text-error">
                <span className="material-symbols-outlined">delete_sweep</span>
                <span className="font-bold text-sm">{t('plan.day.delete')}</span>
              </button>
            </div>

            <button onClick={() => setActiveDayMenu(null)} className="w-full py-4 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-2xl transition-colors tracking-wide active:scale-95">
              {t('plan.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Tryb masowego kopiowania DNIA - Pływający pasek akcji */}
      {copyModeDay && (() => {
        const copyDay = days.find(d => d.date === copyModeDay);
        return (
          <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-[2rem] p-3 pl-5 flex items-center justify-between z-[200] animate-slide-up border border-outline-variant/30 overflow-hidden">

            <div className="flex items-center w-[55%] gap-2 overflow-hidden">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">event_repeat</span>
              </div>
              <div className="flex flex-col truncate w-full">
                <span className="font-bold text-xs text-on-surface truncate pr-2">{t('plan.day.copying')}</span>
                <span className="text-[10px] text-on-surface-variant font-medium truncate">Szablon: {copyDay ? formatDayWithMonthName(copyDay.name, copyDay.date) : ''}</span>
              </div>
            </div>

            <div className="flex gap-2 ml-2 flex-shrink-0">
              <button onClick={resetSelectionModes} className="px-3 py-2.5 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors text-xs active:scale-95">
                {t('plan.cancel')}
              </button>
              <button
                onClick={handlePreSubmitCopyMode}
                disabled={selectedCopyDays.length === 0 || transferBusy}
                className="px-4 py-2.5 font-bold text-on-primary bg-primary rounded-xl shadow-sm hover:bg-primary/90 transition-colors text-xs disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                {t('plan.pasteCount', { count: selectedCopyDays.length })}
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
                    navigate(`/recipe/${rid}?selectDate=${meal.meal_date}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  } else if (pid) {
                    navigate(`/product/${pid}?selectDate=${meal.meal_date}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  } else {
                    navigate(`/add-food?selectDate=${meal.meal_date}&selectType=${meal.meal_type}&mealId=${meal.id}`);
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
                <span className="font-bold text-sm">{t('plan.copyToNextDay')}</span>
              </button>

              <button onClick={() => { setCopyModeMeal(activeMealMenu); setMealSelectionAction('copy'); setSelectedCopySlots([]); setActiveMealMenu(null); }} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">edit_calendar</span>
                <span className="font-bold text-sm">{t('plan.meal.copyToOtherDays')}</span>
              </button>

              <button onClick={() => { setCopyModeMeal(activeMealMenu); setMealSelectionAction('move'); setSelectedCopySlots([]); setActiveMealMenu(null); }} className="w-full py-4 px-5 bg-surface-container-low rounded-2xl flex items-center gap-4 hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface">
                <span className="material-symbols-outlined text-primary">drive_file_move</span>
                <span className="font-bold text-sm">{t('plan.meal.moveTo')}</span>
              </button>

              <div className="h-px w-full bg-outline-variant/20 my-2"></div>

              <button onClick={() => { setMealToDelete(activeMealMenu); setActiveMealMenu(null); }} className="w-full py-4 px-5 bg-error/5 rounded-2xl flex items-center gap-4 hover:bg-error/10 transition-colors active:scale-95 text-error">
                <span className="material-symbols-outlined">delete</span>
                <span className="font-bold text-sm">Usuń posiłek</span>
              </button>
            </div>

            <button onClick={() => setActiveMealMenu(null)} className="w-full py-4 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-2xl transition-colors tracking-wide active:scale-95">
              {t('plan.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Tryb masowego kopiowania - Pływający pasek akcji */}
      {copyModeMeal && (() => {
        const rid = entityId(copyModeMeal.recipe);
        const copyRecipe = recipes.find(r => r.id === rid);
        const copyDay = days.find(d => d.date === copyModeMeal.meal_date);
        const isMove = mealSelectionAction === 'move';
        return (
          <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-[2rem] p-3 pl-4 flex items-center justify-between z-[200] animate-slide-up border border-outline-variant/30 overflow-hidden">

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
                <span className="font-bold text-xs text-on-surface truncate pr-2">{isMove ? `${t('plan.move.title')}: ${mealTitle(copyModeMeal)}` : (copyRecipe?.name || t('plan.copying'))}</span>
                <span className="text-[10px] text-on-surface-variant font-medium truncate">{isMove ? t('plan.move.hint') : t('plan.copyFrom', { day: copyDay ? formatDayWithMonthName(copyDay.name, copyDay.date) : '' })}</span>
              </div>
            </div>

            <div className="flex gap-2 ml-2 flex-shrink-0">
              <button onClick={resetSelectionModes} className="px-3 py-2.5 font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors text-xs active:scale-95">
                {t('plan.cancel')}
              </button>
              <button
                onClick={handlePreSubmitCopyMode}
                disabled={selectedCopySlots.length === 0 || transferBusy}
                className="px-4 py-2.5 font-bold text-on-primary bg-primary rounded-xl shadow-sm hover:bg-primary/90 transition-colors text-xs disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                {isMove ? t('plan.move.confirm') : t('plan.pasteCount', { count: selectedCopySlots.length })}
              </button>
            </div>
          </div>
        );
      })()}

      {pendingTransfer && (
        <PlanConflictDialog
          conflicts={pendingTransfer.conflicts.map(meal => ({
            id: meal.id,
            title: mealTitle(meal),
            detail: `${formatRelativeDayLabel(meal.meal_date)} • ${getMealTypeName(meal.meal_type, profile?.meal_config)}`,
          }))}
          busy={transferBusy}
          onOverwrite={() => runTransfer(pendingTransfer, 'overwrite')}
          onAppend={() => runTransfer(pendingTransfer, 'append')}
          onCancel={() => setPendingTransfer(null)}
        />
      )}

      {snackbar && (
        <UndoSnackbar
          key={snackbar.id}
          message={snackbar.message}
          onUndo={snackbar.result ? () => handleUndo(snackbar.result!) : undefined}
          onClose={closeSnackbar}
        />
      )}

      {/* Ostrzeżenie przed usunięciem jednego posiłku */}
      {mealToDelete && (() => {
        const rid = mealToDelete.recipe?.id || mealToDelete.recipe;
        const recipe = recipes.find(r => r.id === rid);
        const day = days.find(d => d.date === mealToDelete.meal_date);

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
                  <div className="w-5 h-5 bg-error text-on-error rounded-full flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[12px] font-bold">delete</span>
                  </div>
                </div>
              </div>

              <h3 className="font-headline font-bold text-lg text-on-surface mb-1">Usunąć {recipe?.name}?</h3>
              <p className="text-on-surface-variant text-xs mb-3">Zniknie z zaplanowanego menu:</p>

              <div className="flex flex-col items-center gap-1.5 bg-error/5 border border-error/10 rounded-2xl p-3 mb-6 w-full">
                <span className="text-error font-bold text-xs">
                  {day ? formatDayWithMonthName(day.name, day.date) : ''}
                </span>
                <div className="bg-error/10 px-2 py-0.5 rounded-md text-error font-bold text-[10px] tracking-wide uppercase">
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
                  className="flex-1 py-3 text-sm font-bold text-on-error bg-error rounded-xl shadow-sm hover:bg-error/90 transition-colors active:scale-95"
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
        const count = mealsOfDay(visibleMeals, dayToDelete).length;
        const weekday = parseIsoDate(dayToDelete)?.getDay() ?? 0;
        return (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in pointer-events-none">
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-day-title" aria-describedby="delete-day-description" className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center pointer-events-auto flex flex-col items-center">
              <div className="w-14 h-14 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">delete_sweep</span>
              </div>
              <h3 id="delete-day-title" className="font-headline font-bold text-lg text-on-surface mb-1">
                {t(`plan.deleteDay.${pluralForm(count)}`, { count, day: t(`plan.weekdayGenitive.${weekday}` as MessageKey) })}
              </h3>
              <p id="delete-day-description" className="text-on-surface-variant text-xs mb-6">{formatRelativeDayLabel(dayToDelete)}. {t('plan.deleteDay.description')}</p>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setDayToDelete(null)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
                >
                  {t('plan.cancel')}
                </button>
                <button
                  onClick={() => handleDeleteDay(dayToDelete)}
                  className="flex-[1.5] py-3 text-sm font-bold text-on-error bg-error rounded-xl shadow-sm hover:bg-error/90 transition-colors active:scale-95"
                >
                  {t('plan.deleteDay.confirm')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function RecipeCard({ title, kcal, macros, imgSrc, imageFallbackSrc, onMenuClick, onClick, isCopyMode, isSelected, noWrap, isProduct, isManual }: { title: string, kcal: string, macros: string, imgSrc: string, imageFallbackSrc?: string, onMenuClick: () => void, onClick?: () => void, isCopyMode?: boolean, isSelected?: boolean, noWrap?: boolean, isProduct?: boolean, isManual?: boolean }) {

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

  const imageUrlsKey = imageUrls.join('|');
  const [failedImages, setFailedImages] = useState({ key: imageUrlsKey, count: 0 });
  const imageUrlIdx = failedImages.key === imageUrlsKey ? failedImages.count : 0;

  const renderImage = () => {
    if (imageUrlIdx < imageUrls.length) {
      return (
        <img
          src={imageUrls[imageUrlIdx]}
          alt={title}
          onError={() => setFailedImages({ key: imageUrlsKey, count: imageUrlIdx + 1 })}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isCopyMode && !isSelected ? 'grayscale opacity-70' : 'group-hover:scale-105'}`}
        />
      );
    }
    return (
      <div className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-1.5 transition-all ${isManual ? 'bg-orange-50 group-hover:bg-orange-100 dark:bg-orange-500/10 dark:group-hover:bg-orange-500/20' : isProduct ? 'bg-primary/[0.03] group-hover:bg-primary/[0.06]' : 'bg-[#f1f6ed] group-hover:bg-[#e8f1e2] dark:bg-[#6B8E23]/10 dark:group-hover:bg-[#6B8E23]/20'}`}>
        <div className={`${isManual ? 'w-7 h-7' : 'w-10 h-10'} rounded-full flex items-center justify-center shadow-inner ${isManual ? 'bg-orange-100/50 text-orange-500 dark:bg-orange-500/20' : isProduct ? 'bg-primary/10 text-primary' : 'bg-white/50 text-[#6B8E23] dark:bg-white/10'}`}>
          <span className={`material-symbols-outlined ${isManual ? 'text-sm' : 'text-xl'} opacity-80`}>
            {isManual ? 'bolt' : isProduct ? 'nutrition' : 'photo_camera'}
          </span>
        </div>
      </div>
    );
  };

  const content = (
    <div onClick={isCopyMode ? onMenuClick : onClick} className={`w-full max-w-[130px] flex flex-col gap-1.5 group relative transition-all duration-300 ${isCopyMode || onClick ? 'cursor-pointer hover:scale-105' : ''}`}>

      <div className={`${isManual ? 'h-[85px]' : 'h-[120px] sm:h-[135px]'} w-full rounded-2xl overflow-hidden bg-surface-container-lowest relative shadow-sm border transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-outline-variant/10'}`}>
        {renderImage()}

        <div className={`absolute ${isManual ? 'bottom-1.5 left-1.5' : 'bottom-2 left-2'} z-10 bg-surface/90 backdrop-blur-xl px-1.5 h-[14px] flex items-center justify-center gap-0.5 rounded-md shadow-sm`}>
          <span className="text-[9px] font-bold text-primary tracking-wide leading-none translate-y-[0.5px]">{kcal} kcal</span>
        </div>

        {isCopyMode ? (
          <div className={`absolute ${isManual ? 'top-1.5 right-1.5' : 'top-2 right-2'} w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-primary border-primary text-on-primary' : 'bg-surface/50 backdrop-blur-md border-white/80 text-transparent'}`}>
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

function PlanCard({ onClick, isCopyMode, copyLabel, isSelected, disabled, isToday, noWrap }: { onClick: () => void, isCopyMode?: boolean, copyLabel: string, isSelected?: boolean, disabled?: boolean, isToday?: boolean, noWrap?: boolean }) {
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
        <span className="text-primary/70 text-[9px] font-bold tracking-widest uppercase">{copyLabel}</span>
      )}
    </div>
  );

  if (noWrap) return content;
  return <div className={CARD_WRAPPER}>{content}</div>;
}
