import { useMemo, useState } from 'react';
import { api, type Product } from '../lib/apiClient';
import type { ProductPrefill } from '../lib/barcodeLookup';
import { useBottomSheet } from '../lib/bottomSheet';
import { EXTRA_NUTRIENTS, extraNutrientInputs, measureUnit, type ExtraNutrientValues } from '../lib/nutrients';
import { checkNutrition, formNutritionHints, nutritionIssueMessageKey, parseNutritionValue } from '../lib/nutritionCheck';
import { PACKAGE_CODE, isBaseMeasure } from '../lib/measures';
import { useExistingBarCodeProduct } from '../lib/useExistingBarCodeProduct';
import { t, type MessageKey } from '../i18n';
import { BarCodeField, type ExistingProductAction } from './BarCodeField';
import { MoreNutrientsFields } from './MoreNutrientsFields';
import { MeasuresField } from './MeasuresField';
import { isEmptyMeasure, isValidMeasure, useMeasureKinds, type MeasureInput } from '../lib/measureInputs';
import { NUTRITION_DECIMALS, NUTRITION_LIMITS, acceptsLimitedNumber, numberFieldProps } from '../lib/inputLimits';

const PER_PIECE_UNIT = 'pc';

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

const MODE_TEXTS: Record<ProductFormMode, { title: MessageKey; submit: MessageKey; icon: string }> = {
  create: { title: 'productForm.newTitle', submit: 'productForm.create', icon: 'add_circle' },
  edit: { title: 'productForm.editTitle', submit: 'productForm.saveChanges', icon: 'save' },
  ownVersion: { title: 'productForm.ownVersionTitle', submit: 'productForm.saveOwnVersion', icon: 'content_copy' },
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
  const unit = source?.unit ?? '100g';
  const [form, setForm] = useState(() => formFrom(draft, unit));
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
  const sheetRef = useBottomSheet(true, onClose);
  const per100 = unit !== PER_PIECE_UNIT;
  const nutrientLimit = (nutrient: keyof typeof NUTRITION_LIMITS) => per100 ? NUTRITION_LIMITS[nutrient] : Number.MAX_SAFE_INTEGER;
  const setLimited = (field: 'kcal' | 'protein' | 'carbs' | 'fat', value: string) => {
    if (acceptsLimitedNumber(value, nutrientLimit(field), NUTRITION_DECIMALS)) setForm(p => ({ ...p, [field]: value }));
  };

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
    <div data-scroll-lock className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => onClose()}>
      <div ref={sheetRef} className="bg-surface-container-lowest rounded-t-[32px] p-6 pb-8 max-h-[92vh] overflow-y-auto animate-slide-up w-full max-w-xl mx-auto shadow-[0_-8px_30px_rgb(0,0,0,0.1)] relative" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">grocery</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface leading-tight">{t(texts.title)}</h2>
              <span className="text-[11px] font-medium text-on-surface-variant">{t('productForm.per100')}</span>
            </div>
          </div>
          <button onClick={() => onClose()} aria-label={t('productForm.close')} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors active:scale-90">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          {scanMessage && (
            <p className="rounded-xl px-3 py-2.5 text-xs font-medium bg-primary/10 text-on-surface">{scanMessage}</p>
          )}
          {mode === 'ownVersion' && (
            <p className="rounded-xl px-3 py-2.5 text-xs font-medium bg-primary/10 text-on-surface">{t('productForm.ownVersionHint')}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-form-name" className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">{t('productForm.name')}</label>
            <input
              id="product-form-name"
              type="text"
              autoComplete="off"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-surface-container-low border-none rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder={t('productForm.namePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">{t('productForm.brand')}</label>
            <input
              type="text"
              autoComplete="off"
              aria-label={t('productForm.brand')}
              value={form.brand}
              onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
              className="w-full bg-surface-container-low border-none rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder={t('productForm.brandPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">{t('productForm.kcal')}</label>
            <div className="relative flex items-center rounded-2xl overflow-hidden bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/30">
              <input
                {...numberFieldProps(nutrientLimit('kcal'), NUTRITION_DECIMALS)}
                aria-label={t('productForm.kcal')}
                onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                value={form.kcal}
                onChange={e => setLimited('kcal', e.target.value)}
                className="flex-1 bg-transparent py-4 pl-4 pr-16 outline-none text-on-surface font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
              />
              <span className="absolute right-4 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest bg-surface-container-highest/60 px-2 py-1.5 rounded-md">kcal</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'protein', label: t('productForm.protein') },
              { key: 'carbs', label: t('productForm.carbs') },
              { key: 'fat', label: t('productForm.fat') },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest leading-none truncate">{f.label}</label>
                <div className="relative flex items-center rounded-xl overflow-hidden bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/30">
                  <input
                    {...numberFieldProps(nutrientLimit(f.key as 'protein' | 'carbs' | 'fat'), NUTRITION_DECIMALS)}
                    aria-label={f.label}
                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                    value={form[f.key as 'protein' | 'carbs' | 'fat']}
                    onChange={e => setLimited(f.key as 'protein' | 'carbs' | 'fat', e.target.value)}
                    className="flex-1 w-full bg-transparent py-3 pl-3 pr-8 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <span className="absolute right-3 text-[10px] font-black text-on-surface-variant/50 uppercase">g</span>
                </div>
              </div>
            ))}
          </div>

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
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${check.errors.includes(issue) ? 'bg-error/10 text-error' : 'bg-primary/10 text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[16px] shrink-0">{check.errors.includes(issue) ? 'error' : 'info'}</span>
                  {t(nutritionIssueMessageKey(issue))}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !check.valid || !measuresValid || barCodeBlocksSaving}
          className="w-full py-4 bg-primary text-on-primary font-black text-sm rounded-2xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
        >
          {creating ? (
            <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">{texts.icon}</span>
              {t(texts.submit)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
