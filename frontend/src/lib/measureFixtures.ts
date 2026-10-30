import type { MeasureKind, MeasureNames, ProductMeasure } from './measures';

const NAMES: Record<string, MeasureNames> = {
  piece: { pl: { one: 'sztuka', few: 'sztuki', many: 'sztuk', other: 'sztuki' }, en: { one: 'piece', other: 'pieces' } },
  slice: { pl: { one: 'plasterek', few: 'plasterki', many: 'plasterków', other: 'plasterka' }, en: { one: 'slice', other: 'slices' } },
  tbsp: { pl: { one: 'łyżka', few: 'łyżki', many: 'łyżek', other: 'łyżki' }, en: { one: 'tablespoon', other: 'tablespoons' } },
  tsp: { pl: { one: 'łyżeczka', few: 'łyżeczki', many: 'łyżeczek', other: 'łyżeczki' }, en: { one: 'teaspoon', other: 'teaspoons' } },
  cup: { pl: { one: 'szklanka', few: 'szklanki', many: 'szklanek', other: 'szklanki' }, en: { one: 'cup', other: 'cups' } },
  pinch: { pl: { one: 'szczypta', few: 'szczypty', many: 'szczypt', other: 'szczypty' }, en: { one: 'pinch', other: 'pinches' } },
  package: { pl: { one: 'opakowanie', few: 'opakowania', many: 'opakowań', other: 'opakowania' }, en: { one: 'package', other: 'packages' } },
};

const ORDER = ['piece', 'slice', 'tbsp', 'tsp', 'cup', 'package'];

function maxAmount(code: string): number {
  return code === 'cup' ? 50 : 100;
}

export const MEASURE_KINDS: MeasureKind[] = ORDER.map((code, index) => ({
  code,
  names: NAMES[code],
  max_amount: maxAmount(code),
  max_base_amount: code === 'package' ? 50000 : 5000,
  sort_order: index + 1,
}));

export function measure(code: string, baseAmount: number, isDefault = false): ProductMeasure {
  return { code, base_amount: baseAmount, default: isDefault, names: NAMES[code], max_amount: maxAmount(code) };
}

export function withMeasures<P extends { unit?: string | null }>(product: P, ...extra: ProductMeasure[]): P & { measures: ProductMeasure[] } {
  const baseIsDefault = !extra.some(item => item.default);
  const base: ProductMeasure = {
    code: product.unit === '100ml' ? 'ml' : 'g',
    base_amount: 1,
    default: baseIsDefault,
    names: null,
    max_amount: 5000,
  };
  const sorted = [...extra.filter(item => item.default), ...extra.filter(item => !item.default)];
  return { ...product, measures: baseIsDefault ? [base, ...sorted] : [...sorted, base] };
}
