import type { MessageKey } from '../i18n';

export type ShoppingCategoryId = 'produce' | 'bakery' | 'meat' | 'dairy' | 'grains' | 'condiments' | 'other';

interface ShoppingCategory {
  id: ShoppingCategoryId;
  labelKey: MessageKey;
  pattern?: RegExp;
}

export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  {
    id: 'produce',
    labelKey: 'shopping.category.produce',
    pattern: /awokado|sałat|pomidor|owoc|warzyw|szparag|cytryn|mieszanka|fasol|ziemniak|cebul|czosn|jabłk|banan|marchew|papryk|ogórek|brokuł|kalafior|pieczark/,
  },
  { id: 'bakery', labelKey: 'shopping.category.bakery', pattern: /chleb|bułk|bagietk|rogal|tortill|pumpernikiel/ },
  {
    id: 'meat',
    labelKey: 'shopping.category.meat',
    pattern: /kurczak|mięs|indyk|wołow|wieprzow|stek|ryb|łosoś|tuńczyk|krewet|szynk|boczek|kiełbas|parówk/,
  },
  { id: 'dairy', labelKey: 'shopping.category.dairy', pattern: /mleko|jaj|białko|ser|parmezan|masło|jogurt|śmietan|kefir|twar|tofu/ },
  { id: 'grains', labelKey: 'shopping.category.grains', pattern: /ryż|makaron|kasza|komosa|płatki|mąka|cukier|sól|quinoa|ciecierzyc/ },
  { id: 'condiments', labelKey: 'shopping.category.condiments', pattern: /oliw|olej|sos|pesto|ketchup|majonez|musztard|pieprz|zioł/ },
  { id: 'other', labelKey: 'shopping.category.other' },
];

export function shoppingCategoryId(name: string | null | undefined): ShoppingCategoryId {
  const normalized = (name ?? '').toLowerCase();
  return SHOPPING_CATEGORIES.find(category => category.pattern?.test(normalized))?.id ?? 'other';
}

export function groupByShoppingCategory<T extends { ingredient_name?: string | null }>(items: T[]) {
  return SHOPPING_CATEGORIES.map(category => ({
    category,
    items: items.filter(item => shoppingCategoryId(item.ingredient_name) === category.id),
  })).filter(group => group.items.length > 0);
}

export function formatShoppingAmount(amount: number, unit: string | null | undefined): string {
  const normalized = (unit ?? '').toLowerCase().trim();
  if (['g', 'ml', 'kcal', 'mg'].includes(normalized)) return String(Math.round(amount));
  return String(Math.round(amount * 100) / 100);
}
