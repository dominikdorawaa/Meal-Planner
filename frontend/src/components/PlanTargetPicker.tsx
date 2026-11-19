import { useState } from 'react';
import { t } from '../i18n';
import { formatLocalizedDayWithDate } from '../lib/planDates';
import { mealColor, mealTypeName } from '../lib/mealTypes';
import { BottomPanel } from './BottomPanel';
import { MonthCalendar } from './MonthCalendar';

interface PlanTargetMeal {
  id: string;
  name: string;
}

interface PlanTargetPickerProps {
  meals: PlanTargetMeal[];
  mealType: string;
  date: string;
  editing: boolean;
  onMealTypeChange: (mealType: string) => void;
  onDateChange: (date: string) => void;
}

function planTargetDayLabel(date: string) {
  return formatLocalizedDayWithDate(date, t('recipeDetails.locale'), {
    yesterday: t('planTarget.yesterday'),
    today: t('planTarget.today'),
    tomorrow: t('planTarget.tomorrow'),
  });
}

export function PlanTargetMeta({ meals, mealType, date }: { meals: PlanTargetMeal[]; mealType: string; date: string }) {
  const color = mealColor(meals.findIndex(meal => meal.id === mealType));
  return (
    <>
      <span aria-hidden="true" className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}8c` }} />
      <span className="truncate">{mealTypeName(mealType, meals)} · {planTargetDayLabel(date)}</span>
    </>
  );
}

export function PlanTargetPicker({ meals, mealType, date, editing, onMealTypeChange, onDateChange }: PlanTargetPickerProps) {
  const [open, setOpen] = useState<'meal' | 'date' | null>(null);
  const close = () => setOpen(null);
  const mealName = mealTypeName(mealType, meals);

  return (
    <div className="flex flex-col min-w-0 flex-1 pt-0.5">
      <button
        type="button"
        disabled={editing}
        onClick={() => setOpen('meal')}
        aria-haspopup="dialog"
        className="flex items-center gap-1 min-w-0 w-fit max-w-full font-headline font-extrabold text-[17px] tracking-tight text-on-surface leading-tight active:scale-95 transition-transform disabled:active:scale-100"
      >
        <span className="truncate">{t(editing ? 'planTarget.editing' : 'planTarget.adding')} <span className="text-primary">{mealName}</span></span>
        {!editing && <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[18px] text-primary">expand_more</span>}
      </button>
      <button
        type="button"
        disabled={editing}
        onClick={() => setOpen('date')}
        aria-haspopup="dialog"
        className="flex items-center gap-0.5 min-w-0 w-fit max-w-full mt-0.5 text-[12.5px] font-medium text-on-surface-variant leading-tight active:scale-95 transition-transform disabled:active:scale-100"
      >
        <span className="truncate">{planTargetDayLabel(date)}</span>
        {!editing && <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[16px]">expand_more</span>}
      </button>

      {open === 'meal' && (
        <BottomPanel title={t('planTarget.chooseMeal')} onClose={close}>
          <div className="flex flex-col gap-1">
            {meals.map(meal => (
              <button
                key={meal.id}
                type="button"
                aria-pressed={meal.id === mealType}
                onClick={() => { onMealTypeChange(meal.id); close(); }}
                className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-base font-bold transition-colors active:scale-[0.98] ${meal.id === mealType ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`}
              >
                <span>{meal.name}</span>
                {meal.id === mealType && <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
              </button>
            ))}
          </div>
        </BottomPanel>
      )}

      {open === 'date' && (
        <BottomPanel title={t('planTarget.chooseDay')} onClose={close}>
          <MonthCalendar selected={date} onSelect={next => { onDateChange(next); close(); }} />
        </BottomPanel>
      )}
    </div>
  );
}
