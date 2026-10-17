import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AddSelectedBar, SelectionCheckbox } from './PlanSelectionControls';

afterEach(() => {
  cleanup();
});

describe('SelectionCheckbox', () => {
  it('toggles without triggering the row click', () => {
    const onToggle = vi.fn();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <SelectionCheckbox checked={false} label="Owsianka" onToggle={onToggle} />
      </div>
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Zaznacz: Owsianka' });
    expect(checkbox).toHaveProperty('ariaChecked', 'false');
    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('shows the checked state', () => {
    render(<SelectionCheckbox checked label="Owsianka" onToggle={() => {}} />);

    expect(screen.getByRole('checkbox')).toHaveProperty('ariaChecked', 'true');
  });
});

describe('AddSelectedBar', () => {
  it('is hidden when nothing is selected', () => {
    render(<AddSelectedBar count={0} adding={false} onAdd={() => {}} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the count and adds on click', () => {
    const onAdd = vi.fn();
    render(<AddSelectedBar count={3} adding={false} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /Dodaj \(3\)/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('is disabled while adding', () => {
    render(<AddSelectedBar count={2} adding onAdd={() => {}} />);

    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });
});
