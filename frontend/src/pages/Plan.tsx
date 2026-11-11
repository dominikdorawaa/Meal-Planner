import { BottomNav } from '../components/BottomNav';
import { useCallback, useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { productDisplayName } from '../lib/productName';
import { resolveMealProduct } from '../lib/mealProducts';
import { useNavigate } from 'react-router-dom';
import { formatCompactNumber } from '../lib/compactNumber';
import { DaySummary } from '../components/DaySummary';
import { PlanWeekStrip, SHOWN_DAYS } from '../components/PlanWeekStrip';
import { isDayGoalMet } from '../lib/daySummary';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { recipeCoverImage, type RecipeImage } from '../lib/recipeImage';
import { mealTypeName, profileMealTypes } from '../lib/mealTypes';
import { addDaysToIsoDate, daysBetweenIsoDates, formatDayMonth, formatDayWithMonthName, formatLocalizedDayWithDate, formatRelativeDayLabel, formatShortWeekday, parseIsoDate, planDays, toIsoDate, todayIsoDate } from '../lib/planDates';
import { readPlanReturnPosition, rememberPlanReturnPosition, type PlanReturnPosition } from '../lib/planPosition';
import { PlanConflictDialog } from '../components/PlanConflictDialog';
import { PlanDayDeleteSheet } from '../components/PlanDayDeleteSheet';
import { useCloseOnBack } from '../lib/backNavigation';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { PlanAction, PlanActionGroup, PlanActionSheet, PlanSheetDayBadge, PlanSheetThumb } from '../components/PlanActionSheet';
import { t, type MessageKey } from '../i18n';
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

type Snackbar = { id: number; message: string; result?: TransferResult; durationMs?: number };

const DELETED_MEAL_SNACKBAR_DURATION_MS = 3000;

const PLACEHOLDER_IMAGE = "PLAN_PLACEHOLDER_TOKEN";

const DAY_COLUMN = "w-[33.3333vw] sm:w-[150px] shrink-0 px-2 sm:px-3";
const MEAL_COLORS = ["#f2b84b", "#7fc77a", "#a78bfa", "#60a5fa", "#f472b6", "#2dd4bf"];
const TODAY_BAND_INSET_PX = 3;
const WINDOW_DAYS = 21;
const LEAD_DAYS = 7;
const VISIBLE_DAYS = 3;
const SCROLL_SETTLE_MS = 150;

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const shiftDate = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const windowAround = (date: Date) => shiftDate(date, -LEAD_DAYS);

const stripWeekWith = (stripStart: string, date: string) => {
  const weeks = Math.floor(daysBetweenIsoDates(stripStart, date) / SHOWN_DAYS);
  return weeks === 0 ? stripStart : addDaysToIsoDate(stripStart, weeks * SHOWN_DAYS);
};

const returnPositionAt = (start: Date, index: number, stripStart?: string): PlanReturnPosition => {
  let shift = 0;
  if (index < LEAD_DAYS) shift = -LEAD_DAYS;
  else if (index >= WINDOW_DAYS - LEAD_DAYS) shift = LEAD_DAYS;
  return { startDate: toIsoDate(shiftDate(start, shift)), visibleIndex: index - shift, stripStart };
};

export function Plan() {
  const navigate = useNavigate();
  const { recipes, profile, profileStatus, userMeals, setUserMeals, loading: contextLoading, refreshMeals, getConsumedForDay, reload } = useAppData();
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

  const [returnPosition] = useState(readPlanReturnPosition);
  const [baseDate, setBaseDate] = useState<Date>(() => parseIsoDate(returnPosition?.startDate) ?? windowAround(startOfToday()));
  const [initialVisible] = useState(() => (returnPosition ? Math.min(returnPosition.visibleIndex, WINDOW_DAYS - VISIBLE_DAYS) : LEAD_DAYS));
  const [firstVisible, setFirstVisible] = useState(initialVisible);
  const [settledVisible, setSettledVisible] = useState(initialVisible);
  const [stripStart, setStripStart] = useState(() => returnPosition?.stripStart ?? toIsoDate(shiftDate(baseDate, initialVisible)));
  const shownPlace = useRef({ baseDate, firstVisible, stripStart });
  const pendingScrollIndex = useRef<number | null>(initialVisible);
  const settleTimer = useRef(0);

  const days = planDays(baseDate, WINDOW_DAYS);
  const todayIndex = days.findIndex(day => day.isToday);
  const settledDate = days[settledVisible]?.date ?? toIsoDate(baseDate);
  const [followedDate, setFollowedDate] = useState(settledDate);
  if (followedDate !== settledDate) {
    setFollowedDate(settledDate);
    setStripStart(stripWeekWith(stripStart, settledDate));
  }
  const planReady = !contextLoading && profileStatus === 'ready';

  const columnWidth = () => (scrollRef.current?.querySelector('[data-day-column]') as HTMLElement | null)?.offsetWidth ?? 0;

  const scrollToDay = (index: number, smooth: boolean) => {
    const scroller = scrollRef.current;
    const left = index * columnWidth();
    setFirstVisible(index);
    if (!scroller) return;
    if (smooth && typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ left, behavior: 'smooth' });
      return;
    }
    setSettledVisible(index);
    scroller.classList.remove('scroll-smooth');
    scroller.scrollLeft = left;
    requestAnimationFrame(() => scroller.classList.add('scroll-smooth'));
  };

  const showWindow = (start: Date, index: number) => {
    pendingScrollIndex.current = index;
    setFirstVisible(index);
    setSettledVisible(index);
    setBaseDate(start);
  };

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const index = pendingScrollIndex.current;
    if (!scroller || index === null) return;
    pendingScrollIndex.current = null;
    const width = (scroller.querySelector('[data-day-column]') as HTMLElement | null)?.offsetWidth ?? 0;
    scroller.classList.remove('scroll-smooth');
    scroller.scrollLeft = index * width;
    requestAnimationFrame(() => scroller.classList.add('scroll-smooth'));
  }, [baseDate, planReady]);

  useEffect(() => {
    shownPlace.current = { baseDate, firstVisible, stripStart };
  }, [baseDate, firstVisible, stripStart]);

  useEffect(() => {
    const rememberShownPlace = () => {
      const { baseDate: start, firstVisible: index, stripStart: shownStripStart } = shownPlace.current;
      rememberPlanReturnPosition(returnPositionAt(start, index, shownStripStart));
    };
    window.addEventListener('pagehide', rememberShownPlace);
    return () => {
      window.removeEventListener('pagehide', rememberShownPlace);
      rememberShownPlace();
    };
  }, []);

  const handlePlanScroll = () => {
    const scroller = scrollRef.current;
    const width = columnWidth();
    if (!scroller || !width) return;
    const index = Math.round(scroller.scrollLeft / width);
    setFirstVisible(index);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (index < LEAD_DAYS) showWindow(shiftDate(baseDate, -LEAD_DAYS), index + LEAD_DAYS);
      else if (index >= WINDOW_DAYS - LEAD_DAYS) showWindow(shiftDate(baseDate, LEAD_DAYS), index - LEAD_DAYS);
      else setSettledVisible(index);
    }, SCROLL_SETTLE_MS);
  };

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const selectStripDay = (date: string) => {
    const index = daysBetweenIsoDates(toIsoDate(baseDate), date);
    if (index >= 0 && index < WINDOW_DAYS) scrollToDay(Math.min(WINDOW_DAYS - VISIBLE_DAYS, index), true);
    else showWindow(windowAround(parseIsoDate(date) ?? startOfToday()), LEAD_DAYS);
  };

  const swipeStripWeek = (weeks: 1 | -1) => setStripStart(current => addDaysToIsoDate(current, weeks * SHOWN_DAYS));

  const isStripDayGoalMet = (date: string) => isDayGoalMet(getConsumedForDay(date), profile);

  const todayVisible = todayIndex >= firstVisible && todayIndex < firstVisible + VISIBLE_DAYS;

  const handleGoToToday = () => {
    setStripStart(todayIsoDate());
    if (todayIndex >= 0) scrollToDay(todayIndex, true);
    else showWindow(windowAround(startOfToday()), LEAD_DAYS);
  };


  useEffect(() => {
    let shownDay = todayIsoDate();
    let midnightTimer = 0;
    const showTodayAfterDayChange = () => {
      if (todayIsoDate() === shownDay) return;
      shownDay = todayIsoDate();
      setStripStart(shownDay);
      showWindow(windowAround(startOfToday()), LEAD_DAYS);
    };
    const showTodayWhenVisible = () => {
      if (document.visibilityState === 'visible') showTodayAfterDayChange();
    };
    const scheduleMidnightCheck = () => {
      const nextDay = startOfToday();
      nextDay.setDate(nextDay.getDate() + 1);
      midnightTimer = window.setTimeout(() => {
        showTodayAfterDayChange();
        scheduleMidnightCheck();
      }, nextDay.getTime() - Date.now() + 1000);
    };
    scheduleMidnightCheck();
    document.addEventListener('visibilitychange', showTodayWhenVisible);
    window.addEventListener('focus', showTodayWhenVisible);
    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', showTodayWhenVisible);
      window.removeEventListener('focus', showTodayWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!contextLoading && profileStatus === 'needsOnboarding') navigate('/onboarding');
  }, [contextLoading, profileStatus, navigate]);

  useEffect(() => {
    refreshMeals();
  }, []);

  const handleDeleteMeal = async (meal: PlanMeal) => {
    setActiveMealMenu(null);
    setUserMeals(prev => prev.filter(m => m.id !== meal.id));
    try {
      await api.meals.delete(meal.id);
    } catch (err) {
      console.error("Error deleting meal:", err);
      showSnackbar(t('plan.snackbar.failed'));
      await refreshMeals();
      return;
    }
    await refreshMeals();
    showSnackbar(t('plan.snackbar.deleted'), { created: [], removed: [meal], complete: true }, DELETED_MEAL_SNACKBAR_DURATION_MS);
  };

  const resetSelectionModes = () => {
    setCopyModeMeal(null);
    setSelectedCopySlots([]);
    setCopyModeDay(null);
    setSelectedCopyDays([]);
    setMealSelectionAction('copy');
  };

  useCloseOnBack(!!copyModeDay || !!copyModeMeal, resetSelectionModes);
  useCloseOnBack(!!pendingTransfer, () => setPendingTransfer(null));

  const closeSnackbar = useCallback(() => setSnackbar(null), []);

  const showSnackbar = (message: string, result?: TransferResult, durationMs?: number) => {
    setSnackbar(previous => ({ id: (previous?.id ?? 0) + 1, message, result, durationMs }));
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

  const dayDeleteItems = (dateStr: string) => {
    const mealTypes = profileMealTypes(profile);
    const order = (meal: PlanMeal) => {
      const index = mealTypes.findIndex(type => type.id === meal.meal_type);
      return index === -1 ? mealTypes.length : index;
    };
    return mealsOfDay(visibleMeals, dateStr)
      .sort((first, second) => order(first) - order(second))
      .map(meal => ({ id: meal.id, title: mealTitle(meal), detail: mealTypeName(meal.meal_type, mealTypes) }));
  };

  const handleDeleteDay = async (dateStr: string, ids: string[]) => {
    const selectedIds = new Set(ids);
    const mealsToDelete = mealsOfDay(visibleMeals, dateStr).filter(meal => selectedIds.has(meal.id));
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

    const validMeals = userMeals.filter(m => m.meal_date === date && m.meal_type === mealType).filter(m => {
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

    const onCardMenu = (meal: PlanMeal) => {
      if (copyModeMeal) toggleCopySlot(slotKey);
      else if (!copyModeDay) setActiveMealMenu(meal);
    };

    const cards = validMeals.map(assignedMeal => {
      const rid = assignedMeal.recipe?.id || assignedMeal.recipe;
      const pid = assignedMeal.product?.id || assignedMeal.product;
      const shared = {
        isCopyMode,
        isSelected,
        onMenuClick: () => onCardMenu(assignedMeal),
      };

      if (rid) {
        const recipe = recipes.find(r => r.id === rid)!;
        const mult = assignedMeal.portions_consumed || 1;
        return (
          <RecipeCard
            key={assignedMeal.id}
            {...shared}
            title={recipe.name}
            kcal={formatCompactNumber(recipe.kcal * mult)}
            imgSrc={PLACEHOLDER_IMAGE}
            recipeImage={recipeCoverImage(recipe)}
            isRecipe
            onClick={() => {
              if (!copyModeDay && !copyModeMeal) navigate(`/recipe/${recipe.id}?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
            }}
          />
        );
      }
      if (pid) {
        const product = resolveMealProduct(assignedMeal, userMeals);
        if (!product) return null;
        const weight = assignedMeal.portions_consumed || 100;
        const factor = product.unit === 'pc' ? weight : (weight / 100);
        return (
          <RecipeCard
            key={assignedMeal.id}
            {...shared}
            title={productDisplayName(product)}
            kcal={formatCompactNumber(Math.round(product.kcal * factor))}
            imgSrc={product.image_url || PLACEHOLDER_IMAGE}
            isProduct
            onClick={() => {
              if (!copyModeDay && !copyModeMeal) navigate(`/product/${product.id}?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
            }}
          />
        );
      }
      return (
        <RecipeCard
          key={assignedMeal.id}
          {...shared}
          title={assignedMeal.manual_name || t('plan.quickMeal')}
          kcal={formatCompactNumber(Number(assignedMeal.manual_kcal) || 0)}
          imgSrc={PLACEHOLDER_IMAGE}
          isManual
          onClick={() => {
            if (!copyModeDay && !copyModeMeal) navigate(`/add-food?selectDate=${date}&selectType=${mealType}&mealId=${assignedMeal.id}`);
          }}
        />
      );
    });

    return (
      <>
        {cards}
        <AddField
          label={validMeals.length > 0 ? t('plan.addMore') : t('plan.add')}
          onClick={onSlotClick}
          isToday={isToday}
          isCopyMode={!!copyModeMeal}
          copyLabel={copyLabel}
          isSelected={!!copyModeMeal && isSelected}
          disabled={!!copyModeDay}
        />
      </>
    );
  };

  if (!contextLoading && profileStatus === 'failed') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-error text-3xl">cloud_off</span>
        </div>
        <h1 className="font-headline text-lg font-bold text-on-surface mb-2">{t('plan.profileLoadFailed.title')}</h1>
        <p className="text-sm text-on-surface-variant mb-6 max-w-xs">{t('plan.profileLoadFailed.description')}</p>
        <button
          type="button"
          onClick={reload}
          className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all"
        >
          {t('plan.profileLoadFailed.retry')}
        </button>
      </div>
    );
  }

  if (contextLoading || profileStatus !== 'ready') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
        </div>
        <p className="text-primary font-bold tracking-widest uppercase text-xs animate-pulse">{t('plan.preparingProfile')}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen">
      <main className="pt-[calc(7rem+env(safe-area-inset-top))] max-w-[600px] mx-auto pb-bottom-nav relative">
        <div className="fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/5 pt-safe max-w-[600px] mx-auto">
          <PlanWeekStrip
            start={stripStart}
            today={todayIsoDate()}
            visibleStart={days[firstVisible]?.date ?? settledDate}
            visibleCount={VISIBLE_DAYS}
            isGoalMet={isStripDayGoalMet}
            onSwipeWeek={swipeStripWeek}
            onSelectDay={selectStripDay}
          />
        </div>
        <div ref={scrollRef} onScroll={handlePlanScroll} className="w-full overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory scroll-smooth">
          <div className="w-max flex flex-col pb-6 relative [--plan-column:33.3333vw] sm:[--plan-column:150px]">
            {todayIndex >= 0 && (
              <div
                aria-hidden="true"
                data-today-band
                className="absolute top-2 bottom-2 rounded-[22px] bg-gradient-to-b from-today/[0.11] via-today/[0.05] via-30% to-today/[0.035] pointer-events-none"
                style={{ left: `calc(${todayIndex} * var(--plan-column) + ${TODAY_BAND_INSET_PX}px)`, width: `calc(var(--plan-column) - ${TODAY_BAND_INSET_PX * 2}px)` }}
              />
            )}

            <section className="flex relative pt-2 pb-3 border-b border-outline-variant/10">
              {days.map(day => {
                const isDayCopyMode = !!copyModeDay;
                const isSelectedCopyDay = selectedCopyDays.includes(day.date);
                const dayLabel = `${day.name}, ${formatDayMonth(day.date)}`;
                const locale = t('recipeDetails.locale');
                const dayNumber = parseIsoDate(day.date)?.getDate();
                const weekdayLabel = day.isToday ? t('plan.today') : `${formatShortWeekday(day.date, locale)} ${dayNumber}`;

                return (
                  <div key={day.date} data-day-column data-day={day.date} className={`${DAY_COLUMN} snap-start`}>
                    <div
                      onClick={() => {
                        if (isDayCopyMode && day.date !== copyModeDay) {
                          setSelectedCopyDays(prev => prev.includes(day.date) ? prev.filter(d => d !== day.date) : [...prev, day.date]);
                        }
                      }}
                      className={`flex flex-col gap-1 rounded-[22px] -mx-2 px-2.5 py-2.5 transition-all duration-300 has-[[aria-expanded=true]]:bg-surface-container-lowest ${isSelectedCopyDay ? 'bg-primary/10 ring-2 ring-primary' : ''} ${copyModeMeal ? 'opacity-40 grayscale-[30%]' : ''} ${isDayCopyMode ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                    >
                      <div className="relative min-h-9 flex items-center">
                        <span className={`pr-5 font-headline text-[12.5px] font-extrabold leading-tight truncate ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>{weekdayLabel}</span>
                        {isDayCopyMode ? (
                          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 border ${isSelectedCopyDay ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline-variant/40 text-transparent hover:border-primary/50'}`}>
                            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                          </div>
                        ) : !copyModeMeal ? (
                          <button
                            type="button"
                            aria-label={t('plan.dayMenu', { day: dayLabel })}
                            onClick={(e) => { e.stopPropagation(); setActiveDayMenu(day.date); }}
                            className="group/day-menu absolute -right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
                          >
                            <span className="w-8 h-8 rounded-full flex items-center justify-center group-hover/day-menu:bg-surface-container-highest transition-colors">
                              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                            </span>
                          </button>
                        ) : null}
                      </div>
                      <DaySummary consumed={getConsumedForDay(day.date)} targets={profile} dayLabel={dayLabel} interactive={!isDayCopyMode && !copyModeMeal} />
                    </div>
                  </div>
                );
              })}
            </section>

            {profileMealTypes(profile)
              .filter(mt => mt.visible)
              .map((mt, mealIndex) => {
                const mealColor = MEAL_COLORS[mealIndex % MEAL_COLORS.length];
                return (
                <div key={mt.id} className="flex flex-col relative">
                  <div className="h-14 flex items-end pb-3">
                    <h2 className="sticky left-0 w-screen max-w-[600px] pl-4 pr-4 flex items-center gap-2.5 font-headline font-extrabold text-[15px] text-on-surface tracking-tight">
                      <span
                        aria-hidden="true"
                        data-meal-dot
                        className="w-[9px] h-[9px] rounded-full shrink-0"
                        style={{ backgroundColor: mealColor, boxShadow: `0 0 0 3px ${mealColor}38` }}
                      />
                      {mt.name}
                    </h2>
                  </div>
                  <section className="flex">
                    {days.map(day => (
                      <div key={day.date} className={`${DAY_COLUMN} flex flex-col gap-2.5`} data-slot={toSlotKey(day.date, mt.id)}>
                        {renderSlot(day.date, mt.id, day.isToday)}
                      </div>
                    ))}
                  </section>
                </div>
                );
              })}
          </div>
        </div>
        {!todayVisible && !copyModeDay && !copyModeMeal && (
          <button
            type="button"
            onClick={handleGoToToday}
            aria-label={t('plan.goToToday')}
            className="fixed z-40 right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] h-10 px-4 rounded-full bg-primary text-on-primary font-bold text-sm shadow-ambient flex items-center gap-1.5 active:scale-95 transition-transform animate-fade-in"
          >
            <span className="material-symbols-outlined text-[18px]">today</span>
            {t('plan.today')}
          </button>
        )}
      </main>

      {/* Wybór przepisu przeniesiony do zakładki /recipes */}

      <BottomNav />

      {activeDayMenu && (
        <PlanActionSheet
          label="Zarządzaj całym dniem"
          title="Zarządzaj całym dniem"
          meta={<span className="truncate">{formatLocalizedDayWithDate(activeDayMenu, t('recipeDetails.locale'), { yesterday: t('planTarget.yesterday'), today: t('planTarget.today'), tomorrow: t('planTarget.tomorrow') })} · <span className="font-semibold text-primary tabular-nums">{formatCompactNumber(getConsumedForDay(activeDayMenu).kcal)} kcal</span></span>}
          leading={<PlanSheetDayBadge day={parseIsoDate(activeDayMenu)?.getDate() ?? 0} weekday={formatShortWeekday(activeDayMenu, t('recipeDetails.locale'))} isToday={activeDayMenu === todayIsoDate()} />}
          onClose={() => setActiveDayMenu(null)}
        >
          <PlanActionGroup>
            <PlanAction icon="event_upcoming" label={t('plan.copyToNextDay')} onClick={() => handleCopyDayNext(activeDayMenu)} />
            <PlanAction icon="edit_calendar" label={t('plan.day.copyToOtherDays')} onClick={() => { setCopyModeDay(activeDayMenu); setSelectedCopyDays([]); setActiveDayMenu(null); }} />
          </PlanActionGroup>
          <PlanActionGroup>
            <PlanAction icon="delete_sweep" label={t('plan.day.delete')} onClick={() => requestDeleteDay(activeDayMenu)} danger />
          </PlanActionGroup>
        </PlanActionSheet>
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

      {activeMealMenu && (() => {
        const meal: PlanMeal = activeMealMenu;
        const mealTypes = profileMealTypes(profile);
        const mealIndex = mealTypes.filter(type => type.visible).findIndex(type => type.id === meal.meal_type);
        const mealColor = MEAL_COLORS[Math.max(mealIndex, 0) % MEAL_COLORS.length];
        const mealKcal = getConsumedForDay(meal.meal_date).kcal - getConsumedForDay(meal.meal_date, meal.id).kcal;
        const recipeId = entityId(meal.recipe);
        const recipe = recipeId ? recipes.find(r => r.id === recipeId) : undefined;
        const product = recipeId ? null : resolveMealProduct(meal, userMeals);
        return (
          <PlanActionSheet
            label="Zarządzaj posiłkiem"
            title={mealTitle(meal)}
            meta={(
              <>
                <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: mealColor, boxShadow: `0 0 0 3px ${mealColor}38` }} />
                <span className="truncate">{mealTypeName(meal.meal_type, mealTypes)} · {formatShortWeekday(meal.meal_date, t('recipeDetails.locale'))} {formatDayMonth(meal.meal_date)} · <span className="font-semibold text-primary tabular-nums">{formatCompactNumber(mealKcal)} kcal</span></span>
              </>
            )}
            leading={<PlanSheetThumb kind={recipe ? 'recipe' : product ? 'product' : 'manual'} recipeImage={recipeCoverImage(recipe)} imageUrl={product?.image_url} alt={mealTitle(meal)} />}
            onClose={() => setActiveMealMenu(null)}
          >
            <PlanActionGroup>
              <PlanAction
                icon="edit"
                label="Edytuj posiłek"
                onClick={() => {
                  const rid = recipeId;
                  const pid = entityId(meal.product);
                  if (rid) {
                    navigate(`/recipe/${rid}?selectDate=${meal.meal_date}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  } else if (pid) {
                    navigate(`/product/${pid}?selectDate=${meal.meal_date}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  } else {
                    navigate(`/add-food?selectDate=${meal.meal_date}&selectType=${meal.meal_type}&mealId=${meal.id}`);
                  }
                  setActiveMealMenu(null);
                }}
              />
            </PlanActionGroup>
            <PlanActionGroup>
              <PlanAction icon="event_upcoming" label={t('plan.copyToNextDay')} onClick={() => handleCopyToNextDay(meal)} />
              <PlanAction icon="edit_calendar" label={t('plan.meal.copyToOtherDays')} onClick={() => { setCopyModeMeal(meal); setMealSelectionAction('copy'); setSelectedCopySlots([]); setActiveMealMenu(null); }} />
              <PlanAction icon="drive_file_move" label={t('plan.meal.moveTo')} onClick={() => { setCopyModeMeal(meal); setMealSelectionAction('move'); setSelectedCopySlots([]); setActiveMealMenu(null); }} />
            </PlanActionGroup>
            <PlanActionGroup>
              <PlanAction icon="delete" label="Usuń posiłek" onClick={() => handleDeleteMeal(meal)} danger />
            </PlanActionGroup>
          </PlanActionSheet>
        );
      })()}

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
                    image={recipeCoverImage(copyRecipe)}
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
            detail: `${formatRelativeDayLabel(meal.meal_date)} • ${mealTypeName(meal.meal_type, profileMealTypes(profile))}`,
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
          durationMs={snackbar.durationMs}
        />
      )}

      {dayToDelete && (
        <PlanDayDeleteSheet
          dayLabel={formatLocalizedDayWithDate(dayToDelete, t('recipeDetails.locale'), { yesterday: t('planTarget.yesterday'), today: t('planTarget.today'), tomorrow: t('planTarget.tomorrow') })}
          items={dayDeleteItems(dayToDelete)}
          onConfirm={ids => handleDeleteDay(dayToDelete, ids)}
          onCancel={() => setDayToDelete(null)}
        />
      )}
    </div>
  );
}

function RecipeCard({ title, kcal, imgSrc, recipeImage = null, isRecipe, onMenuClick, onClick, isCopyMode, isSelected, isProduct, isManual }: { title: string, kcal: string, imgSrc: string, recipeImage?: RecipeImage | null, isRecipe?: boolean, onMenuClick: () => void, onClick?: () => void, isCopyMode?: boolean, isSelected?: boolean, isProduct?: boolean, isManual?: boolean }) {
  const primaryImageUrl = imgSrc && !imgSrc.includes('PLAN_PLACEHOLDER_TOKEN') ? imgSrc : null;
  const imageUrls = useMemo(() => (primaryImageUrl ? [primaryImageUrl] : []), [primaryImageUrl]);

  const imageUrlsKey = imageUrls.join('|');
  const [failedImages, setFailedImages] = useState({ key: imageUrlsKey, count: 0 });
  const imageUrlIdx = failedImages.key === imageUrlsKey ? failedImages.count : 0;

  const imageClassName = `absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isCopyMode && !isSelected ? 'grayscale opacity-70' : 'group-hover:scale-105'}`;

  const renderImage = () => {
    if (isRecipe) {
      return (
        <RecipeCoverImage
          image={recipeImage}
          alt={title}
          className="absolute inset-0 w-full h-full"
          imgClassName={imageClassName}
        />
      );
    }
    if (imageUrlIdx < imageUrls.length) {
      return (
        <img
          src={imageUrls[imageUrlIdx]}
          alt={title}
          onError={() => setFailedImages({ key: imageUrlsKey, count: imageUrlIdx + 1 })}
          className={imageClassName}
        />
      );
    }
    return (
      <div className={`absolute inset-0 w-full h-full flex items-center justify-center transition-all ${isManual ? 'bg-orange-50 group-hover:bg-orange-100 dark:bg-orange-500/10 dark:group-hover:bg-orange-500/20' : isProduct ? 'bg-primary/[0.03] group-hover:bg-primary/[0.06]' : 'bg-[#f1f6ed] group-hover:bg-[#e8f1e2] dark:bg-[#6B8E23]/10 dark:group-hover:bg-[#6B8E23]/20'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${isManual ? 'bg-orange-100/50 text-orange-500 dark:bg-orange-500/20' : isProduct ? 'bg-primary/10 text-primary' : 'bg-white/50 text-[#6B8E23] dark:bg-white/10'}`}>
          <span className="material-symbols-outlined text-xl opacity-80">
            {isManual ? 'bolt' : isProduct ? 'nutrition' : 'photo_camera'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div onClick={isCopyMode ? onMenuClick : onClick} className={`w-full flex flex-col gap-1.5 group relative transition-all duration-300 ${isCopyMode || onClick ? 'cursor-pointer' : ''}`}>
      <div className={`aspect-square w-full rounded-2xl overflow-hidden bg-surface-container-lowest relative shadow-sm border transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-outline-variant/10'}`}>
        {renderImage()}
        <span data-testid="plan-card-kcal" className="absolute left-1 bottom-1 max-w-[calc(100%-8px)] truncate inline-flex items-baseline gap-[2px] rounded-[5px] bg-black/60 backdrop-blur-md px-[5px] py-[3px] leading-none text-white tabular-nums">
          <span className="font-headline text-[10.5px] font-bold">{kcal}</span> <span className="text-[8.5px] font-medium text-white/75">kcal</span>
        </span>
        {isCopyMode ? (
          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-primary border-primary text-on-primary' : 'bg-surface/50 backdrop-blur-md border-white/80 text-transparent'}`}>
            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
          </div>
        ) : (
          <button
            type="button"
            aria-label={t('plan.itemMenu', { name: title })}
            onClick={(e) => { e.stopPropagation(); onMenuClick(); }}
            className="absolute top-0 right-0 z-10 w-14 h-14 flex items-start justify-end p-1.5 text-white group/menu active:scale-90 transition-transform"
          >
            <span className="w-8 h-8 bg-black/40 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center group-hover/menu:bg-black/50 transition-colors">
              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-col px-0.5 min-w-0">
        <h3 className="font-headline font-semibold text-[12px] sm:text-[13px] text-on-surface leading-tight line-clamp-2">{title}</h3>
      </div>
    </div>
  );
}

function AddField({ label, onClick, isToday, isCopyMode, copyLabel, isSelected, disabled }: { label: string, onClick: () => void, isToday?: boolean, isCopyMode?: boolean, copyLabel: string, isSelected?: boolean, disabled?: boolean }) {
  const tone = isSelected
    ? 'border-solid border-primary bg-primary/10 ring-2 ring-primary text-primary'
    : isToday
      ? 'border-today/30 bg-today/[0.05] text-primary hover:bg-today/10'
      : 'border-outline-variant/25 bg-surface-container-low text-on-surface-variant hover:bg-surface-container';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isCopyMode ? !!isSelected : undefined}
      className={`flex-1 min-h-[56px] w-full rounded-2xl border border-dashed flex flex-col items-center justify-center gap-1.5 px-1 py-2 transition-colors active:scale-[0.98] ${disabled ? 'opacity-30 pointer-events-none' : ''} ${tone}`}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isToday || isSelected ? 'bg-today/15' : 'bg-surface-container-highest'}`}>
        <span className="material-symbols-outlined text-[17px]">{isCopyMode ? (isSelected ? 'check' : 'file_copy') : 'add'}</span>
      </span>
      <span className="text-[10.5px] font-semibold leading-tight text-center">{isCopyMode ? copyLabel : label}</span>
    </button>
  );
}
