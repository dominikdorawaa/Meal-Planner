import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AmountRow } from './AmountRow';
import { t } from '../i18n';

const LABEL = 'Amount (spoons)';

function renderRow(active = false) {
  const onActivate = vi.fn();
  const onChange = vi.fn();
  render(<AmountRow label={LABEL} max={100} unit="spoon" value={2} kcal={30} active={active} kcalTestId="row-kcal" onActivate={onActivate} onChange={onChange} />);
  return { onActivate, onChange };
}

describe('AmountRow', () => {
  afterEach(cleanup);

  it('chooses its measure with a tap anywhere on the row and leaves the amount alone', () => {
    const { onActivate, onChange } = renderRow();
    const choose = screen.getByRole('button', { name: t('amount.chooseRow', { label: LABEL }) });

    expect(choose.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(choose);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the chosen measure as pressed and highlights its kcal', () => {
    renderRow(true);

    expect(screen.getByRole('button', { name: t('amount.chooseRow', { label: LABEL }) }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('row-kcal').className).toContain('text-primary');
  });

  it('chooses its measure and selects the amount when the field is tapped', () => {
    const { onActivate } = renderRow();
    const input = screen.getByLabelText(LABEL) as HTMLInputElement;
    const select = vi.spyOn(input, 'select');

    input.focus();
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalled();
  });

  it('passes typed amounts within the limit and ignores the rest', () => {
    const { onActivate, onChange } = renderRow();
    const input = screen.getByLabelText(LABEL);

    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '500' } });
    expect(onChange.mock.calls).toEqual([[5], ['']]);
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});
