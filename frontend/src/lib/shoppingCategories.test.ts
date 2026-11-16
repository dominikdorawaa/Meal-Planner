import { describe, expect, it } from 'vitest';
import {
  findShoppingDepartmentByLabel,
  formatShoppingAmount,
  groupByShoppingCategory,
  normalizeProductName,
  shoppingCategoryId,
  shoppingDepartmentId,
  shoppingDepartmentList,
  withShoppingAssignment,
} from './shoppingCategories';
import { t } from '../i18n';

describe('shoppingCategoryId', () => {
  it.each([
    ['Pomidory koktajlowe', 'produce'],
    ['Chleb żytni', 'bakery'],
    ['Łosoś filet', 'meat'],
    ['Mleko 2%', 'dairy'],
    ['Makaron penne', 'grains'],
    ['Pesto bazyliowe', 'condiments'],
    ['Papier do pieczenia', 'other'],
    [null, 'other'],
  ] as const)('puts %s in %s', (name, category) => {
    expect(shoppingCategoryId(name)).toBe(category);
  });
});

describe('groupByShoppingCategory', () => {
  it('keeps the department order and skips empty departments', () => {
    const groups = groupByShoppingCategory([
      { ingredient_name: 'Paper towels' },
      { ingredient_name: 'Mleko' },
      { ingredient_name: 'Banan' },
      { ingredient_name: 'Jogurt' },
    ]);

    expect(groups.map(group => group.department.id)).toEqual(['produce', 'dairy', 'other']);
    expect(groups[1].items.map(item => item.ingredient_name)).toEqual(['Mleko', 'Jogurt']);
  });
});

describe('formatShoppingAmount', () => {
  it('rounds weights and volumes to whole numbers and keeps fractions of pieces', () => {
    expect(formatShoppingAmount(134.25, 'g')).toBe('134');
    expect(formatShoppingAmount(199.5, ' ML ')).toBe('200');
    expect(formatShoppingAmount(1.255, 'pcs')).toBe('1.25');
    expect(formatShoppingAmount(2, null)).toBe('2');
  });
});

describe('own departments and remembered assignments', () => {
  const departments = {
    custom: [{ id: 'd1', name: 'Dla psa' }],
    assignments: [{ product_name: 'karma dla psa', department: 'd1' }, { product_name: 'mleko', department: 'missing' }],
  };

  it('normalizes product names like the server', () => {
    expect(normalizeProductName('  Karma   DLA psa ')).toBe('karma dla psa');
    expect(normalizeProductName(undefined)).toBe('');
  });

  it('lists own departments before the other department', () => {
    expect(shoppingDepartmentList(departments).map(department => department.id).slice(-2)).toEqual(['d1', 'other']);
  });

  it('prefers a remembered department and ignores unknown ones', () => {
    expect(shoppingDepartmentId('Karma dla psa', departments)).toBe('d1');
    expect(shoppingDepartmentId('Mleko', departments)).toBe('dairy');
  });

  it('finds departments by their visible name', () => {
    expect(findShoppingDepartmentByLabel(' dla  PSA ', departments)?.id).toBe('d1');
    expect(findShoppingDepartmentByLabel(t('shopping.category.bakery').toUpperCase(), departments)?.id).toBe('bakery');
    expect(findShoppingDepartmentByLabel('Garden', departments)).toBeUndefined();
  });

  it('replaces the remembered department of a product', () => {
    const changed = withShoppingAssignment(departments, ' Karma dla psa', 'other');

    expect(changed.assignments).toEqual([
      { product_name: 'mleko', department: 'missing' },
      { product_name: 'karma dla psa', department: 'other' },
    ]);
  });
});
