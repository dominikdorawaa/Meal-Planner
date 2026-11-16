import { useState } from 'react';
import { t } from '../i18n';
import { resolveMealProduct } from '../lib/mealProducts';
import { mealColor, type MealType } from '../lib/mealTypes';
import { formatDayMonth, formatRelativeDayLabel, planDays } from '../lib/planDates';
import { productDisplayName } from '../lib/productName';
import { refId, toggleMealIds, type PlanMeal } from '../lib/shoppingFromPlan';
import { ShoppingSheet, ShoppingSheetSubmit } from './ShoppingSheet';

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
      className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center transition-colors ${checked || mixed ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant/40'}`}
    >
      {(checked || mixed) && (
        <span className="material-symbols-outlined text-[18px] font-bold">{checked ? 'check' : 'remove'}</span>
      )}
    </span>
  );
}

const WEEK_BUTTON = 'w-10 h-10 rounded-full text-on-surface-variant flex items-center justify-center hover:bg-surface-container active:scale-95 transition-colors';

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
    <ShoppingSheet
      title={t('shopping.fromPlanTitle')}
      hint={t('shopping.fromPlanHint')}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          {error && <p role="alert" className="px-1 pb-3 text-error text-sm font-medium">{error}</p>}
          <ShoppingSheetSubmit
            label={t('shopping.addIngredients', { count: selectedIds.length })}
            busy={submitting}
            disabled={selectedIds.length === 0}
            onClick={() => onConfirm(meals.filter(meal => selectedIds.includes(meal.id)))}
          />
        </>
      }
    >
      <div className="sticky top-0 z-10 -mx-2 flex items-center justify-between gap-2 bg-surface-container-low pb-1">
        <button type="button" onClick={() => shiftWeek(-1)} aria-label={t('shopping.previousWeek')} className={WEEK_BUTTON}>
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">chevron_left</span>
        </button>
        <span className="font-headline font-extrabold text-sm tracking-tight text-on-surface tabular-nums">
          {formatDayMonth(days[0].date)} - {formatDayMonth(days[days.length - 1].date)}
        </span>
        <button type="button" onClick={() => shiftWeek(1)} aria-label={t('shopping.nextWeek')} className={WEEK_BUTTON}>
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">chevron_right</span>
        </button>
      </div>

      {days.map(day => {
        const dayMeals = mealsForDay(day.date);
        const dayIds = dayMeals.map(meal => meal.id);
        const selectedCount = dayIds.filter(id => selectedIds.includes(id)).length;
        const allSelected = dayIds.length > 0 && selectedCount === dayIds.length;
        const label = formatRelativeDayLabel(day.date);
        return (
          <section key={day.date} className="border-t border-outline-variant/10 py-1.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={allSelected ? true : selectedCount > 0 ? 'mixed' : false}
              aria-label={t('shopping.selectDay', { day: label })}
              disabled={dayIds.length === 0}
              onClick={() => toggle(dayIds)}
              className="-mx-2 w-[calc(100%+1rem)] min-h-12 px-2 rounded-2xl flex items-center gap-3.5 text-left enabled:active:bg-surface-container transition-colors"
            >
              {dayIds.length > 0 && <Checkbox checked={allSelected} mixed={!allSelected && selectedCount > 0} />}
              <span className={`flex-1 min-w-0 font-headline font-extrabold text-[14.5px] tracking-tight ${dayIds.length > 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}>{label}</span>
              <span className="text-[12.5px] text-on-surface-variant tabular-nums">
                {dayIds.length > 0 ? formatDayMonth(day.date) : t('shopping.noMeals')}
              </span>
            </button>
            {dayMeals.map(meal => {
              const name = mealName(meal);
              const typeIndex = typeOrder(meal.meal_type);
              const typeName = visibleTypes[typeIndex].name;
              const checked = selectedIds.includes(meal.id);
              return (
                <button
                  key={meal.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={t('shopping.selectMeal', { name: `${typeName}: ${name}` })}
                  onClick={() => toggle([meal.id])}
                  className="-mx-2 w-[calc(100%+1rem)] min-h-[52px] px-2 py-1.5 rounded-2xl flex items-center gap-3.5 text-left active:bg-surface-container transition-colors"
                >
                  <Checkbox checked={checked} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[12.5px] text-on-surface-variant">
                      <span aria-hidden="true" data-meal-dot className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: mealColor(typeIndex) }} />
                      <span className="truncate">{typeName}</span>
                    </span>
                    <span className="block text-[15px] font-medium text-on-surface truncate">{name}</span>
                  </span>
                </button>
              );
            })}
          </section>
        );
      })}
    </ShoppingSheet>
  );
}
