import { useState } from 'react';
import type { Product } from '../lib/apiClient';
import {
  genericMeasures,
  measureLabel,
  measureRowLabel,
  measureRowUnit,
  measureTotalLabel,
  productMeasures,
  type MeasureValues,
  type ProductMeasure,
} from '../lib/measures';
import { ingredientMacros } from '../lib/recipeIngredient';
import { t } from '../i18n';
import { AmountRow } from './AmountRow';

interface MeasureAmountRowsProps {
  product: Product;
  values: MeasureValues;
  activeCode: string;
  onActivate: (code: string) => void;
  onChange: (code: string, value: number | '') => void;
}

function rowKcal(product: Product, code: string, amount: number): number {
  return ingredientMacros({ amount, unit: code, product }).kcal;
}

interface GenericMeasureRowProps extends MeasureAmountRowsProps {
  measures: ProductMeasure[];
}

function GenericMeasureRow({ product, measures, values, activeCode, onActivate, onChange }: GenericMeasureRowProps) {
  const [chosenCode, setChosenCode] = useState(measures[0].code);
  const measure = measures.find(item => item.code === activeCode) ?? measures.find(item => item.code === chosenCode) ?? measures[0];
  const value = values[measure.code] ?? '';
  const amount = Number(value) || 0;

  const choose = (code: string) => {
    setChosenCode(code);
    onChange(code, value);
    onActivate(code);
  };

  return (
    <AmountRow
      label={measureRowLabel(product, measure)}
      max={measure.max_amount}
      unit={
        <span className="flex items-center gap-1 min-w-0 text-sm font-bold text-on-surface-variant whitespace-nowrap">
          <select
            aria-label={t('amount.kitchenMeasure')}
            value={measure.code}
            onFocus={() => onActivate(measure.code)}
            onChange={event => choose(event.target.value)}
            className="min-w-0 bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-2 px-1.5 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
          >
            {measures.map(item => (
              <option key={item.code} value={item.code}>{measureLabel(item, amount)}</option>
            ))}
          </select>
          <span className="truncate">({measureTotalLabel(product, measure, amount)})</span>
        </span>
      }
      value={value}
      kcal={rowKcal(product, measure.code, amount)}
      active={activeCode === measure.code}
      onActivate={() => onActivate(measure.code)}
      onChange={next => onChange(measure.code, next)}
    />
  );
}

export function MeasureAmountRows(props: MeasureAmountRowsProps) {
  const { product, values, activeCode, onActivate, onChange } = props;
  const generic = genericMeasures(product);
  return (
    <>
      {productMeasures(product).map(measure => {
        const value = values[measure.code] ?? '';
        const amount = Number(value) || 0;
        return (
          <AmountRow
            key={measure.code}
            label={measureRowLabel(product, measure)}
            max={measure.max_amount}
            unit={measureRowUnit(product, measure, amount)}
            value={value}
            kcal={rowKcal(product, measure.code, amount)}
            active={activeCode === measure.code}
            onActivate={() => onActivate(measure.code)}
            onChange={next => onChange(measure.code, next)}
          />
        );
      })}
      {generic.length > 0 && <GenericMeasureRow {...props} measures={generic} />}
    </>
  );
}
