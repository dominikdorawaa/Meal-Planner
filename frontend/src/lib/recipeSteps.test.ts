import { describe, expect, it } from 'vitest';
import { limitStepName, newStepDraft, readRecipeSteps, reorderSteps, stepTitle, stepsOfRecipe, stepsPayload } from './recipeSteps';

describe('recipeSteps', () => {
  it('reads plain text and named steps and skips unknown values', () => {
    expect(readRecipeSteps(['Boil', { name: ' Sauce ', text: 'Fry' }, { name: '  ', text: 5 }, null, 7])).toEqual([
      { name: null, text: 'Boil' },
      { name: 'Sauce', text: 'Fry' },
      { name: null, text: '' },
    ]);
    expect(readRecipeSteps(undefined)).toEqual([]);
  });

  it('gives every draft its own id', () => {
    const first = newStepDraft();
    const second = newStepDraft({ name: null, text: 'Boil' });

    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({ name: '', text: '' });
    expect(second).toMatchObject({ name: '', text: 'Boil' });
  });

  it('reads named steps first and falls back to plain text instructions', () => {
    expect(stepsOfRecipe({ steps: [{ name: 'Sauce', text: 'Fry' }], instructions: ['Fry'] })).toEqual([{ name: 'Sauce', text: 'Fry' }]);
    expect(stepsOfRecipe({ instructions: ['Boil'] })).toEqual([{ name: null, text: 'Boil' }]);
    expect(stepsOfRecipe({})).toEqual([]);
  });

  it('limits a step name after dropping leading spaces', () => {
    expect(limitStepName('  Sauce')).toBe('Sauce');
    expect(limitStepName(' ' + 'a'.repeat(70))).toBe('a'.repeat(60));
    expect(limitStepName('a'.repeat(60) + ' ')).toBe('a'.repeat(60));
  });

  it('saves trimmed names and skips steps without name and text', () => {
    expect(stepsPayload([
      { id: 'a', name: ' Sauce ', text: 'Fry' },
      { id: 'b', name: ' ', text: '  ' },
      { id: 'c', name: '', text: 'Boil' },
      { id: 'd', name: 'Serve', text: '' },
    ])).toEqual({
      steps: [
        { name: 'Sauce', text: 'Fry' },
        { name: null, text: 'Boil' },
        { name: 'Serve', text: '' },
      ],
      instructions: ['Fry', 'Boil', 'Serve'],
    });
  });

  it('uses the step number when a step has no name', () => {
    expect(stepTitle({ name: 'Sauce' }, 0)).toBe('Sauce');
    expect(stepTitle({ name: ' ' }, 1)).toBe('Krok 2');
    expect(stepTitle({ name: null }, 2)).toBe('Krok 3');
  });

  it('moves a step to the place of another one', () => {
    const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(reorderSteps(steps, 'a', 'c')).toEqual([{ id: 'b' }, { id: 'c' }, { id: 'a' }]);
    expect(reorderSteps(steps, 'a', null)).toBe(steps);
    expect(reorderSteps(steps, 'a', 'a')).toBe(steps);
    expect(reorderSteps(steps, 'x', 'a')).toBe(steps);
  });
});
