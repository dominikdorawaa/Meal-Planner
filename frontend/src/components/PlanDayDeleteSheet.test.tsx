import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlanDayDeleteSheet } from './PlanDayDeleteSheet';

const items = [
  { id: 'meal-1', title: 'Porridge', detail: 'Śniadanie' },
  { id: 'meal-2', title: 'Chicken with rice', detail: 'Obiad' },
  { id: 'meal-3', title: 'Sandwiches', detail: 'Kolacja' },
];

afterEach(() => {
  cleanup();
});

function renderSheet() {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() };
  render(<PlanDayDeleteSheet dayLabel="Dziś" items={items} {...handlers} />);
  return handlers;
}

const checkboxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[];

describe('PlanDayDeleteSheet', () => {
  it('lists every item of the day checked for deletion', () => {
    renderSheet();

    expect(screen.getByRole('alertdialog', { name: 'Co usunąć z planu? Dziś' })).toBeTruthy();
    expect(checkboxes().map(box => box.checked)).toEqual([true, true, true]);
    expect(screen.getByRole('checkbox', { name: /Chicken with rice/ })).toBeTruthy();
  });

  it('deletes only the items that stay checked', () => {
    const { onConfirm } = renderSheet();

    fireEvent.click(checkboxes()[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Usuń 2 pozycje' }));

    expect(onConfirm).toHaveBeenCalledWith(['meal-1', 'meal-3']);
  });

  it('can check an item again', () => {
    const { onConfirm } = renderSheet();

    fireEvent.click(checkboxes()[0]);
    fireEvent.click(checkboxes()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Usuń 3 pozycje' }));

    expect(onConfirm).toHaveBeenCalledWith(['meal-1', 'meal-2', 'meal-3']);
  });

  it('cannot delete when nothing is checked', () => {
    const { onConfirm } = renderSheet();

    checkboxes().forEach(box => fireEvent.click(box));
    const confirm = screen.getByRole('button', { name: 'Usuń' }) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(confirm.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses the singular form for one item', () => {
    renderSheet();

    fireEvent.click(checkboxes()[0]);
    fireEvent.click(checkboxes()[1]);

    expect(screen.getByRole('button', { name: 'Usuń 1 pozycję' })).toBeTruthy();
  });
});
