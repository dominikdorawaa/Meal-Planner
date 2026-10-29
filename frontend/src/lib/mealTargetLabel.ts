import { getLanguage, t, type Language } from '../i18n';

const POLISH_MEAL_CASES: Record<string, { genitive: string; locative: string }> = {
  'śniadanie': { genitive: 'śniadania', locative: 'śniadaniu' },
  '2 śniadanie': { genitive: '2 śniadania', locative: '2 śniadaniu' },
  'ii śniadanie': { genitive: 'II śniadania', locative: 'II śniadaniu' },
  'drugie śniadanie': { genitive: 'drugiego śniadania', locative: 'drugim śniadaniu' },
  'lunch': { genitive: 'lunchu', locative: 'lunchu' },
  'przekąska': { genitive: 'przekąski', locative: 'przekąsce' },
  'obiad': { genitive: 'obiadu', locative: 'obiedzie' },
  'podwieczorek': { genitive: 'podwieczorku', locative: 'podwieczorku' },
  'kolacja': { genitive: 'kolacji', locative: 'kolacji' },
  'deser': { genitive: 'deseru', locative: 'deserze' },
};

export interface MealTargetLabel {
  prefix: string;
  meal: string;
}

export function mealTargetLabel(mealName: string, editing: boolean, language: Language = getLanguage()): MealTargetLabel {
  const prefix = t(editing ? 'planTarget.editing' : 'planTarget.adding', {}, language);
  if (language !== 'pl') return { prefix, meal: mealName };
  const cases = POLISH_MEAL_CASES[mealName.trim().toLowerCase()];
  if (!cases) return { prefix: `${prefix}:`, meal: mealName };
  return { prefix, meal: editing ? cases.locative : cases.genitive };
}
