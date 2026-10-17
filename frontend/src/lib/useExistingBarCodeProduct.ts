import { useEffect, useState } from 'react';
import type { Product } from './apiClient';
import { findExistingProduct } from './barcodeLookup';
import { isValidBarCode } from './nutritionCheck';

interface CheckedBarCode {
  barCode: string;
  product: Product | null;
}

export interface ExistingBarCodeProduct {
  product: Product | null;
  checking: boolean;
}

export function useExistingBarCodeProduct(barCode: string): ExistingBarCodeProduct {
  const [checked, setChecked] = useState<CheckedBarCode | null>(null);
  const checkable = isValidBarCode(barCode);

  useEffect(() => {
    if (!checkable) return;
    let current = true;
    findExistingProduct(barCode)
      .catch(() => null)
      .then(product => {
        if (current) setChecked({ barCode, product });
      });
    return () => {
      current = false;
    };
  }, [barCode, checkable]);

  if (!checkable) return { product: null, checking: false };
  if (checked?.barCode !== barCode) return { product: null, checking: true };
  return { product: checked.product, checking: false };
}
