import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import {
  checkNutrition,
  formNutritionHints,
  isValidBarCode,
  nutritionIssueMessageKey,
  parseNutritionValue,
  type NutritionIssue,
} from './nutritionCheck';

function check(kcal: number | null, protein: number | null, fat: number | null, carbs: number | null) {
  return checkNutrition({ name: 'Product', kcal, protein, fat, carbs, unit: '100g' });
}

describe('checkNutrition', () => {
  it.each([
    [65, 12, 0, 4.2],
    [900, 0, 100, 0],
    [0, 0, 0, 0],
    [546, 4.9, 31, 61],
    [110, 23, 1.2, 0],
  ])('accepts a realistic product with %s kcal', (kcal, protein, fat, carbs) => {
    expect(check(kcal, protein, fat, carbs)).toEqual({ errors: [], warnings: [], valid: true });
  });

  it('rejects a missing name', () => {
    expect(checkNutrition({ name: ' ', kcal: 65, protein: 12, fat: 0, carbs: 4.2 }).errors).toEqual(['NAME_MISSING']);
    expect(checkNutrition({ kcal: 65, protein: 12, fat: 0, carbs: 4.2 }).errors).toEqual(['NAME_MISSING']);
  });

  it('rejects missing nutrients', () => {
    expect(check(null, 12, 0, 4.2).errors).toEqual(['NUTRIENT_MISSING']);
    expect(check(65, 12, null, 4.2).errors).toEqual(['NUTRIENT_MISSING']);
  });

  it('rejects negative values', () => {
    expect(check(65, -1, 0, 8).errors).toContain('NEGATIVE_VALUE');
  });

  it('rejects values impossible for 100 grams', () => {
    expect(check(950, 0, 105, 0).errors).toEqual(
      expect.arrayContaining(['KCAL_ABOVE_900', 'MACRO_ABOVE_100G', 'MACROS_SUM_ABOVE_100G']),
    );
    expect(check(400, 50, 0, 60).errors).toEqual(['MACROS_SUM_ABOVE_100G']);
    expect(check(888, 0.5, 100, 0.5).errors).toEqual([]);
  });

  it('detects energy given in kilojoules', () => {
    expect(check(1530, 12, 20, 40).errors).toEqual(['KCAL_ABOVE_900', 'KCAL_LOOKS_LIKE_KJ']);
    expect(check(272, 12, 0, 4.2).errors).toEqual(['KCAL_LOOKS_LIKE_KJ']);
  });

  it.each([
    [250, 0, 0, 0],
    [100, 12, 20, 40],
    [380, 10, 2, 5],
    [0, 0, 0, 100],
    [230, 0, 0, 0],
  ])('warns without blocking when %s kcal do not match the macros', (kcal, protein, fat, carbs) => {
    expect(check(kcal, protein, fat, carbs)).toEqual({ errors: [], warnings: ['KCAL_MISMATCH'], valid: true });
  });

  it('warns about a moderate energy deviation without blocking', () => {
    expect(check(450, 10, 10, 60)).toEqual({ errors: [], warnings: ['KCAL_DEVIATION'], valid: true });
  });

  it('skips per 100 gram limits for products counted per piece', () => {
    expect(checkNutrition({ name: 'Pizza', kcal: 1800, protein: 80, fat: 70, carbs: 210, unit: 'pc' }).errors).toEqual([]);
  });

  it('checks the barcode when it is given', () => {
    const product = { name: 'Product', kcal: 65, protein: 12, fat: 0, carbs: 4.2 };
    expect(checkNutrition({ ...product, barCode: '5900820000319' }).errors).toEqual(['INVALID_BAR_CODE']);
    expect(checkNutrition({ ...product, barCode: ' 5900820000318 ' }).errors).toEqual([]);
    expect(checkNutrition({ ...product, barCode: '  ' }).errors).toEqual([]);
  });
});

describe('isValidBarCode', () => {
  it.each(['5900820000318', '5901234123457', '96385074', '036000291452'])('accepts %s', barCode => {
    expect(isValidBarCode(barCode)).toBe(true);
  });

  it.each(['5900820000319', '123', '59008200003a8', '12345678901234567'])('rejects %s', barCode => {
    expect(isValidBarCode(barCode)).toBe(false);
  });
});

describe('parseNutritionValue', () => {
  it('reads numbers with a comma or a dot', () => {
    expect(parseNutritionValue('4,2')).toBe(4.2);
    expect(parseNutritionValue(' 12.5 ')).toBe(12.5);
    expect(parseNutritionValue('0')).toBe(0);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseNutritionValue('')).toBeNull();
    expect(parseNutritionValue('abc')).toBeNull();
  });
});

describe('formNutritionHints', () => {
  it('hides the missing name and missing values before the user enters any value', () => {
    const empty = checkNutrition({ name: '', kcal: null, protein: null, fat: null, carbs: null });

    expect(formNutritionHints(empty, false)).toEqual([]);
  });

  it('tells the user about missing values once they started entering them', () => {
    const oil = checkNutrition({ name: 'Olej', kcal: 900, protein: null, fat: 100, carbs: null });

    expect(formNutritionHints(oil, true)).toEqual(['NUTRIENT_MISSING']);
  });

  it('shows other errors and warnings but never the missing name', () => {
    const noName = checkNutrition({ name: '', kcal: 1000, protein: 0, fat: 100, carbs: 0, unit: '100g' });
    const deviation = check(130, 10, 2, 10);

    expect(formNutritionHints(noName, true)).toEqual(['KCAL_ABOVE_900']);
    expect(formNutritionHints(deviation, true)).toEqual(['KCAL_DEVIATION']);
  });
});

describe('nutritionIssueMessageKey', () => {
  const issues: NutritionIssue[] = [
    'NAME_MISSING', 'NUTRIENT_MISSING', 'NEGATIVE_VALUE', 'KCAL_ABOVE_900', 'MACRO_ABOVE_100G',
    'MACROS_SUM_ABOVE_100G', 'KCAL_LOOKS_LIKE_KJ', 'KCAL_MISMATCH', 'INVALID_BAR_CODE', 'KCAL_DEVIATION',
  ];

  it.each(issues)('has a Polish and an English message for %s', issue => {
    const key = nutritionIssueMessageKey(issue);
    expect(t(key, {}, 'pl')).toBeTruthy();
    expect(t(key, {}, 'en')).toBeTruthy();
  });

  it('builds keys from issue codes', () => {
    expect(nutritionIssueMessageKey('KCAL_LOOKS_LIKE_KJ')).toBe('nutrition.kcal-looks-like-kj');
  });
});
