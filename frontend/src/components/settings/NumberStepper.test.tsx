import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { NumberStepper } from './NumberStepper';

function Harness({ initial = 78, onChange = () => {} }: { initial?: number; onChange?: (value: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      label="Waga"
      value={value}
      onChange={next => {
        onChange(next);
        setValue(next);
      }}
      min={30}
      max={300}
      step={0.5}
      decimals={1}
      unit="kg"
    />
  );
}

afterEach(cleanup);

describe('NumberStepper', () => {
  it('shows the value with a decimal comma and steps it with the buttons', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Waga') as HTMLInputElement;
    expect(input.value).toBe('78,0');
    expect(input.getAttribute('inputmode')).toBe('decimal');

    fireEvent.click(screen.getByRole('button', { name: 'Zwiększ: Waga' }));
    expect(input.value).toBe('78,5');
    fireEvent.click(screen.getByRole('button', { name: 'Zmniejsz: Waga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zmniejsz: Waga' }));
    expect(input.value).toBe('77,5');
  });

  it('accepts a typed value after leaving the field and clamps it to the limits', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Waga') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(30);
    expect(input.value).toBe('30,0');
    expect((screen.getByRole('button', { name: 'Zmniejsz: Waga' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ignores letters, too many decimals and an empty field', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Waga') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.change(input, { target: { value: '70,55' } });
    expect(input.value).toBe('78,0');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('78,0');
  });

  it('disables the plus button at the maximum and recovers from an invalid value', () => {
    render(<Harness initial={300} />);
    expect((screen.getByRole('button', { name: 'Zwiększ: Waga' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    render(<Harness initial={Number.NaN} />);
    expect((screen.getByLabelText('Waga') as HTMLInputElement).value).toBe('30,0');
  });
});
