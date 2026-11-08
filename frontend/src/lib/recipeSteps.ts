import { arrayMove } from '@dnd-kit/sortable';
import { t } from '../i18n';

export const STEP_NAME_MAX_LENGTH = 60;

export interface RecipeStep {
  name: string | null;
  text: string;
}

export interface RecipeStepDraft {
  id: string;
  name: string;
  text: string;
}

let nextDraftId = 0;

export function newStepDraft(step: Partial<RecipeStep> = {}): RecipeStepDraft {
  nextDraftId += 1;
  return { id: `step-${nextDraftId}`, name: step.name ?? '', text: step.text ?? '' };
}

export function readRecipeSteps(raw: unknown): RecipeStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): RecipeStep[] => {
    if (typeof item === 'string') return [{ name: null, text: item }];
    if (!item || typeof item !== 'object') return [];
    const { name, text } = item as { name?: unknown; text?: unknown };
    const trimmed = typeof name === 'string' ? name.trim() : '';
    return [{ name: trimmed || null, text: typeof text === 'string' ? text : '' }];
  });
}

export function stepsOfRecipe(recipe: { steps?: unknown; instructions?: unknown }): RecipeStep[] {
  return readRecipeSteps(recipe.steps ?? recipe.instructions);
}

export function limitStepName(name: string): string {
  return name.trimStart().slice(0, STEP_NAME_MAX_LENGTH);
}

export function stepsPayload(drafts: RecipeStepDraft[]): { steps: RecipeStep[]; instructions: string[] } {
  const steps = stepsToSave(drafts);
  return { steps, instructions: steps.map(step => step.text.trim() ? step.text : step.name ?? '') };
}

function stepsToSave(drafts: RecipeStepDraft[]): RecipeStep[] {
  return drafts
    .map(draft => ({ name: draft.name.trim() || null, text: draft.text }))
    .filter(step => step.name !== null || step.text.trim() !== '');
}

export function stepTitle(step: { name: string | null }, index: number): string {
  return step.name?.trim() || t('recipeForm.step', { number: index + 1 });
}

export function reorderSteps<T extends { id: string }>(steps: T[], activeId: string, overId: string | null): T[] {
  if (!overId || activeId === overId) return steps;
  const from = steps.findIndex(step => step.id === activeId);
  const to = steps.findIndex(step => step.id === overId);
  if (from < 0 || to < 0) return steps;
  return arrayMove(steps, from, to);
}
