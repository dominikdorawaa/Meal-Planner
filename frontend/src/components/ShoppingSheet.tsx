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
