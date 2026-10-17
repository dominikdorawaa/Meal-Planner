import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RecipeMoreNutrients } from './RecipeMoreNutrients';

const cream = { unit: '100g', saturated_fat: 12, sugars: 3.4, fiber: 0, salt: 0.1 };

afterEach(cleanup);

describe('RecipeMoreNutrients', () => {
  it('shows the values of one portion when every ingredient has them', () => {
    render(<RecipeMoreNutrients ingredients={[{ amount: 200, unit: 'g', product: cream }]} portions={2} />);

    expect(screen.getByRole('columnheader', { name: '1 porcja' })).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Kwasy tłuszczowe nasycone/ })).getByRole('cell').textContent).toBe('12 g');
    expect(screen.queryByText('niepełne dane')).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'Cukry' }).className).toContain('font-bold');
  });

  it('says the data is incomplete when an ingredient misses values', () => {
    render(<RecipeMoreNutrients ingredients={[{ amount: 200, unit: 'g', product: cream }, { amount: 5, unit: 'g' }]} portions={2} />);

    expect(screen.getByText('niepełne dane')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
