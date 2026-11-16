import { t, type MessageKey } from '../i18n';

export type ShoppingCategoryId = 'produce' | 'bakery' | 'meat' | 'dairy' | 'grains' | 'condiments' | 'other';

interface ShoppingCategory {
  id: ShoppingCategoryId;
  labelKey: MessageKey;
  icon: string;
  pattern?: RegExp;
}

export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  {
    id: 'produce',
    labelKey: 'shopping.category.produce',
    icon: 'nutrition',
    pattern: /awokado|sałat|pomidor|owoc|warzyw|szparag|cytryn|mieszanka|fasol|ziemniak|cebul|czosn|jabłk|banan|marchew|papryk|ogórek|brokuł|kalafior|pieczark/,
  },
  { id: 'bakery', labelKey: 'shopping.category.bakery', icon: 'bakery_dining', pattern: /chleb|bułk|bagietk|rogal|tortill|pumpernikiel/ },
  {
    id: 'meat',
    labelKey: 'shopping.category.meat',
    icon: 'set_meal',
    pattern: /kurczak|mięs|indyk|wołow|wieprzow|stek|ryb|łosoś|tuńczyk|krewet|szynk|boczek|kiełbas|parówk/,
  },
  { id: 'dairy', labelKey: 'shopping.category.dairy', icon: 'egg', pattern: /mleko|jaj|białko|ser|parmezan|masło|jogurt|śmietan|kefir|twar|tofu/ },
  { id: 'grains', labelKey: 'shopping.category.grains', icon: 'grain', pattern: /ryż|makaron|kasza|komosa|płatki|mąka|cukier|sól|quinoa|ciecierzyc/ },
  { id: 'condiments', labelKey: 'shopping.category.condiments', icon: 'soup_kitchen', pattern: /oliw|olej|sos|pesto|ketchup|majonez|musztard|pieprz|zioł/ },
  { id: 'other', labelKey: 'shopping.category.other', icon: 'category' },
];

export interface ShoppingDepartments {
  custom: { id: string; name: string }[];
  assignments: { product_name: string; department: string }[];
}

export interface ShoppingDepartment {
  id: string;
  label: string;
  icon: string;
}

export const NO_SHOPPING_DEPARTMENTS: ShoppingDepartments = { custom: [], assignments: [] };

export function normalizeProductName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function shoppingCategoryId(name: string | null | undefined): ShoppingCategoryId {
  const normalized = (name ?? '').toLowerCase();
  return SHOPPING_CATEGORIES.find(category => category.pattern?.test(normalized))?.id ?? 'other';
}

export function shoppingDepartmentList(departments: ShoppingDepartments): ShoppingDepartment[] {
  const builtIn = SHOPPING_CATEGORIES.map(category => ({ id: category.id as string, label: t(category.labelKey), icon: category.icon }));
  const custom = departments.custom.map(department => ({ id: department.id, label: department.name, icon: 'label' }));
  return [...builtIn.slice(0, -1), ...custom, builtIn[builtIn.length - 1]];
}

export function shoppingDepartmentId(name: string | null | undefined, departments: ShoppingDepartments): string {
  const assigned = departments.assignments.find(assignment => assignment.product_name === normalizeProductName(name))?.department;
  const known = assigned && shoppingDepartmentList(departments).some(department => department.id === assigned);
  return known ? assigned : shoppingCategoryId(name);
}

export function findShoppingDepartmentByLabel(label: string, departments: ShoppingDepartments): ShoppingDepartment | undefined {
  const wanted = label.trim().replace(/\s+/g, ' ').toLowerCase();
  return shoppingDepartmentList(departments).find(department => department.label.toLowerCase() === wanted);
}

export function groupByShoppingCategory<T extends { ingredient_name?: string | null }>(
  items: T[],
  departments: ShoppingDepartments = NO_SHOPPING_DEPARTMENTS,
) {
  return shoppingDepartmentList(departments)
    .map(department => ({
      department,
      items: items.filter(item => shoppingDepartmentId(item.ingredient_name, departments) === department.id),
    }))
    .filter(group => group.items.length > 0);
}

export function withShoppingAssignment(departments: ShoppingDepartments, productName: string, department: string): ShoppingDepartments {
  const key = normalizeProductName(productName);
  return {
    ...departments,
    assignments: [...departments.assignments.filter(assignment => assignment.product_name !== key), { product_name: key, department }],
  };
}

export function formatShoppingAmount(amount: number, unit: string | null | undefined): string {
  const normalized = (unit ?? '').toLowerCase().trim();
  if (['g', 'ml', 'kcal', 'mg'].includes(normalized)) return String(Math.round(amount));
  return String(Math.round(amount * 100) / 100);
}
