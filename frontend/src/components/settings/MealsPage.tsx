import { useState } from 'react';
import { t } from '../../i18n';
import type { MealSetting } from '../../lib/mealSettings';
import { mealColor } from '../../lib/mealTypes';
import { MealSettingsList } from '../MealSettingsList';
import { PrimaryButton, SettingsPage } from './SettingsUi';

type MealsPageProps = {
  meals: MealSetting[];
  depth: number;
  onBack: () => void;
  onSave: (meals: MealSetting[]) => Promise<boolean>;
};

export function MealsPage({ meals, depth, onBack, onSave }: MealsPageProps) {
  const [draft, setDraft] = useState(meals);
  const [reordering, setReordering] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const finishRename = () => {
    if (renamingId === null) return;
    const trimmed = name.trim();
    if (trimmed) setDraft(current => current.map(meal => (meal.id === renamingId ? { ...meal, name: trimmed } : meal)));
    setRenamingId(null);
  };

  const save = async () => {
    const trimmed = name.trim();
    const finalMeals = renamingId !== null && trimmed ? draft.map(meal => (meal.id === renamingId ? { ...meal, name: trimmed } : meal)) : draft;
    const saved = await onSave(finalMeals);
    if (saved) onBack();
  };

  const toggleAction = (
    <button
      type="button"
      onClick={() => {
        finishRename();
        setReordering(current => !current);
      }}
      className="h-10 px-3.5 rounded-full text-base font-semibold text-primary hover:bg-surface-container transition-colors"
    >
      {reordering ? t('settings.meals.done') : t('settings.meals.reorder')}
    </button>
  );

  return (
    <SettingsPage
      title={t('settings.meals')}
      onBack={onBack}
      depth={depth}
      action={toggleAction}
      footer={<PrimaryButton onClick={save}>{t('settings.save')}</PrimaryButton>}
    >
      <p className="mt-1 mb-4 px-1 text-sm leading-relaxed text-on-surface-variant">
        {reordering ? t('settings.meals.reorderHint') : t('settings.meals.hint')}
      </p>
      <div className="flex flex-col gap-2">
        <MealSettingsList
          meals={draft}
          isReordering={reordering}
          onReorder={setDraft}
          renderMeal={(meal, index, handle) => (
            <div className="min-h-[56px] flex items-center gap-3">
              {handle ?? (
                <span
                  aria-hidden="true"
                  className="w-9 h-9 shrink-0 flex items-center justify-center"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: mealColor(index), boxShadow: `0 0 0 3px ${mealColor(index)}38` }}></span>
                </span>
              )}
              {renamingId === meal.id && !reordering ? (
                <input
                  autoFocus
                  autoComplete="off"
                  aria-label={t('settings.meals.rename', { name: meal.name })}
                  value={name}
                  maxLength={40}
                  onChange={event => setName(event.target.value)}
                  onBlur={finishRename}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className="flex-1 min-w-0 h-10 rounded-xl bg-surface-container px-3 text-base font-semibold text-on-surface outline-none border-[1.5px] border-primary caret-primary"
                />
              ) : (
                <button
                  type="button"
                  disabled={reordering}
                  aria-label={t('settings.meals.rename', { name: meal.name })}
                  onClick={() => {
                    setRenamingId(meal.id);
                    setName(meal.name);
                  }}
                  className={`flex-1 min-w-0 flex items-center gap-1.5 text-left text-base font-semibold ${meal.visible ? 'text-on-surface' : 'text-on-surface-variant'}`}
                >
                  <span className="truncate">{meal.name}</span>
                  {!reordering && <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant/60">edit</span>}
                </button>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={meal.visible}
                aria-label={t('settings.meals.show', { name: meal.name })}
                disabled={reordering}
                onClick={() => setDraft(current => current.map(item => (item.id === meal.id ? { ...item, visible: !item.visible } : item)))}
                className={`w-[52px] h-8 shrink-0 rounded-full p-1 transition-colors disabled:opacity-30 ${meal.visible ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <span className={`block w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform ${meal.visible ? 'translate-x-5' : ''}`}></span>
              </button>
            </div>
          )}
        />
      </div>
    </SettingsPage>
  );
}
