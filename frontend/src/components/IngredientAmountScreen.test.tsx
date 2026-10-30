import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../lib/apiClient';
import { t } from '../i18n';
import { measure, withMeasures } from '../lib/measureFixtures';
import { IngredientAmountScreen } from './IngredientAmountScreen';

afterEach(cleanup);

const oil = withMeasures(
  { id: 'p1', name: 'Oliwa', kcal: 900, protein: 0, fat: 100, carbs: 0, saturated_fat: 14, unit: '100ml' },
  measure('tbsp', 15),
) as unknown as Product;

describe('IngredientAmountScreen', () => {
  it('shows the nutrition summary for the chosen amount with the table under the carbs ring', () => {
    const onSubmit = vi.fn();
    render(<IngredientAmountScreen product={oil} initial={{ amount: 2, unit: 'tbsp' }} submitLabel="Zapisz" onSubmit={onSubmit} onBack={() => {}} />);

    expect(screen.getByTestId('kcal-value').textContent).toBe('270');
    expect(screen.getByTestId('fat-value').textContent).toBe('30g');
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('nutrients.showTable', { value: '0g' }) }));
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(headers[1]).toBe('100 ml');
    expect(within(screen.getByRole('row', { name: /Kwasy tłuszczowe nasycone/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['14 g', '4.2 g']);

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(onSubmit).toHaveBeenCalledWith({ amount: 2, unit: 'tbsp' });
  });
});
