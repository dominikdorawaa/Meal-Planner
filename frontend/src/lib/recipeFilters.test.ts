import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import {
  DEFAULT_FILTERS,
  filterConditions,
  matchingRecipes,
  nearMatches,
  searchCondition,
  sheetFilterCount,
  sortRecipes,
  toggleQuickPreset,
  withoutCondition,
  type RecipeFilters,
} from './recipeFilters';

const OATMEAL = { id: 'r1', name: 'Owsianka', kcal: 412.6, protein: 12, fat: 8, carbs: 61, prep_time: 10 };
const SALMON = { id: 'r2', name: 'Łosoś', kcal: 650, protein: 45, fat: 30, carbs: 10, prep_time: 0 };
const PASTA = { id: 'r3', name: 'Makaron', kcal: 380, protein: 14, fat: 9, carbs: 55, prep_time: 75 };
const RECIPES = [OATMEAL, SALMON, PASTA];

function filters(patch: Partial<RecipeFilters>): RecipeFilters {
  return { ...DEFAULT_FILTERS, ...patch };
}

function names(list: { name?: string | null }[]) {
  return list.map(recipe => recipe.name);
}

describe('recipe filter conditions', () => {
  it.each([
    ['quick', ['Owsianka']],
    ['highprotein', ['Łosoś']],
    ['lowcarb', ['Łosoś']],
    ['lowcal', ['Makaron']],
    ['lowfat', ['Owsianka', 'Makaron']],
  ] as const)('applies the %s preset', (preset, expected) => {
    expect(names(matchingRecipes(RECIPES, filterConditions(filters({ quick: [preset] }))))).toEqual(expected);
  });

  it('applies the sheet values and labels them for the chips', () => {
    const conditions = filterConditions(filters({ maxKcal: 450, minProtein: 10, maxCarbs: 60, maxPrepTime: 'long' }));

    expect(conditions.map(condition => condition.label)).toEqual([
      t('recipes.filters.kcalChip', { value: 450 }),
      t('recipes.filters.proteinChip', { value: 10 }),
      t('recipes.filters.carbsChip', { value: 60 }),
      t('recipes.filters.prepTimeLong'),
    ]);
    expect(names(matchingRecipes(RECIPES, conditions))).toEqual(['Makaron']);
  });

  it('treats recipes without a preparation time as not matching time filters', () => {
    expect(names(matchingRecipes(RECIPES, filterConditions(filters({ maxPrepTime: 15 }))))).toEqual(['Owsianka']);
    expect(filterConditions(filters({ maxPrepTime: 15 }))[0].label).toBe(t('recipes.filters.prepTimeUpTo', { count: 15 }));
  });

  it('describes what a recipe is missing', () => {
    const [kcal, protein, carbs, prep] = filterConditions(filters({ maxKcal: 300, minProtein: 50, maxCarbs: 5, maxPrepTime: 5 }));
    const [fat] = filterConditions(filters({ quick: ['lowfat'] }));
    const [long] = filterConditions(filters({ maxPrepTime: 'long' }));

    expect(kcal.miss(OATMEAL)).toBe(t('recipes.missing.kcal', { value: 413 }));
    expect(protein.miss(OATMEAL)).toBe(t('recipes.missing.protein', { value: 12 }));
    expect(carbs.miss(OATMEAL)).toBe(t('recipes.missing.carbs', { value: 61 }));
    expect(prep.miss(OATMEAL)).toBe(t('recipes.missing.prepTime', { value: 10 }));
    expect(prep.miss(SALMON)).toBe(t('recipes.missing.noPrepTime'));
    expect(fat.miss(SALMON)).toBe(t('recipes.missing.fat', { value: 30 }));
    expect(long.miss(OATMEAL)).toBe(t('recipes.missing.prepTimeShort', { value: 10 }));
    expect(long.miss(SALMON)).toBe(t('recipes.missing.noPrepTime'));
  });

  it('searches names without case and ignores an empty query', () => {
    expect(searchCondition('   ')).toBeNull();
    const search = searchCondition(' OWS ')!;

    expect(search.label).toBe(t('recipes.searchChip', { query: 'OWS' }));
    expect(search.miss(OATMEAL)).toBe('');
    expect(names(matchingRecipes([...RECIPES, { id: 'r4', name: null }], [search]))).toEqual(['Owsianka']);
  });
});

describe('recipe filter state', () => {
  it('counts only the values set in the sheet', () => {
    expect(sheetFilterCount(filters({ quick: ['quick'], maxKcal: 400, maxPrepTime: 30 }))).toBe(2);
  });

  it('removes a single condition', () => {
    const current = filters({ quick: ['quick', 'lowfat'], maxKcal: 400, minProtein: 20, maxCarbs: 50, maxPrepTime: 30 });

    expect(withoutCondition(current, 'quick').quick).toEqual(['lowfat']);
    expect(withoutCondition(current, 'maxKcal').maxKcal).toBe('');
    expect(withoutCondition(current, 'minProtein').minProtein).toBe('');
    expect(withoutCondition(current, 'maxCarbs').maxCarbs).toBe('');
    expect(withoutCondition(current, 'maxPrepTime').maxPrepTime).toBe('');
    expect(withoutCondition(current, 'search')).toBe(current);
  });

  it('toggles quick presets', () => {
    const on = toggleQuickPreset(DEFAULT_FILTERS, 'lowcal');

    expect(on.quick).toEqual(['lowcal']);
    expect(toggleQuickPreset(on, 'lowcal').quick).toEqual([]);
  });
});

describe('near matches', () => {
  it('lists recipes that fail exactly one condition', () => {
    const conditions = filterConditions(filters({ maxKcal: 300, minProtein: 13 }));

    expect(nearMatches(RECIPES, conditions, null, 5).map(match => [match.recipe.name, match.miss])).toEqual([
      ['Łosoś', t('recipes.missing.kcal', { value: 650 })],
      ['Makaron', t('recipes.missing.kcal', { value: 380 })],
    ]);
    expect(nearMatches(RECIPES, conditions, null, 1)).toHaveLength(1);
  });

  it('keeps the search as a hard requirement', () => {
    const conditions = filterConditions(filters({ maxKcal: 300 }));

    expect(nearMatches(RECIPES, conditions, searchCondition('mak'), 5).map(match => match.recipe.name)).toEqual(['Makaron']);
  });

  it('shows nothing for a single filter or a search alone', () => {
    expect(nearMatches(RECIPES, filterConditions(filters({ maxKcal: 300 })), null, 5)).toEqual([]);
    expect(nearMatches(RECIPES, [], searchCondition('pizza'), 5)).toEqual([]);
  });
});

describe('recipe sorting', () => {
  it('sorts by name, calories and protein', () => {
    expect(names(sortRecipes(RECIPES, 'name', []))).toEqual(['Łosoś', 'Makaron', 'Owsianka']);
    expect(names(sortRecipes(RECIPES, 'kcal', []))).toEqual(['Makaron', 'Owsianka', 'Łosoś']);
    expect(names(sortRecipes(RECIPES, 'protein', []))).toEqual(['Łosoś', 'Makaron', 'Owsianka']);
  });

  it('puts recently used recipes first and the rest by name', () => {
    expect(names(sortRecipes(RECIPES, 'recent', ['r3', 'r1']))).toEqual(['Makaron', 'Owsianka', 'Łosoś']);
  });

  it('breaks ties by name', () => {
    const twin = { ...OATMEAL, id: 'r5', name: 'Amarantus' };
    expect(names(sortRecipes([OATMEAL, twin], 'kcal', []))).toEqual(['Amarantus', 'Owsianka']);
    expect(names(sortRecipes([OATMEAL, twin], 'protein', []))).toEqual(['Amarantus', 'Owsianka']);
    expect(names(sortRecipes([{ id: 'x', name: undefined }, OATMEAL], 'name', []))).toEqual([undefined, 'Owsianka']);
  });
});
