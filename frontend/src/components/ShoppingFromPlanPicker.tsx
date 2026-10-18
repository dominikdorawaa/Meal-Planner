import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { resolveMealProduct } from '../lib/mealProducts';
import type { MealType } from '../lib/mealTypes';
import { formatDayMonth, formatRelativeDayLabel, planDays } from '../lib/planDates';
import { productDisplayName } from '../lib/productName';
import { refId, toggleMealIds, type PlanMeal } from '../lib/shoppingFromPlan';

const DAYS_PER_PAGE = 7;

interface NamedRecipe {
  id: string;
  name: string;
}

interface ShoppingFromPlanPickerProps {
  meals: PlanMeal[];
  recipes: NamedRecipe[];
  mealTypes: MealType[];
  submitting: boolean;
  error: string | null;
  onConfirm: (meals: PlanMeal[]) => void;
  onClose: () => void;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function Checkbox({ checked, mixed = false }: { checked: boolean; mixed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${checked || mixed ? 'bg-primary border-primary text-on-primary' : 'border-on-surface-variant/40'}`}
    >
      {(checked || mixed) && (
        <span className="material-symbols-outlined text-[18px] font-black">{checked ? 'check' : 'remove'}</span>
      )}
    </span>
  );
}

export function ShoppingFromPlanPicker({
  meals,
  recipes,
  mealTypes,
  submitting,
  error,
  onConfirm,
  onClose,
}: ShoppingFromPlanPickerProps) {
  const [startDate, setStartDate] = useState(startOfToday);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  const days = planDays(startDate, DAYS_PER_PAGE);
  const visibleTypes = mealTypes.filter(type => type.visible);
  const typeOrder = (type: string) => visibleTypes.findIndex(meal => meal.id === type);

  const mealName = (meal: PlanMeal) => {
    if (refId(meal.recipe)) return recipes.find(recipe => recipe.id === refId(meal.recipe))?.name;
    if (refId(meal.product)) return productDisplayName(resolveMealProduct(meal, meals));
    return meal.manual_name || t('plan.quickMeal');
  };

  const mealsForDay = (date: string) =>
    meals
      .filter(meal => meal.meal_date === date && typeOrder(meal.meal_type) >= 0)
      .filter(meal => mealName(meal))
      .sort((a, b) => typeOrder(a.meal_type) - typeOrder(b.meal_type));

  const shiftWeek = (direction: number) =>
    setStartDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + direction * DAYS_PER_PAGE));

  const toggle = (ids: string[]) => setSelectedIds(prev => toggleMealIds(prev, ids));

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-from-plan-title"
        className="bg-surface w-full sm:max-w-md sm:rounded-[28px] rounded-t-[28px] overflow-hidden shadow-2xl relative z-10 border border-outline-variant/15 max-h-[90vh] flex flex-col outline-none"
      >
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mt-3 sm:hidden shrink-0" />
        <div className="px-6 pt-5 pb-2 flex items-center justify-between gap-3 shrink-0">
          <h3 id="shopping-from-plan-title" className="font-headline font-bold text-lg text-on-surface">
            {t('shopping.fromPlanTitle')}
          </h3>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-colors disabled:opacity-50"
            aria-label={t('shopping.close')}
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <p className="px-6 text-xs text-on-surface-variant leading-relaxed shrink-0">{t('shopping.fromPlanHint')}</p>

        <div className="px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            aria-label={t('shopping.previousWeek')}
            className="w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <span className="font-headline font-bold text-sm text-on-surface">
            {formatDayMonth(days[0].date)} - {formatDayMonth(days[days.length - 1].date)}
          </span>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            aria-label={t('shopping.nextWeek')}
            className="w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        <div className="px-4 pb-3 overflow-y-auto space-y-3 flex-1 min-h-0">
          {days.map(day => {
            const dayMeals = mealsForDay(day.date);
            const dayIds = dayMeals.map(meal => meal.id);
            const selectedCount = dayIds.filter(id => selectedIds.includes(id)).length;
            const allSelected = dayIds.length > 0 && selectedCount === dayIds.length;
            const label = formatRelativeDayLabel(day.date);
            return (
              <section key={day.date} className="bg-surface-container-low rounded-2xl p-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={allSelected ? true : selectedCount > 0 ? 'mixed' : false}
                  aria-label={t('shopping.selectDay', { day: label })}
                  disabled={dayIds.length === 0}
                  onClick={() => toggle(dayIds)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left disabled:opacity-60"
                >
                  <Checkbox checked={allSelected} mixed={!allSelected && selectedCount > 0} />
                  <span className="font-headline font-bold text-sm text-on-surface flex-1">{label}</span>
                  <span className="text-[11px] font-bold text-on-surface-variant">{formatDayMonth(day.date)}</span>
                </button>
                {dayMeals.length === 0 ? (
                  <p className="px-3 pb-2 text-xs text-on-surface-variant">{t('shopping.noMeals')}</p>
                ) : (
                  <div className="space-y-0.5">
                    {dayMeals.map(meal => {
                      const name = mealName(meal);
                      const typeName = visibleTypes[typeOrder(meal.meal_type)].name;
                      const checked = selectedIds.includes(meal.id);
                      return (
                        <button
                          key={meal.id}
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={t('shopping.selectMeal', { name: `${typeName}: ${name}` })}
                          onClick={() => toggle([meal.id])}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-surface-container-lowest rounded-xl text-left active:scale-[0.99] transition-transform"
                        >
                          <Checkbox checked={checked} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              {typeName}
                            </span>
                            <span className="block text-sm font-medium text-on-surface truncate">{name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="px-6 pt-3 pb-safe-6 border-t border-outline-variant/15 shrink-0">
          {error && <p className="text-error text-sm font-medium mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 h-12 font-bold text-sm text-on-surface-variant rounded-xl hover:bg-surface-container-highest transition-colors disabled:opacity-50"
            >
              {t('shopping.cancel')}
            </button>
            <button
              type="button"
              disabled={submitting || selectedIds.length === 0}
              onClick={() => onConfirm(meals.filter(meal => selectedIds.includes(meal.id)))}
              className="flex-1 h-12 bg-primary text-on-primary font-bold text-sm rounded-xl active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              ) : (
                <>
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                  {t('shopping.addIngredients', { count: selectedIds.length })}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
