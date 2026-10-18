import { useState } from 'react';
import type { Product } from '../lib/apiClient';
import { measureUnit, scaleNutritionFacts } from '../lib/nutrients';
import { productDisplayName } from '../lib/productName';
import {
  defaultIngredientAmount,
  ingredientAmountLabel,
  ingredientFactor,
  ingredientMacros,
  ingredientUnits,
  type IngredientUnit,
} from '../lib/recipeIngredient';
import { t } from '../i18n';
import { AmountRow } from './AmountRow';
import { NutritionFactsTable } from './NutritionFactsTable';

interface IngredientAmountScreenProps {
  product: Product;
  initial?: { amount: number; unit: string };
  submitLabel: string;
  onSubmit: (amount: { amount: number; unit: IngredientUnit }) => void;
  onBack: () => void;
}

type AmountValues = Partial<Record<IngredientUnit, number | ''>>;

function initialValues(product: Product, units: IngredientUnit[], initial?: { amount: number; unit: string }): AmountValues {
  const values: AmountValues = {};
  for (const unit of units) values[unit] = unit === defaultIngredientAmount(product).unit ? defaultIngredientAmount(product).amount : 1;
  if (initial && units.includes(initial.unit as IngredientUnit)) values[initial.unit as IngredientUnit] = initial.amount;
  return values;
}

function rowLabel(unit: IngredientUnit, product: Product): { label: string; unit: string } {
  const measure = measureUnit(product.unit);
  if (unit === 'opak') {
    return { label: t('amount.packages'), unit: t('amount.packageOf', { amount: `${product.package_weight} ${measure}` }) };
  }
  if (unit === 'szt') {
    const unitText = product.piece_weight ? t('amount.pieceOf', { amount: `${product.piece_weight} ${measure}` }) : t('units.szt');
    return { label: t('amount.pieces'), unit: unitText };
  }
  return { label: t('amount.grams'), unit };
}

export function IngredientAmountScreen({ product, initial, submitLabel, onSubmit, onBack }: IngredientAmountScreenProps) {
  const units = ingredientUnits(product);
  const [values, setValues] = useState(() => initialValues(product, units, initial));
  const [activeUnit, setActiveUnit] = useState<IngredientUnit>(() =>
    initial && units.includes(initial.unit as IngredientUnit) ? (initial.unit as IngredientUnit) : defaultIngredientAmount(product).unit);
  const amount = Number(values[activeUnit]) || 0;
  const current = { amount, unit: activeUnit, product };
  const perPiece = product.unit === 'pc';

  return (
    <div className="fixed inset-0 z-[110] bg-surface flex flex-col animate-fade-in">
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
          {units.map(unit => {
            const row = rowLabel(unit, product);
            const value = values[unit] ?? '';
            return (
              <AmountRow
                key={unit}
                label={row.label}
                unit={row.unit}
                value={value}
                kcal={ingredientMacros({ amount: Number(value) || 0, unit, product }).kcal}
                active={activeUnit === unit}
                onActivate={() => setActiveUnit(unit)}
                onChange={next => setValues(previous => ({ ...previous, [unit]: next }))}
              />
            );
          })}
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
          disabled={!(amount > 0)}
          className="w-full max-w-xl mx-auto block py-4 bg-primary text-on-primary font-black text-sm rounded-2xl active:scale-95 transition-transform disabled:opacity-50 shadow-sm"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
