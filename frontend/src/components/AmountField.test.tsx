import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { AmountField } from './AmountField';

afterEach(cleanup);

const UNITS = [{ value: 'portion', label: 'Liczba porcji' }, { value: 'g', label: 'Gramy' }];

function renderField(overrides: Partial<Parameters<typeof AmountField>[0]> = {}) {
  const onChange = vi.fn();
  const onUnitChange = vi.fn();
  render(
    <AmountField
      label="Liczba porcji"
      value={1}
      max={50}
      unit="portion"
      unitLabel="porcja"
      units={UNITS}
      note="268 g"
      kcal={465}
      onChange={onChange}
      onUnitChange={onUnitChange}
      {...overrides}
    />
  );
  return { onChange, onUnitChange };
}

describe('AmountField', () => {
  it('shows the amount, its unit, a note and the calories', () => {
    renderField();

    expect((screen.getByLabelText('Liczba porcji') as HTMLInputElement).value).toBe('1');
    expect(screen.getByText('porcja')).toBeTruthy();
    expect(screen.getByText('268 g')).toBeTruthy();
    expect(screen.getByTestId('amount-kcal').textContent).toBe('465');
  });

  it('passes typed amounts within the limit and ignores the rest', () => {
    const { onChange } = renderField();
    const input = screen.getByLabelText('Liczba porcji');

    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '51' } });
    fireEvent.change(input, { target: { value: '1.25' } });

    expect(onChange.mock.calls).toEqual([[2.5], ['']]);
  });

  it('lets the unit be changed from the list', () => {
    const { onUnitChange } = renderField();
    const select = screen.getByLabelText(t('amount.unit')) as HTMLSelectElement;

    expect(Array.from(select.options).map(option => option.textContent)).toEqual(['Liczba porcji', 'Gramy']);
    fireEvent.change(select, { target: { value: 'g' } });

    expect(onUnitChange).toHaveBeenCalledWith('g');
  });

  it('shows a single unit without a list', () => {
    renderField({ units: [{ value: 'g', label: 'g' }], unit: 'g', unitLabel: 'g', note: undefined });

    expect(screen.queryByLabelText(t('amount.unit'))).toBeNull();
    expect(screen.getByText('g')).toBeTruthy();
  });
});
