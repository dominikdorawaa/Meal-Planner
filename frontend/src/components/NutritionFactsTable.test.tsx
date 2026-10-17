import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NutritionFactsTable } from './NutritionFactsTable';

afterEach(cleanup);

describe('NutritionFactsTable', () => {
  it('shows every nutrient per 100 g and per portion', () => {
    render(
      <NutritionFactsTable
        title="Wartości odżywcze"
        columns={[
          { label: '100 g', values: { kcal: 186, fat: 18, saturated_fat: 12, carbs: 3.4, sugars: 3.4, fiber: 0, protein: 2.6, salt: 0.1 } },
          { label: 'Porcja (50 g)', values: { kcal: 93, fat: 9, saturated_fat: 6, carbs: 1.7, sugars: 1.7, fiber: 0, protein: 1.3, salt: 0.05 } },
        ]}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Porcja (50 g)' })).toBeTruthy();
    const saturatedFat = screen.getByRole('row', { name: /Kwasy tłuszczowe nasycone/ });
    expect(within(saturatedFat).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['12 g', '6 g']);
    const salt = screen.getByRole('row', { name: /Sól/ });
    expect(within(salt).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0.1 g', '0.05 g']);
    expect(screen.getAllByRole('row')).toHaveLength(9);
  });

  it('marks missing values and can show only selected nutrients', () => {
    render(
      <NutritionFactsTable title="Więcej" columns={[{ label: '1 porcja', values: { fiber: 2 } }]} facts={['sugars', 'fiber']} />
    );

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(within(screen.getByRole('row', { name: /Cukry/ })).getByRole('cell').textContent).toBe('brak');
    expect(within(screen.getByRole('row', { name: /Błonnik/ })).getByRole('cell').textContent).toBe('2 g');
  });
});
