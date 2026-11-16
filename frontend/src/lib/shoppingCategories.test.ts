import { describe, expect, it } from 'vitest';
import { formatShoppingAmount, groupByShoppingCategory, shoppingCategoryId } from './shoppingCategories';

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
      { ingredient_name: 'Papier' },
      { ingredient_name: 'Mleko' },
      { ingredient_name: 'Banan' },
      { ingredient_name: 'Jogurt' },
    ]);

    expect(groups.map(group => group.category.id)).toEqual(['produce', 'dairy', 'other']);
    expect(groups[1].items.map(item => item.ingredient_name)).toEqual(['Mleko', 'Jogurt']);
  });
});

describe('formatShoppingAmount', () => {
  it('rounds weights and volumes to whole numbers and keeps fractions of pieces', () => {
    expect(formatShoppingAmount(134.25, 'g')).toBe('134');
    expect(formatShoppingAmount(199.5, ' ML ')).toBe('200');
    expect(formatShoppingAmount(1.255, 'szt')).toBe('1.25');
    expect(formatShoppingAmount(2, null)).toBe('2');
  });
});
