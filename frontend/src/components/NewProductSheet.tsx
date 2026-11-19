import { useMemo, useState } from 'react';
import { api, type Product } from '../lib/apiClient';
import type { ProductPrefill } from '../lib/barcodeLookup';
import { EXTRA_NUTRIENTS, extraNutrientInputs, measureUnit, type ExtraNutrientValues } from '../lib/nutrients';
import { checkNutrition, formNutritionHints, nutritionIssueMessageKey, parseNutritionValue } from '../lib/nutritionCheck';
import { PACKAGE_CODE, isBaseMeasure } from '../lib/measures';
import { useExistingBarCodeProduct } from '../lib/useExistingBarCodeProduct';
import { t, type MessageKey } from '../i18n';
import { BarCodeField, type ExistingProductAction } from './BarCodeField';
import { MoreNutrientsFields } from './MoreNutrientsFields';
import { MeasuresField } from './MeasuresField';
import { isEmptyMeasure, isValidMeasure, useMeasureKinds, type MeasureInput } from '../lib/measureInputs';
import { NUTRITION_DECIMALS, NUTRITION_LIMITS } from '../lib/inputLimits';
import { MacroInputs, UnitInput } from './FormFields';
import { FIELD_CLASS, LABEL_CLASS } from '../lib/formStyles';
import { FormSheet, SheetSubmit } from './FormSheet';
import { FoodPlaceholder } from './FoodPlaceholder';

const PER_PIECE_UNIT = 'pc';
const SELECTABLE_UNITS = ['100g', '100ml'] as const;

export interface NewProductDraft {
  name?: string;
  barCode?: string;
  prefill?: ProductPrefill | null;
  message?: string | null;
}

export type ProductFormMode = 'create' | 'edit' | 'ownVersion';

interface NewProductSheetProps {
  draft: NewProductDraft;
  onClose: () => void;
  onCreated: (product: Product) => void;
  existingProductAction: ExistingProductAction;
  mode?: ProductFormMode;
  source?: Product | null;
}

const MODE_TEXTS: Record<ProductFormMode, { title: MessageKey; submit: MessageKey }> = {
  create: { title: 'productForm.newTitle', submit: 'productForm.create' },
  edit: { title: 'productForm.editTitle', submit: 'productForm.saveChanges' },
  ownVersion: { title: 'productForm.ownVersionTitle', submit: 'productForm.saveOwnVersion' },
};

function inputValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function saveProduct(mode: ProductFormMode, source: Product | null | undefined, data: Record<string, unknown>): Promise<Product> {
  if (mode === 'edit' && source) return api.products.update(source.id, data);
  if (mode === 'ownVersion' && source) return api.products.createOwnVersion(source.id, data);
  return api.products.create(data);
}

function measuresFrom(prefill: ProductPrefill | null | undefined, unit: string): MeasureInput[] {
  if (prefill?.measures?.length) {
    return prefill.measures
      .filter(measure => !isBaseMeasure({ unit }, measure.code))
      .map(measure => ({ code: measure.code, amount: String(measure.base_amount), isDefault: Boolean(measure.default), names: measure.names }));
  }
  return prefill?.package_weight ? [{ code: PACKAGE_CODE, amount: String(prefill.package_weight), isDefault: false }] : [];
}

function formFrom({ name, barCode, prefill }: NewProductDraft, unit: string) {
  return {
    name: inputValue(prefill?.name ?? name),
    brand: inputValue(prefill?.brand),
    kcal: inputValue(prefill?.kcal),
    protein: inputValue(prefill?.protein),
    fat: inputValue(prefill?.fat),
    carbs: inputValue(prefill?.carbs),
    barCode: barCode ?? '',
    measures: measuresFrom(prefill, unit),
    extras: extraNutrientInputs(prefill ?? {}),
  };
}

export function NewProductSheet({ draft, onClose, onCreated, existingProductAction, mode = 'create', source = null }: NewProductSheetProps) {
  const [unit, setUnit] = useState(source?.unit ?? '100g');
  const [form, setForm] = useState(() => formFrom(draft, unit));
  const [initialSnapshot] = useState(() => JSON.stringify([form, unit]));
  const unchangedEdit = mode === 'edit' && JSON.stringify([form, unit]) === initialSnapshot;
  const { kinds, failed: kindsFailed, retry: retryKinds } = useMeasureKinds();
  const [scanMessage, setScanMessage] = useState(draft.message ?? null);
  const [creating, setCreating] = useState(false);

  const values = useMemo(() => ({
    name: form.name.trim(),
    kcal: parseNutritionValue(form.kcal),
    protein: parseNutritionValue(form.protein),
    fat: parseNutritionValue(form.fat),
    carbs: parseNutritionValue(form.carbs),
    barCode: form.barCode || null,
    extras: Object.fromEntries(EXTRA_NUTRIENTS.map(nutrient =>
      [nutrient, parseNutritionValue(form.extras[nutrient])])) as ExtraNutrientValues,
  }), [form]);
  const keepsSourceBarCode = source !== null && mode !== 'create' && form.barCode === (source.bar_code ?? '');
  const inheritsBarCode = keepsSourceBarCode && mode === 'ownVersion';
  const check = useMemo(() => checkNutrition(inheritsBarCode ? { ...values, barCode: null } : values), [values, inheritsBarCode]);
  const measuresValid = form.measures.every(row => isValidMeasure(row, kinds));
  const nutrientsStarted = [form.kcal, form.protein, form.fat, form.carbs].some(value => value.trim() !== '');
  const hints = formNutritionHints(check, nutrientsStarted);
  const existingBarCode = useExistingBarCodeProduct(form.barCode);
  const existingProduct = keepsSourceBarCode || existingBarCode.product?.id === source?.id ? null : existingBarCode.product;
  const barCodeBlocksSaving = !keepsSourceBarCode && (existingBarCode.checking || existingProduct !== null);
  const texts = MODE_TEXTS[mode];
  const per100 = unit !== PER_PIECE_UNIT;
  const nutrientLimit = (nutrient: keyof typeof NUTRITION_LIMITS) => per100 ? NUTRITION_LIMITS[nutrient] : Number.MAX_SAFE_INTEGER;

  const handleCreate = async () => {
    if (!check.valid || !measuresValid || barCodeBlocksSaving) return;
    setCreating(true);
    try {
      const product = await saveProduct(mode, source, {
        name: values.name,
        kcal: values.kcal,
        protein: values.protein,
        fat: values.fat,
        carbs: values.carbs,
        ...values.extras,
        bar_code: values.barCode,
        measures: form.measures.filter(row => !isEmptyMeasure(row)).map(row => ({
          code: row.code,
          base_amount: Number(row.amount.replace(',', '.')),
          default: row.isDefault,
        })),
        brand: form.brand.trim() || null,
        unit,
      });
      onCreated(product);
    } catch (err) {
      alert(t('productForm.saveFailed', { message: err instanceof Error ? err.message : String(err) }));
      setCreating(false);
    }
  };

  return (
    <FormSheet
      title={t(texts.title)}
      hint={per100 ? t('productForm.per100', { unit: measureUnit(unit) }) : t('productForm.perPiece')}
      leading={<FoodPlaceholder kind="product" className="w-12 h-12 rounded-2xl" iconClassName="text-[26px]" />}
      closeLabel={t('productForm.close')}
      busy={creating}
      onClose={onClose}
      footer={
        <SheetSubmit
          label={t(texts.submit)}
          busy={creating}
          disabled={!check.valid || !measuresValid || barCodeBlocksSaving || unchangedEdit}
          onClick={handleCreate}
        />
      }
    >
      <div className="flex flex-col gap-3.5 pt-1 pb-2">
        {scanMessage && (
          <p className="rounded-2xl px-3.5 py-3 text-[13px] font-medium bg-surface-container text-on-surface">{scanMessage}</p>
        )}
        {mode === 'ownVersion' && (
          <p className="rounded-2xl px-3.5 py-3 text-[13px] font-medium bg-surface-container text-on-surface">{t('productForm.ownVersionHint')}</p>
        )}

        <div>
          <label htmlFor="product-form-name" className={LABEL_CLASS}>{t('productForm.name')}</label>
          <input
            id="product-form-name"
            aria-required="true"
            type="text"
            autoComplete="off"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className={FIELD_CLASS}
            placeholder={t('productForm.namePlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="product-form-brand" className={LABEL_CLASS}>{t('productForm.brand')}</label>
          <input
            id="product-form-brand"
            type="text"
            autoComplete="off"
            value={form.brand}
            onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
            className={FIELD_CLASS}
            placeholder={t('productForm.brandPlaceholder')}
          />
        </div>
        {mode === 'create' && (
          <div role="group" aria-label={t('productForm.unit')} className="flex bg-surface-container rounded-full p-[3px]">
            {SELECTABLE_UNITS.map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={unit === option}
                onClick={() => setUnit(option)}
                className={`flex-1 h-[34px] rounded-full text-[13px] font-bold transition-colors ${unit === option ? 'bg-surface-container-highest text-on-surface' : 'text-on-surface-variant'}`}
              >
                {t('nutrients.per100', { unit: measureUnit(option) })}
              </button>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="product-form-kcal" className={LABEL_CLASS}>{t('productForm.kcal')}</label>
          <UnitInput
            id="product-form-kcal"
            aria-required="true"
            unit="kcal"
            size="large"
            value={form.kcal}
            max={nutrientLimit('kcal')}
            decimals={NUTRITION_DECIMALS}
            placeholder="0"
            onValueChange={value => setForm(p => ({ ...p, kcal: value }))}
          />
        </div>
        <MacroInputs
          required
          values={{ protein: form.protein, fat: form.fat, carbs: form.carbs }}
          max={nutrientLimit}
          decimals={NUTRITION_DECIMALS}
          onChange={(macro, value) => setForm(p => ({ ...p, [macro]: value }))}
        />

        {per100 && (
          <MeasuresField
            rows={form.measures}
            baseUnit={measureUnit(unit)}
            kinds={kinds}
            kindsFailed={kindsFailed}
            onRetryKinds={retryKinds}
            onChange={measures => setForm(p => ({ ...p, measures }))}
          />
        )}

        <MoreNutrientsFields
          values={form.extras}
          limited={per100}
          onChange={(nutrient, value) => setForm(p => ({ ...p, extras: { ...p.extras, [nutrient]: value } }))}
        />

        <BarCodeField
          value={form.barCode}
          onChange={barCode => {
            if (barCode !== form.barCode) setScanMessage(null);
            setForm(p => ({ ...p, barCode }));
          }}
          existingProduct={existingProduct}
          existingProductAction={existingProductAction}
        />

        {hints.length > 0 && (
          <ul className="flex flex-col gap-2" aria-live="polite">
            {hints.map(issue => (
              <li
                key={issue}
                className={`flex items-start gap-2 rounded-2xl px-3.5 py-3 text-[13px] font-medium ${check.errors.includes(issue) ? 'bg-error/10 text-error' : 'bg-surface-container text-on-surface'}`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] shrink-0">{check.errors.includes(issue) ? 'error' : 'info'}</span>
                {t(nutritionIssueMessageKey(issue))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSheet>
  );
}
