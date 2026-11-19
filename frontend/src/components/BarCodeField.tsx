import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import type { Product } from '../lib/apiClient';
import { normalizeBarCode } from '../lib/barcodeLookup';
import { productDisplayName } from '../lib/productName';
import { LazyBarcodeScanner } from './LazyBarcodeScanner';
import { LABEL_CLASS } from '../lib/formFields';

export type ExistingProductAction =
  | { href: (product: Product) => string }
  | { onOpen: (product: Product) => void };

interface BarCodeFieldProps {
  value: string;
  onChange: (barCode: string) => void;
  existingProduct: Product | null;
  existingProductAction: ExistingProductAction;
}

export function BarCodeField({ value, onChange, existingProduct, existingProductAction }: BarCodeFieldProps) {
  const [scanning, setScanning] = useState(false);

  return (
    <div className="flex flex-col">
      <label htmlFor="product-bar-code" className={LABEL_CLASS}>
        {t('product.barCode')}
      </label>
      <div className="relative">
        <input
          id="product-bar-code"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={event => onChange(normalizeBarCode(event.target.value))}
          className="w-full h-12 bg-surface-container rounded-2xl pl-4 pr-14 text-on-surface font-medium text-[15px] tabular-nums outline-hidden border-[1.5px] border-transparent focus:border-primary caret-primary placeholder:text-on-surface-variant/60"
          placeholder="5900000000000"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          aria-label={t('product.scanBarCode')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center active:scale-95 transition-transform"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">barcode_scanner</span>
        </button>
      </div>
      {existingProduct && (
        <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium bg-error/10 text-error">
          <span>{t('product.alreadyExists')}</span>
          {'onOpen' in existingProductAction ? (
            <button type="button" onClick={() => existingProductAction.onOpen(existingProduct)} className="font-bold underline underline-offset-2 truncate">
              {productDisplayName(existingProduct)}
            </button>
          ) : (
            <Link to={existingProductAction.href(existingProduct)} className="font-bold underline underline-offset-2 truncate">
              {productDisplayName(existingProduct)}
            </Link>
          )}
        </div>
      )}
      {scanning && (
        <LazyBarcodeScanner
          onDetected={barCode => {
            setScanning(false);
            onChange(barCode);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
