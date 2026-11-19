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
import { useAutoGrow } from '../lib/autoGrow';

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
        <div className="flex flex-col gap-2">
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
  const textRef = useAutoGrow(step.text);
  const number = index + 1;

  return (
    <div
      ref={setNodeRef}
      data-step-index={index}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative mt-4 min-w-0 rounded-[20px] px-3 pb-3 pt-6 flex flex-col gap-2 transition-colors ${isDragging ? 'z-10 opacity-90 ring-2 ring-primary bg-surface-container shadow-ambient' : 'bg-surface-container-low'}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('recipeForm.moveStep', { number })}
        className={`absolute -top-4 -left-2 w-10 h-10 rounded-full flex items-center justify-center gap-1 ring-4 ring-surface touch-none [-webkit-touch-callout:none] cursor-grab active:cursor-grabbing transition-colors ${isDragging ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface'}`}
      >
        <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
          {Array.from({ length: 6 }, (_, dot) => (
            <span key={dot} className={`w-[2.5px] h-[2.5px] rounded-full ${isDragging ? 'bg-on-primary/70' : 'bg-on-surface-variant'}`} />
          ))}
        </span>
        <span className="text-sm font-bold leading-none tabular-nums">{number}</span>
      </button>
      <div className="relative">
        <input
          type="text"
          autoComplete="off"
          value={step.name}
          onChange={e => onNameChange(limitStepName(e.target.value))}
          placeholder={t('recipeForm.step', { number })}
          aria-label={t('recipeForm.stepName', { number })}
          className="w-full h-11 bg-surface-container rounded-xl pl-3 pr-11 outline-hidden border-[1.5px] border-transparent focus:border-primary caret-primary text-on-surface font-semibold text-[15px] placeholder:font-medium placeholder:text-on-surface-variant/60"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('recipeForm.removeStep', { number })}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <textarea
        ref={textRef}
        rows={2}
        autoComplete="off"
        value={step.text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={t('recipeForm.stepTextPlaceholder')}
        aria-label={t('recipeForm.stepText', { number })}
        className="w-full bg-surface-container rounded-2xl p-3 min-h-[76px] outline-hidden border-[1.5px] border-transparent focus:border-primary caret-primary text-on-surface text-[15px] leading-snug transition-colors resize-none overflow-hidden [overflow-wrap:anywhere] placeholder:text-on-surface-variant/60"
      />
    </div>
  );
}
