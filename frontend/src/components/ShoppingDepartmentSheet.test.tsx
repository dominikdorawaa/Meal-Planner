import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShoppingDepartmentSheet } from './ShoppingDepartmentSheet';
import { t } from '../i18n';

const onCreate = vi.fn();

beforeEach(() => {
  onCreate.mockReset();
  render(
    <ShoppingDepartmentSheet
      productName="Hummus"
      current="other"
      departments={[{ id: 'dairy', label: 'Dairy', icon: 'egg' }, { id: 'other', label: 'Other', icon: 'category' }]}
      onPick={vi.fn()}
      onCreate={onCreate}
      onClose={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: t('shopping.newDepartment') }));
});

afterEach(cleanup);

const field = () => screen.getByLabelText(t('shopping.newDepartmentName'));
const add = () => fireEvent.click(screen.getByRole('button', { name: t('shopping.newDepartmentAdd') }));

describe('ShoppingDepartmentSheet new department', () => {
  it('asks for a name that is not too long', () => {
    add();
    expect(screen.getByRole('alert').textContent).toBe(t('shopping.departmentNameRequired'));

    fireEvent.change(field(), { target: { value: 'x'.repeat(41) } });
    expect(screen.queryByRole('alert')).toBeNull();
    add();
    expect(screen.getByRole('alert').textContent).toBe(t('shopping.departmentNameTooLong'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('creates the department with the trimmed name', () => {
    expect(document.activeElement).toBe(field());
    fireEvent.change(field(), { target: { value: '  Pet food ' } });
    fireEvent.submit(field());

    expect(onCreate).toHaveBeenCalledWith('Pet food');
  });
});
