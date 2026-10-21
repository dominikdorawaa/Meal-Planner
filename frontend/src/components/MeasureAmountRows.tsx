import type { Product } from '../lib/apiClient';
import { measureRowLabel, measureRowUnit, productMeasures, type MeasureValues } from '../lib/measures';
import { ingredientMacros } from '../lib/recipeIngredient';
import { AmountRow } from './AmountRow';

interface MeasureAmountRowsProps {
  product: Product;
  values: MeasureValues;
  activeCode: string;
  onActivate: (code: string) => void;
  onChange: (code: string, value: number | '') => void;
}

export function MeasureAmountRows({ product, values, activeCode, onActivate, onChange }: MeasureAmountRowsProps) {
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
            kcal={ingredientMacros({ amount, unit: measure.code, product }).kcal}
            active={activeCode === measure.code}
            onActivate={() => onActivate(measure.code)}
            onChange={next => onChange(measure.code, next)}
          />
        );
      })}
    </>
  );
}
