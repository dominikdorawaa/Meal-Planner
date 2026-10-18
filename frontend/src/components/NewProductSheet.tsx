import { useMemo, useState } from 'react';
import { api, type Product } from '../lib/apiClient';
import type { ProductPrefill } from '../lib/barcodeLookup';
import { useBottomSheet } from '../lib/bottomSheet';
import { EXTRA_NUTRIENTS, extraNutrientInputs, type ExtraNutrientValues } from '../lib/nutrients';
import { checkNutrition, formNutritionHints, nutritionIssueMessageKey, parseNutritionValue } from '../lib/nutritionCheck';
import { isValidPackageWeight } from '../lib/packageWeight';
import { useExistingBarCodeProduct } from '../lib/useExistingBarCodeProduct';
import { t } from '../i18n';
import { BarCodeField } from './BarCodeField';
import { MoreNutrientsFields } from './MoreNutrientsFields';

export interface NewProductDraft {
  name?: string;
  barCode?: string;
  prefill?: ProductPrefill | null;
  message?: string | null;
}

interface NewProductSheetProps {
  draft: NewProductDraft;
  onClose: () => void;
  onCreated: (product: Product) => void;
  productHref?: (product: Product) => string;
  onOpenProduct?: (product: Product) => void;
}

function text(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function formFrom({ name, barCode, prefill }: NewProductDraft) {
  return {
    name: text(prefill?.name ?? name),
    brand: text(prefill?.brand),
    kcal: text(prefill?.kcal),
    protein: text(prefill?.protein),
    fat: text(prefill?.fat),
    carbs: text(prefill?.carbs),
    barCode: barCode ?? '',
    packageWeight: text(prefill?.package_weight),
    extras: extraNutrientInputs(prefill ?? {}),
  };
}

export function NewProductSheet({ draft, onClose, onCreated, productHref, onOpenProduct }: NewProductSheetProps) {
  const [form, setForm] = useState(() => formFrom(draft));
  const [scanMessage, setScanMessage] = useState(draft.message ?? null);
  const [creating, setCreating] = useState(false);

  const values = useMemo(() => ({
    name: form.name.trim(),
    kcal: parseNutritionValue(form.kcal),
    protein: parseNutritionValue(form.protein),
    fat: parseNutritionValue(form.fat),
    carbs: parseNutritionValue(form.carbs),
    barCode: form.barCode || null,
    packageWeight: parseNutritionValue(form.packageWeight),
    extras: Object.fromEntries(EXTRA_NUTRIENTS.map(nutrient =>
      [nutrient, parseNutritionValue(form.extras[nutrient])])) as ExtraNutrientValues,
  }), [form]);
  const check = useMemo(() => checkNutrition(values), [values]);
  const packageWeightValid = isValidPackageWeight(values.packageWeight);
  const nutrientsStarted = [form.kcal, form.protein, form.fat, form.carbs].some(value => value.trim() !== '');
  const hints = formNutritionHints(check, nutrientsStarted);
  const existingBarCode = useExistingBarCodeProduct(form.barCode);
  const barCodeBlocksSaving = existingBarCode.checking || existingBarCode.product !== null;
  const sheetRef = useBottomSheet(true, onClose);

  const handleCreate = async () => {
    if (!check.valid || !packageWeightValid || barCodeBlocksSaving) return;
    setCreating(true);
    try {
      const product = await api.products.create({
        name: values.name,
        kcal: values.kcal,
        protein: values.protein,
        fat: values.fat,
        carbs: values.carbs,
        ...values.extras,
        bar_code: values.barCode,
        package_weight: values.packageWeight,
        brand: form.brand.trim() || null,
        unit: '100g',
      });
      onCreated(product);
    } catch (err) {
      alert(`Błąd przy tworzeniu produktu: ${err instanceof Error ? err.message : String(err)}`);
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => onClose()}>
      <div ref={sheetRef} className="bg-surface-container-lowest rounded-t-[32px] p-6 pb-8 max-h-[92vh] overflow-y-auto animate-slide-up w-full max-w-xl mx-auto shadow-[0_-8px_30px_rgb(0,0,0,0.1)] relative" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">grocery</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface leading-tight">Nowy produkt</h2>
              <span className="text-[11px] font-medium text-on-surface-variant">wartości na 100g</span>
            </div>
          </div>
          <button onClick={() => onClose()} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors active:scale-90">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          {scanMessage && (
            <p className="rounded-xl px-3 py-2.5 text-xs font-medium bg-primary/10 text-on-surface">{scanMessage}</p>
          )}
          <BarCodeField
            value={form.barCode}
            onChange={barCode => {
              if (barCode !== form.barCode) setScanMessage(null);
              setForm(p => ({ ...p, barCode }));
            }}
            existingProduct={existingBarCode.product}
            productHref={productHref}
            onOpenProduct={onOpenProduct}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">Nazwa *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-surface-container-low border-none rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder="np. Jogurt naturalny"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">Marka / producent</label>
            <input
              type="text"
              value={form.brand}
              onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
              className="w-full bg-surface-container-low border-none rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder="np. Piątnica"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">Kalorie (kcal) *</label>
            <div className="relative flex items-center rounded-2xl overflow-hidden bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/30">
              <input
                type="number" min="0"
                onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                value={form.kcal}
                onChange={e => setForm(p => ({ ...p, kcal: e.target.value }))}
                className="flex-1 bg-transparent py-4 pl-4 pr-16 outline-none text-on-surface font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
              />
              <span className="absolute right-4 text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest bg-surface-container-highest/60 px-2 py-1.5 rounded-md">kcal</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'protein', label: 'Białko *' },
              { key: 'carbs', label: 'Węgle *' },
              { key: 'fat', label: 'Tłuszcz *' },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest leading-none truncate">{f.label}</label>
                <div className="relative flex items-center rounded-xl overflow-hidden bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/30">
                  <input
                    type="number" min="0"
                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                    value={form[f.key as 'protein' | 'carbs' | 'fat']}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="flex-1 w-full bg-transparent py-3 pl-3 pr-8 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <span className="absolute right-3 text-[10px] font-black text-on-surface-variant/50 uppercase">g</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-product-package-weight" className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">{t('product.packageWeight')}</label>
            <div className="relative flex items-center rounded-2xl overflow-hidden bg-surface-container-low focus-within:ring-2 focus-within:ring-primary/30">
              <input
                id="new-product-package-weight"
                type="number" min="0" inputMode="decimal"
                onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                value={form.packageWeight}
                onChange={e => setForm(p => ({ ...p, packageWeight: e.target.value }))}
                aria-invalid={!packageWeightValid}
                className="flex-1 bg-transparent py-3.5 pl-4 pr-12 outline-none text-on-surface font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:font-medium placeholder:text-on-surface-variant/40"
                placeholder="np. 450"
              />
              <span className="absolute right-4 text-[10px] font-black text-on-surface-variant/50 uppercase">g</span>
            </div>
            {!packageWeightValid && (
              <p className="rounded-xl px-3 py-2.5 text-xs font-medium bg-error/10 text-error">{t('product.packageWeightInvalid')}</p>
            )}
          </div>

          <MoreNutrientsFields
            values={form.extras}
            onChange={(nutrient, value) => setForm(p => ({ ...p, extras: { ...p.extras, [nutrient]: value } }))}
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
          disabled={creating || !check.valid || !packageWeightValid || barCodeBlocksSaving}
          className="w-full py-4 bg-primary text-on-primary font-black text-sm rounded-2xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
        >
          {creating ? (
            <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Dodaj produkt
            </>
          )}
        </button>
      </div>
    </div>
  );
}
