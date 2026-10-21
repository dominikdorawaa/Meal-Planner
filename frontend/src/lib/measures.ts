import { getLanguage, t, type Language } from '../i18n';
import { formatCompactNumber } from './compactNumber';
import { AMOUNT_LIMITS } from './inputLimits';

export type MeasureNames = Partial<Record<string, Partial<Record<string, string>>>>;

export interface ProductMeasure {
  code: string;
  base_amount: number;
  default?: boolean;
  names?: MeasureNames | null;
  max_amount: number;
}

export interface MeasureKind {
  code: string;
  names: MeasureNames;
  max_amount: number;
  max_base_amount: number;
  sort_order: number;
}

export interface MeasuredProduct {
  unit?: string | null;
  measures?: ProductMeasure[] | null;
}

export const PIECE_CODE = 'piece';
export const PACKAGE_CODE = 'package';
export const MAX_BASE_AMOUNT = AMOUNT_LIMITS.g;
export const MAX_PACKAGE_BASE_AMOUNT = 50_000;
const MAX_PIECES = AMOUNT_LIMITS.szt;
const PER_PIECE_UNIT = 'pc';
const PER_100_ML_UNIT = '100ml';
const DEFAULT_BASE_AMOUNT = 100;

export function isPerPiece(product: MeasuredProduct): boolean {
  return product.unit === PER_PIECE_UNIT;
}

export function baseMeasureCode(product: MeasuredProduct): string {
  if (isPerPiece(product)) return PIECE_CODE;
  return product.unit === PER_100_ML_UNIT ? 'ml' : 'g';
}

export function isBaseMeasure(product: MeasuredProduct, code: string): boolean {
  return baseMeasureCode(product) === code;
}

function baseMeasure(product: MeasuredProduct): ProductMeasure {
  const perPiece = isPerPiece(product);
  return { code: baseMeasureCode(product), base_amount: 1, default: true, names: null, max_amount: perPiece ? MAX_PIECES : MAX_BASE_AMOUNT };
}

export function productMeasures(product: MeasuredProduct): ProductMeasure[] {
  return product.measures?.length ? product.measures : [baseMeasure(product)];
}

export function findMeasure(product: MeasuredProduct, code: string): ProductMeasure | null {
  return productMeasures(product).find(measure => measure.code === code) ?? null;
}

export function defaultMeasure(product: MeasuredProduct): ProductMeasure {
  const measures = productMeasures(product);
  return measures.find(measure => measure.default) ?? measures[0];
}

export function defaultMeasureAmount(product: MeasuredProduct, code: string): number {
  return isBaseMeasure(product, code) && !isPerPiece(product) ? DEFAULT_BASE_AMOUNT : 1;
}

function namesFor(names: MeasureNames | null | undefined, language: Language) {
  return names?.[language] ?? names?.pl ?? names?.en ?? null;
}

export function measureName(names: MeasureNames | null | undefined, amount: number, language: Language = getLanguage()): string | null {
  const forms = namesFor(names, language);
  if (!forms) return null;
  const category = new Intl.PluralRules(language).select(amount);
  return forms[category] ?? forms.other ?? forms.many ?? forms.one ?? null;
}

export function measureListName(names: MeasureNames | null | undefined, language: Language = getLanguage()): string | null {
  const forms = namesFor(names, language);
  return forms ? forms.few ?? forms.other ?? forms.one ?? null : null;
}

function fallbackLabel(code: string): string {
  if (code === PIECE_CODE || code === 'szt') return t('units.szt');
  if (code === PACKAGE_CODE || code === 'opak') return t('units.opak');
  return code;
}

export function measureLabel(measure: Pick<ProductMeasure, 'code' | 'names'>, amount: number): string {
  return measureName(measure.names, amount) ?? fallbackLabel(measure.code);
}

export function unitLabel(unit: string, amount: number, product?: MeasuredProduct | null): string {
  const measure = product ? findMeasure(product, unit) : null;
  return measure ? measureLabel(measure, amount) : fallbackLabel(unit);
}

const LEGACY_SHOPPING_UNITS: Record<string, string> = { [PIECE_CODE]: 'szt', [PACKAGE_CODE]: 'opak' };

export function shoppingUnit(unit: string, product?: MeasuredProduct | null): string {
  if (unit in LEGACY_SHOPPING_UNITS) return LEGACY_SHOPPING_UNITS[unit];
  const measure = product ? findMeasure(product, unit) : null;
  return (measure && measureListName(measure.names)) ?? unit;
}

export function measureRowLabel(product: MeasuredProduct, measure: ProductMeasure): string {
  if (isBaseMeasure(product, measure.code)) return t(isPerPiece(product) ? 'amount.pieces' : 'amount.grams');
  return t('amount.countOf', { name: measureListName(measure.names) ?? fallbackLabel(measure.code) });
}

export function measureRowUnit(product: MeasuredProduct, measure: ProductMeasure, amount: number): string {
  if (isBaseMeasure(product, measure.code)) return isPerPiece(product) ? t('units.szt') : measure.code;
  const base = `${formatCompactNumber(measure.base_amount, 1)} ${baseMeasureCode(product)}`;
  return t('amount.measureOf', { name: measureLabel(measure, amount), amount: base });
}

export type MeasureValues = Record<string, number | ''>;

export function initialMeasureValues(product: MeasuredProduct, saved?: { amount: number; unit: string } | null): MeasureValues {
  const values: MeasureValues = {};
  for (const measure of productMeasures(product)) values[measure.code] = defaultMeasureAmount(product, measure.code);
  if (saved && saved.unit in values) values[saved.unit] = saved.amount;
  return values;
}

export function measureBaseAmount(product: MeasuredProduct, code: string, amount: number): number | null {
  const measure = findMeasure(product, code);
  return measure ? amount * measure.base_amount : null;
}
