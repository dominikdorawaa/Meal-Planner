import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n';
import { api } from '../lib/apiClient';
import { AMOUNT_LIMITS, acceptsLimitedNumber } from '../lib/inputLimits';
import { ShoppingSheet } from './ShoppingSheet';
import { SheetSubmit } from './FormSheet';

interface ShoppingAddProductSheetProps {
  onAdded: () => Promise<void> | void;
  onClose: () => void;
}

const FIELD = 'w-full h-12 bg-surface-container rounded-2xl px-4 text-on-surface font-medium text-[15px] outline-hidden focus:ring-2 focus:ring-primary/40 placeholder:text-on-surface-variant/70';
const LABEL = 'block mb-1.5 px-1 text-[13px] font-semibold text-on-surface-variant';

export function ShoppingAddProductSheet({ onAdded, onClose }: ShoppingAddProductSheetProps) {
  const ids = useId();
  const formId = `${ids}-form`;
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState(() => t('shopping.unitPlaceholder'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('shopping.nameRequired'));
      return;
    }
    const amount = parseFloat(quantity.replace(',', '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      setError(t('shopping.quantityInvalid'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.shoppingList.addItem({
        ingredient_name: trimmedName,
        quantity: amount,
        unit: unit.trim() || t('shopping.unitPlaceholder'),
        is_checked: false,
      });
      await onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shopping.addFailed'));
      setSubmitting(false);
    }
  };

  return (
    <ShoppingSheet
      title={t('shopping.addProduct')}
      busy={submitting}
      onClose={onClose}
      footer={<SheetSubmit label={t('shopping.addToList')} busy={submitting} form={formId} />}
    >
      <form
        id={formId}
        className="flex flex-col gap-3.5 pt-1 pb-1"
        onSubmit={event => {
          event.preventDefault();
          if (!submitting) void submit();
        }}
      >
        <div>
          <label htmlFor={`${ids}-name`} className={LABEL}>{t('shopping.name')}</label>
          <input
            ref={nameRef}
            id={`${ids}-name`}
            autoComplete="off"
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('shopping.namePlaceholder')}
            className={FIELD}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <label htmlFor={`${ids}-quantity`} className={LABEL}>{t('shopping.quantity')}</label>
            <input
              id={`${ids}-quantity`}
              autoComplete="off"
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={event => acceptsLimitedNumber(event.target.value, AMOUNT_LIMITS.g) && setQuantity(event.target.value)}
              className={`${FIELD} tabular-nums`}
            />
          </div>
          <div className="w-32 shrink-0">
            <label htmlFor={`${ids}-unit`} className={LABEL}>{t('shopping.unit')}</label>
            <input
              id={`${ids}-unit`}
              autoComplete="off"
              type="text"
              value={unit}
              onChange={event => setUnit(event.target.value)}
              placeholder={t('shopping.unitPlaceholder')}
              className={FIELD}
            />
          </div>
        </div>
        {error && <p role="alert" className="px-1 text-error text-sm font-medium">{error}</p>}
      </form>
    </ShoppingSheet>
  );
}
