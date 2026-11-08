import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../lib/apiClient';
import { t } from '../i18n';
import { measure, withGenericMeasures, withMeasures } from '../lib/measureFixtures';
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

  it('saves an ingredient in a kitchen measure the product does not have', () => {
    const flour = withGenericMeasures(withMeasures({ id: 'p2', name: 'Mąka', kcal: 340, protein: 10, fat: 1, carbs: 72, unit: '100g' })) as unknown as Product;
    const onSubmit = vi.fn();
    render(<IngredientAmountScreen product={flour} initial={{ amount: 3, unit: 'tbsp' }} submitLabel="Zapisz" onSubmit={onSubmit} onBack={() => {}} />);

    expect((screen.getByLabelText(t('amount.kitchenMeasure')) as HTMLSelectElement).value).toBe('tbsp');
    expect(screen.getByText(t('product.nutritionFor', { amount: '3 łyżki (45 g)' }))).toBeTruthy();
    expect(screen.getByTestId('kcal-value').textContent).toBe('153');
    expect(screen.queryByText(/niedostępn/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(onSubmit).toHaveBeenCalledWith({ amount: 3, unit: 'tbsp' });
  });

  it('switches an ingredient to its base amount with a single tap on that row', () => {
    const onSubmit = vi.fn();
    render(<IngredientAmountScreen product={oil} initial={{ amount: 2, unit: 'tbsp' }} submitLabel="Zapisz" onSubmit={onSubmit} onBack={() => {}} />);
    const base = screen.getByLabelText(t('amount.grams')) as HTMLInputElement;
    const amount = Number(base.value);

    const choose = screen.getByRole('button', { name: t('amount.chooseRow', { label: t('amount.grams') }) });
    fireEvent.click(choose);
    expect(choose.getAttribute('aria-pressed')).toBe('true');
    expect(base.value).toBe(String(amount));

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(onSubmit).toHaveBeenCalledWith({ amount, unit: 'ml' });
  });
});
