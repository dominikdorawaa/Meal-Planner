import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderMeals, type MealSetting } from '../lib/mealSettings';

interface MealSettingsListProps<T extends MealSetting> {
  meals: T[];
  isReordering: boolean;
  onReorder: (meals: T[]) => void;
  renderMeal: (meal: T, index: number, handle: ReactNode) => ReactNode;
}

export function MealSettingsList<T extends MealSetting>({ meals, isReordering, onReorder, renderMeal }: MealSettingsListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const reordered = reorderMeals(meals, String(active.id), over ? String(over.id) : null);
    if (reordered !== meals) onReorder(reordered);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={meals.map(meal => meal.id)} strategy={verticalListSortingStrategy}>
        {meals.map((meal, index) => (
          <SortableMeal key={meal.id} meal={meal} index={index} isReordering={isReordering} renderMeal={renderMeal} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface SortableMealProps<T extends MealSetting> {
  meal: T;
  index: number;
  isReordering: boolean;
  renderMeal: (meal: T, index: number, handle: ReactNode) => ReactNode;
}

function SortableMeal<T extends MealSetting>({ meal, index, isReordering, renderMeal }: SortableMealProps<T>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: meal.id,
    disabled: !isReordering,
  });

  const handle = isReordering ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Przeciągnij: ${meal.name}`}
      className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-sm border border-primary/5 touch-none cursor-grab active:cursor-grabbing"
    >
      <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
    </button>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`p-4 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col gap-3 ${isReordering ? 'border-dashed bg-surface/50 select-none' : 'bg-surface-container-lowest'} ${isDragging ? 'relative z-10 opacity-80 border-primary bg-primary/5 shadow-lg' : ''}`}
    >
      {renderMeal(meal, index, handle)}
    </div>
  );
}
