import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { macroRingBackground } from '../lib/macroColors';
import { NutritionSummary } from './NutritionSummary';

afterEach(cleanup);

const values = { kcal: 250, protein: 10, fat: 10, carbs: 10.25 };

function renderSummary() {
  render(
    <NutritionSummary
      title="Wartości odżywcze: 100 g"
      values={values}
      tableColumns={[{ label: '100 g', values: { ...values, sugars: 4 } }]}
    />
  );
}

describe('NutritionSummary', () => {
  it('shows calories and macro rings filled by the share of calories', () => {
    renderSummary();

    expect(screen.getByRole('heading', { name: 'Wartości odżywcze: 100 g' })).toBeTruthy();
    expect(screen.getByTestId('kcal-value').textContent).toBe('250');
    expect(screen.getByTestId('protein-value').textContent).toBe('10g');
    expect(screen.getByTestId('carbs-value').textContent).toBe('10.3g');
    for (const label of ['kcal', 'Białko', 'Tłuszcz', 'Węgle']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId('fat-ring').style.background).toBe(macroRingBackground('fat', 53));
    expect(screen.getByTestId('protein-ring').style.background).toBe(macroRingBackground('protein', 23));
  });

  it('opens and closes the full table under the carbs ring', () => {
    renderSummary();
    expect(screen.queryByRole('table')).toBeNull();

    const toggle = screen.getByRole('button', { name: t('nutrients.showTable', { value: '10.3g' }) });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')?.querySelector('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '100 g' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Cukry' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('nutrients.hideTable', { value: '10.3g' }) }));
    expect(screen.queryByRole('table')).toBeNull();
  });
});
