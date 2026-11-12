import { t, type MessageKey } from '../i18n';

export type QuickPreset = 'quick' | 'highprotein' | 'lowcarb' | 'lowcal' | 'lowfat';
export type PrepTimeFilter = number | '' | 'long';
export type RecipeSort = 'recent' | 'name' | 'kcal' | 'protein';
export type RecipeScope = 'mine' | 'all';

export interface RecipeFilters {
  maxKcal: number | '';
  minProtein: number | '';
  maxCarbs: number | '';
  maxPrepTime: PrepTimeFilter;
  quick: QuickPreset[];
}

export interface FilterableRecipe {
  id: string;
  name?: string | null;
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  prep_time?: number | null;
}

export type ConditionKey = QuickPreset | 'maxKcal' | 'minProtein' | 'maxCarbs' | 'maxPrepTime' | 'search';

export interface RecipeCondition {
  key: ConditionKey;
  label: string;
  matches: (recipe: FilterableRecipe) => boolean;
  miss: (recipe: FilterableRecipe) => string;
}

export interface NearMatch<R extends FilterableRecipe> {
  recipe: R;
  miss: string;
}

export const DEFAULT_FILTERS: RecipeFilters = {
  maxKcal: '',
  minProtein: '',
  maxCarbs: '',
  maxPrepTime: '',
  quick: [],
};

export const QUICK_PRESETS: { val: QuickPreset; icon: string }[] = [
  { val: 'quick', icon: 'bolt' },
  { val: 'highprotein', icon: 'fitness_center' },
  { val: 'lowcarb', icon: 'grain' },
  { val: 'lowcal', icon: 'local_fire_department' },
  { val: 'lowfat', icon: 'water_drop' },
];

export const PREP_TIME_OPTIONS: PrepTimeFilter[] = [15, 30, 45, 60, 'long'];

export const RECIPE_SORTS: RecipeSort[] = ['recent', 'name', 'kcal', 'protein'];

const QUICK_PREP_MINUTES = 20;
const HIGH_PROTEIN_GRAMS = 25;
const LOW_CARB_GRAMS = 20;
const LOW_KCAL = 400;
const LOW_FAT_GRAMS = 10;
const LONG_PREP_MINUTES = 60;

function amount(value: unknown): number {
  return Number(value) || 0;
}

function rounded(value: unknown): number {
  return Math.round(amount(value));
}

function maxKcal(limit: number, label: string, key: ConditionKey): RecipeCondition {
  return {
    key,
    label,
    matches: recipe => amount(recipe.kcal) <= limit,
    miss: recipe => t('recipes.missing.kcal', { value: rounded(recipe.kcal) }),
  };
}

function minProtein(limit: number, label: string, key: ConditionKey): RecipeCondition {
  return {
    key,
    label,
    matches: recipe => amount(recipe.protein) >= limit,
    miss: recipe => t('recipes.missing.protein', { value: rounded(recipe.protein) }),
  };
}

function maxCarbs(limit: number, label: string, key: ConditionKey): RecipeCondition {
  return {
    key,
    label,
    matches: recipe => amount(recipe.carbs) <= limit,
    miss: recipe => t('recipes.missing.carbs', { value: rounded(recipe.carbs) }),
  };
}

function maxPrep(limit: number, label: string, key: ConditionKey): RecipeCondition {
  return {
    key,
    label,
    matches: recipe => amount(recipe.prep_time) > 0 && amount(recipe.prep_time) <= limit,
    miss: recipe => amount(recipe.prep_time) > 0
      ? t('recipes.missing.prepTime', { value: rounded(recipe.prep_time) })
      : t('recipes.missing.noPrepTime'),
  };
}

function presetLabel(preset: QuickPreset): string {
  return t(`recipes.filters.quick.${preset}` as MessageKey);
}

function presetCondition(preset: QuickPreset): RecipeCondition {
  const label = presetLabel(preset);
  if (preset === 'quick') return maxPrep(QUICK_PREP_MINUTES, label, preset);
  if (preset === 'highprotein') return minProtein(HIGH_PROTEIN_GRAMS, label, preset);
  if (preset === 'lowcarb') return maxCarbs(LOW_CARB_GRAMS, label, preset);
  if (preset === 'lowcal') return maxKcal(LOW_KCAL, label, preset);
  return {
    key: preset,
    label,
    matches: recipe => amount(recipe.fat) <= LOW_FAT_GRAMS,
    miss: recipe => t('recipes.missing.fat', { value: rounded(recipe.fat) }),
  };
}

export function prepTimeLabel(value: PrepTimeFilter): string {
  return value === 'long' ? t('recipes.filters.prepTimeLong') : t('recipes.filters.prepTimeUpTo', { count: value });
}

export function filterConditions(filters: RecipeFilters): RecipeCondition[] {
  const conditions = filters.quick.map(presetCondition);
  if (filters.maxKcal !== '') {
    conditions.push(maxKcal(filters.maxKcal, t('recipes.filters.kcalChip', { value: filters.maxKcal }), 'maxKcal'));
  }
  if (filters.minProtein !== '') {
    conditions.push(minProtein(filters.minProtein, t('recipes.filters.proteinChip', { value: filters.minProtein }), 'minProtein'));
  }
  if (filters.maxCarbs !== '') {
    conditions.push(maxCarbs(filters.maxCarbs, t('recipes.filters.carbsChip', { value: filters.maxCarbs }), 'maxCarbs'));
  }
  if (filters.maxPrepTime === 'long') {
    conditions.push({
      key: 'maxPrepTime',
      label: prepTimeLabel('long'),
      matches: recipe => amount(recipe.prep_time) >= LONG_PREP_MINUTES,
      miss: recipe => amount(recipe.prep_time) > 0
        ? t('recipes.missing.prepTimeShort', { value: rounded(recipe.prep_time) })
        : t('recipes.missing.noPrepTime'),
    });
  } else if (filters.maxPrepTime !== '') {
    conditions.push(maxPrep(filters.maxPrepTime, prepTimeLabel(filters.maxPrepTime), 'maxPrepTime'));
  }
  return conditions;
}

export function searchCondition(query: string): RecipeCondition | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  return {
    key: 'search',
    label: t('recipes.searchChip', { query: query.trim() }),
    matches: recipe => String(recipe.name ?? '').toLowerCase().includes(needle),
    miss: () => '',
  };
}

export function sheetFilterCount(filters: RecipeFilters): number {
  return [filters.maxKcal, filters.minProtein, filters.maxCarbs, filters.maxPrepTime].filter(value => value !== '').length;
}

export function withoutCondition(filters: RecipeFilters, key: ConditionKey): RecipeFilters {
  if (key === 'search') return filters;
  if (key === 'maxKcal' || key === 'minProtein' || key === 'maxCarbs' || key === 'maxPrepTime') {
    return { ...filters, [key]: '' };
  }
  return { ...filters, quick: filters.quick.filter(preset => preset !== key) };
}

export function toggleQuickPreset(filters: RecipeFilters, preset: QuickPreset): RecipeFilters {
  const quick = filters.quick.includes(preset)
    ? filters.quick.filter(value => value !== preset)
    : [...filters.quick, preset];
  return { ...filters, quick };
}

export function matchingRecipes<R extends FilterableRecipe>(recipes: R[], conditions: RecipeCondition[]): R[] {
  return recipes.filter(recipe => conditions.every(condition => condition.matches(recipe)));
}

export function nearMatches<R extends FilterableRecipe>(
  recipes: R[],
  conditions: RecipeCondition[],
  search: RecipeCondition | null,
  limit: number,
): NearMatch<R>[] {
  if (conditions.length < 2 && !(search && conditions.length === 1)) return [];
  const result: NearMatch<R>[] = [];
  for (const recipe of recipes) {
    if (search && !search.matches(recipe)) continue;
    const failed = conditions.filter(condition => !condition.matches(recipe));
    if (failed.length !== 1) continue;
    result.push({ recipe, miss: failed[0].miss(recipe) });
    if (result.length === limit) break;
  }
  return result;
}

function byName(a: FilterableRecipe, b: FilterableRecipe): number {
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pl', { sensitivity: 'base' });
}

export function sortRecipes<R extends FilterableRecipe>(recipes: R[], sort: RecipeSort, recentIds: string[]): R[] {
  const list = [...recipes];
  if (sort === 'kcal') return list.sort((a, b) => amount(a.kcal) - amount(b.kcal) || byName(a, b));
  if (sort === 'protein') return list.sort((a, b) => amount(b.protein) - amount(a.protein) || byName(a, b));
  if (sort === 'name') return list.sort(byName);
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  const position = (recipe: R) => rank.get(String(recipe.id)) ?? Number.MAX_SAFE_INTEGER;
  return list.sort((a, b) => position(a) - position(b) || byName(a, b));
}
