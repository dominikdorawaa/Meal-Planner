import { useState } from 'react';
import type { Product } from '../lib/apiClient';
import { measureUnit, scaleNutritionFacts } from '../lib/nutrients';
import { productDisplayName } from '../lib/productName';
import {
  defaultIngredientAmount,
  ingredientAmountLabel,
  ingredientFactor,
  supportedIngredientUnit,
  type IngredientQuantity,
  type IngredientUnit,
} from '../lib/recipeIngredient';
import { findMeasure, initialMeasureValues, isPerPiece } from '../lib/measures';
import { t } from '../i18n';
import { isPositiveWithinLimit } from '../lib/inputLimits';
import { NutritionFactsTable } from './NutritionFactsTable';
import { MeasureAmountRows } from './MeasureAmountRows';

interface IngredientAmountScreenProps {
  product: Product;
  initial?: { amount: number; unit: string };
  submitLabel: string;
  onSubmit: (quantity: IngredientQuantity) => void;
  onBack: () => void;
}

function savedQuantity(product: Product, initial?: { amount: number; unit: string }): IngredientQuantity | null {
  const unit = initial ? supportedIngredientUnit(product, initial.unit) : null;
  return initial && unit ? { amount: initial.amount, unit } : null;
}

export function IngredientAmountScreen({ product, initial, submitLabel, onSubmit, onBack }: IngredientAmountScreenProps) {
  const saved = savedQuantity(product, initial);
  const [values, setValues] = useState(() => initialMeasureValues(product, saved));
  const [activeUnit, setActiveUnit] = useState<IngredientUnit>(() => saved?.unit ?? defaultIngredientAmount(product).unit);
  const amount = Number(values[activeUnit]) || 0;
  const current = { amount, unit: activeUnit, product };
  const perPiece = isPerPiece(product);
  const maxAmount = findMeasure(product, activeUnit)?.max_amount ?? 0;

  return (
    <div data-scroll-lock className="fixed inset-0 z-[110] bg-surface flex flex-col animate-fade-in">
      <header className="px-4 py-3 pt-safe-3 flex items-center gap-3 bg-surface-container-lowest border-b border-outline-variant/10">
        <button
          onClick={onBack}
          aria-label={t('recipeIngredients.back')}
          className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="font-headline font-bold text-lg text-on-surface leading-tight line-clamp-2">{productDisplayName(product)}</h2>
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          {initial && !saved && (
            <p className="rounded-xl px-3 py-2.5 text-xs font-medium bg-primary/10 text-on-surface">
              {t('recipeIngredients.unitUnavailable', { amount: ingredientAmountLabel({ amount: initial.amount, unit: initial.unit, product }) })}
            </p>
          )}
          <MeasureAmountRows
            product={product}
            values={values}
            activeCode={activeUnit}
            onActivate={setActiveUnit}
            onChange={(code, next) => setValues(previous => ({ ...previous, [code]: next }))}
          />
        </div>

        <NutritionFactsTable
          title={t('nutrients.productTitle')}
          columns={[
            {
              label: perPiece ? `1 ${t('units.szt')}` : t('nutrients.per100', { unit: measureUnit(product.unit) }),
              values: product,
            },
            {
              label: t('nutrients.perPortion', { amount: ingredientAmountLabel(current) }),
              values: scaleNutritionFacts(product, ingredientFactor(current) ?? 0),
            },
          ]}
        />
      </main>

      <div className="px-4 pt-3 pb-safe-6 bg-surface border-t border-outline-variant/10">
        <button
          onClick={() => onSubmit({ amount, unit: activeUnit })}
          disabled={!isPositiveWithinLimit(amount, maxAmount)}
          className="w-full max-w-xl mx-auto block py-4 bg-primary text-on-primary font-black text-sm rounded-2xl active:scale-95 transition-transform disabled:opacity-50 shadow-sm"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
