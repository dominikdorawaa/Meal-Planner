import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoreNutrientsFields, type ExtraNutrientInputs } from './MoreNutrientsFields';

const EMPTY: ExtraNutrientInputs = { saturated_fat: '', sugars: '', fiber: '', salt: '' };

afterEach(cleanup);

describe('MoreNutrientsFields', () => {
  it('starts folded and opens on demand', () => {
    const onChange = vi.fn();
    render(<MoreNutrientsFields values={EMPTY} onChange={onChange} />);
    const toggle = screen.getByRole('button', { name: 'Więcej wartości' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Sól')).toBeNull();

    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText('Sól'), { target: { value: '0.5' } });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(onChange).toHaveBeenCalledWith('salt', '0.5');
  });

  it('starts open when a value is already filled in', () => {
    render(<MoreNutrientsFields values={{ ...EMPTY, sugars: '4' }} onChange={vi.fn()} />);

    expect((screen.getByLabelText('Cukry') as HTMLInputElement).value).toBe('4');
  });

  it('blocks characters that are not part of a plain number', () => {
    render(<MoreNutrientsFields values={{ ...EMPTY, fiber: '1' }} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Błonnik');

    expect(fireEvent.keyDown(input, { key: '-' })).toBe(false);
    expect(fireEvent.keyDown(input, { key: '1' })).toBe(true);
  });

  it('does not accept values above 100 g', () => {
    const onChange = vi.fn();
    render(<MoreNutrientsFields values={{ ...EMPTY, salt: '1' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Sól'), { target: { value: '100.01' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Sól'), { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith('salt', '100');
  });

  it('accepts larger values when the limits do not apply', () => {
    const onChange = vi.fn();
    render(<MoreNutrientsFields values={{ ...EMPTY, salt: '1' }} onChange={onChange} limited={false} />);

    fireEvent.change(screen.getByLabelText('Sól'), { target: { value: '150' } });
    expect(onChange).toHaveBeenCalledWith('salt', '150');
  });
});
