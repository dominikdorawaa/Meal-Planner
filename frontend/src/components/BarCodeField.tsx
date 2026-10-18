import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import type { Product } from '../lib/apiClient';
import { normalizeBarCode } from '../lib/barcodeLookup';
import { productDisplayName } from '../lib/productName';
import { LazyBarcodeScanner } from './LazyBarcodeScanner';

interface BarCodeFieldProps {
  value: string;
  onChange: (barCode: string) => void;
  existingProduct: Product | null;
  productHref?: (product: Product) => string;
  onOpenProduct?: (product: Product) => void;
}

export function BarCodeField({ value, onChange, existingProduct, productHref, onOpenProduct }: BarCodeFieldProps) {
  const [scanning, setScanning] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="product-bar-code" className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">
        {t('product.barCode')}
      </label>
      <div className="flex gap-2">
        <input
          id="product-bar-code"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={event => onChange(normalizeBarCode(event.target.value))}
          className="flex-1 min-w-0 bg-surface-container-low border-none rounded-2xl py-3.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm placeholder:font-medium placeholder:text-on-surface-variant/40"
          placeholder="5900000000000"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          aria-label={t('product.scanBarCode')}
          className="w-12 shrink-0 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-xl">photo_camera</span>
        </button>
      </div>
      {existingProduct && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-medium bg-error/10 text-error">
          <span>{t('product.alreadyExists')}</span>
          {onOpenProduct ? (
            <button type="button" onClick={() => onOpenProduct(existingProduct)} className="font-bold underline underline-offset-2 truncate">
              {productDisplayName(existingProduct)}
            </button>
          ) : (
            <Link to={productHref?.(existingProduct) ?? `/product/${existingProduct.id}`} className="font-bold underline underline-offset-2 truncate">
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
