import type { ReactNode } from 'react';
import { t } from '../i18n';
import { FormSheet } from './FormSheet';

interface ShoppingSheetProps {
  title: string;
  hint?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function ShoppingSheet(props: ShoppingSheetProps) {
  return <FormSheet closeLabel={t('shopping.close')} {...props} />;
}

interface ShoppingSheetSubmitProps {
  label: string;
  busy: boolean;
  disabled?: boolean;
  form?: string;
  onClick?: () => void;
}

export function ShoppingSheetSubmit({ label, busy, disabled = false, form, onClick }: ShoppingSheetSubmitProps) {
  return (
    <button
      type={form ? 'submit' : 'button'}
      form={form}
      disabled={busy || disabled}
      onClick={onClick}
      className="w-full h-[52px] rounded-2xl bg-primary text-on-primary font-bold text-[15px] flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50"
    >
      {busy ? <span aria-hidden="true" className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" /> : label}
    </button>
  );
}
