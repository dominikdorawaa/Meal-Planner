import { useId, useState } from 'react';
import { t } from '../i18n';
import type { ShoppingDepartment } from '../lib/shoppingCategories';
import { ShoppingSheet } from './ShoppingSheet';

const MAX_DEPARTMENT_NAME_LENGTH = 40;

interface ShoppingDepartmentSheetProps {
  productName: string;
  current: string;
  departments: ShoppingDepartment[];
  onPick: (departmentId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export function ShoppingDepartmentSheet({ productName, current, departments, onPick, onCreate, onClose }: ShoppingDepartmentSheetProps) {
  const inputId = useId();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('shopping.departmentNameRequired'));
      return;
    }
    if (trimmed.length > MAX_DEPARTMENT_NAME_LENGTH) {
      setError(t('shopping.departmentNameTooLong'));
      return;
    }
    onCreate(trimmed);
  };

  return (
    <ShoppingSheet title={productName} hint={t('shopping.moveHint')} onClose={onClose}>
      <div className="border-t border-outline-variant/10 py-1.5 flex flex-col">
        {departments.map(department => (
          <button
            key={department.id}
            type="button"
            aria-pressed={department.id === current}
            onClick={() => onPick(department.id)}
            className="-mx-2 h-[50px] px-2 rounded-2xl flex items-center gap-4 text-left text-[15px] font-medium text-on-surface hover:bg-surface-container active:bg-surface-container-high transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">{department.icon}</span>
            <span className="flex-1 min-w-0 truncate">{department.label}</span>
            {department.id === current && <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-primary">check</span>}
          </button>
        ))}
      </div>
      <div className="border-t border-outline-variant/10 py-1.5">
        {adding ? (
          <form
            className="pt-1.5"
            onSubmit={event => {
              event.preventDefault();
              submit();
            }}
          >
            <label htmlFor={inputId} className="sr-only">{t('shopping.newDepartmentName')}</label>
            <div className="flex gap-2">
              <input
                id={inputId}
                autoFocus
                autoComplete="off"
                type="text"
                value={name}
                maxLength={MAX_DEPARTMENT_NAME_LENGTH + 10}
                onChange={event => {
                  setName(event.target.value);
                  setError(null);
                }}
                placeholder={t('shopping.newDepartmentPlaceholder')}
                className="flex-1 min-w-0 h-12 bg-surface-container rounded-2xl px-4 text-on-surface font-medium text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-on-surface-variant/70"
              />
              <button type="submit" className="h-12 px-4 shrink-0 rounded-2xl bg-primary text-on-primary font-bold text-[15px] active:scale-[0.98] transition-transform">
                {t('shopping.newDepartmentAdd')}
              </button>
            </div>
            {error && <p role="alert" className="px-1 pt-2 text-error text-[13px] font-medium">{error}</p>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="-mx-2 w-[calc(100%+1rem)] h-[50px] px-2 rounded-2xl flex items-center gap-4 text-left text-[15px] font-medium text-on-surface hover:bg-surface-container active:bg-surface-container-high transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-surface-variant">add</span>
            {t('shopping.newDepartment')}
          </button>
        )}
      </div>
      <p className="pt-1 pb-4 text-[12.5px] text-on-surface-variant">{t('shopping.moveNote')}</p>
    </ShoppingSheet>
  );
}
