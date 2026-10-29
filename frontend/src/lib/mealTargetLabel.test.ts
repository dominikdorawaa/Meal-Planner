import { describe, expect, it } from 'vitest';
import { mealTargetLabel } from './mealTargetLabel';

describe('mealTargetLabel', () => {
  it.each([
    ['Śniadanie', 'śniadania'],
    ['2 Śniadanie', '2 śniadania'],
    ['Lunch', 'lunchu'],
    ['Przekąska', 'przekąski'],
    ['Obiad', 'obiadu'],
    ['Kolacja', 'kolacji'],
  ])('adds to %s in the genitive form', (name, declined) => {
    expect(mealTargetLabel(name, false, 'pl')).toEqual({ prefix: 'Dodajesz do', meal: declined });
  });

  it('edits in a meal in the locative form', () => {
    expect(mealTargetLabel('Obiad', true, 'pl')).toEqual({ prefix: 'Edytujesz w', meal: 'obiedzie' });
    expect(mealTargetLabel(' przekąska ', true, 'pl')).toEqual({ prefix: 'Edytujesz w', meal: 'przekąsce' });
  });

  it('keeps a renamed meal as typed after a colon', () => {
    expect(mealTargetLabel('Posiłek po treningu', false, 'pl')).toEqual({ prefix: 'Dodajesz do:', meal: 'Posiłek po treningu' });
  });

  it.each(['constructor', '__proto__', 'toString'])('keeps a meal named %s as typed', name => {
    expect(mealTargetLabel(name, false, 'pl')).toEqual({ prefix: 'Dodajesz do:', meal: name });
  });

  it('keeps the meal name unchanged in English', () => {
    expect(mealTargetLabel('Kolacja', false, 'en')).toEqual({ prefix: 'Adding to', meal: 'Kolacja' });
    expect(mealTargetLabel('Kolacja', true, 'en')).toEqual({ prefix: 'Editing in', meal: 'Kolacja' });
  });
});
