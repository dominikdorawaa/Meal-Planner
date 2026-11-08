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
import { t } from '../i18n';
import { limitStepName, reorderSteps, type RecipeStepDraft } from '../lib/recipeSteps';

interface RecipeStepsEditorProps {
  steps: RecipeStepDraft[];
  onChange: (steps: RecipeStepDraft[]) => void;
  onRemove: (index: number) => void;
}

export function RecipeStepsEditor({ steps, onChange, onRemove }: RecipeStepsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const reordered = reorderSteps(steps, String(active.id), over ? String(over.id) : null);
    if (reordered !== steps) onChange(reordered);
  };

  const update = (index: number, change: Partial<RecipeStepDraft>) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...change } : step)));
  };

  if (steps.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map(step => step.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <SortableStep
              key={step.id}
              step={step}
              index={index}
              onNameChange={name => update(index, { name })}
              onTextChange={text => update(index, { text })}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableStepProps {
  step: RecipeStepDraft;
  index: number;
  onNameChange: (name: string) => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
}

function SortableStep({ step, index, onNameChange, onTextChange, onRemove }: SortableStepProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const number = index + 1;

  return (
    <div
      ref={setNodeRef}
      data-step-index={index}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`min-w-0 rounded-3xl border p-3 flex flex-col gap-2 transition-colors ${isDragging ? 'relative z-10 opacity-80 border-primary bg-primary/5 shadow-lg' : 'border-outline-variant/20 bg-surface-container-lowest'}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('recipeForm.moveStep', { number })}
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container touch-none [-webkit-touch-callout:none] cursor-grab active:cursor-grabbing"
        >
          <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
        </button>
        <div className="w-7 h-7 rounded-full bg-surface-container-highest text-on-surface-variant font-black text-xs flex items-center justify-center shrink-0">
          {number}
        </div>
        <input
          type="text"
          autoComplete="off"
          value={step.name}
          onChange={e => onNameChange(limitStepName(e.target.value))}
          placeholder={t('recipeForm.step', { number })}
          aria-label={t('recipeForm.stepName', { number })}
          className="flex-1 min-w-0 bg-surface-container-low rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm placeholder:font-medium placeholder:text-on-surface-variant/60"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('recipeForm.removeStep', { number })}
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <textarea
        autoComplete="off"
        value={step.text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={t('recipeForm.stepTextPlaceholder')}
        aria-label={t('recipeForm.stepText', { number })}
        className="w-full bg-surface-container-low rounded-2xl p-3 min-h-[88px] outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium text-sm transition-shadow resize-y [overflow-wrap:anywhere]"
      />
    </div>
  );
}
