import { useState } from 'react';
import { t } from '../i18n';
import { formatLocalizedDayLabel } from '../lib/planDates';
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

export function PlanTargetPicker({ meals, mealType, date, editing, onMealTypeChange, onDateChange }: PlanTargetPickerProps) {
  const [open, setOpen] = useState<'meal' | 'date' | null>(null);
  const close = () => setOpen(null);
  const mealName = meals.find(meal => meal.id === mealType)?.name || mealType;

  return (
    <div className="flex flex-col min-w-0 flex-1 pt-0.5">
      <button
        type="button"
        disabled={editing}
        onClick={() => setOpen('meal')}
        aria-haspopup="dialog"
        className="flex items-center gap-1 min-w-0 w-fit max-w-full font-headline font-bold text-base text-on-surface leading-tight active:scale-95 transition-transform disabled:active:scale-100"
      >
        <span className="truncate">{t(editing ? 'planTarget.editing' : 'planTarget.adding')} <span className="text-primary">{mealName}</span></span>
        {!editing && <span className="material-symbols-outlined shrink-0 text-[16px] text-primary">expand_more</span>}
      </button>
      <button
        type="button"
        disabled={editing}
        onClick={() => setOpen('date')}
        aria-haspopup="dialog"
        className="flex items-center gap-1 min-w-0 w-fit max-w-full mt-0.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest leading-tight active:scale-95 transition-transform disabled:active:scale-100"
      >
        <span className="truncate">{formatLocalizedDayLabel(date, t('recipeDetails.locale'), { yesterday: t('planTarget.yesterday'), today: t('planTarget.today'), tomorrow: t('planTarget.tomorrow') })}</span>
        {!editing && <span className="material-symbols-outlined shrink-0 text-[14px] text-primary/70">expand_more</span>}
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
