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
      title="Wartości odżywcze"
      subtitle="100 g"
      values={values}
      macroSplit={values}
      tableColumns={[{ label: '100 g', values: { ...values, sugars: 4 } }]}
    />
  );
}

describe('NutritionSummary', () => {
  it('shows calories and macro rings filled by the share of calories', () => {
    renderSummary();

    expect(screen.getByRole('heading', { name: 'Wartości odżywcze' })).toBeTruthy();
    expect(screen.getByText('100 g')).toBeTruthy();
    expect(screen.getByText('Białko').className).toContain('text-macro-protein');
    expect(screen.getByText('kcal').className).toContain('text-primary');
    expect(screen.getByTestId('kcal-value').textContent).toBe('250');
    expect(screen.getByTestId('protein-value').textContent).toBe('10g');
    expect(screen.getByTestId('carbs-value').textContent).toBe('10.3g');
    for (const label of ['Tłuszcz', 'Węgle']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId('fat-ring').style.background).toBe(macroRingBackground('fat', 53));
    expect(screen.getByTestId('protein-ring').style.background).toBe(macroRingBackground('protein', 23));
  });

  it('splits the rings by the full macros even when the shown grams round to zero', () => {
    render(
      <NutritionSummary
        title="Wartości odżywcze: 0.1 porcji"
        values={{ kcal: 1, protein: 0.1, fat: 0, carbs: 0.1 }}
        macroSplit={{ protein: 1, fat: 0.4, carbs: 1 }}
        tableColumns={[]}
      />
    );

    expect(screen.getByTestId('fat-value').textContent).toBe('0g');
    expect(screen.getByTestId('fat-ring').style.background).toBe(macroRingBackground('fat', 31));
  });

  it('opens and closes the full table from the arrow next to the rings', () => {
    renderSummary();
    expect(screen.queryByRole('table')).toBeNull();

    const toggle = screen.getByRole('button', { name: t('nutrients.showTable') });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')?.querySelector('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '100 g' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Cukry' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('nutrients.hideTable') }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('can put the arrow in the header instead', () => {
    render(
      <NutritionSummary
        title="Wartości odżywcze"
        values={values}
        macroSplit={values}
        tableColumns={[{ label: '100 g', values }]}
        toggle="header"
      />
    );

    const toggle = screen.getByRole('button', { name: t('nutrients.showTable') });
    expect(toggle.parentElement?.querySelector('h2')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.getByRole('table')).toBeTruthy();
  });
});
