import { useEffect, useState } from 'react';
import type { Product } from './apiClient';
import { findProductByBarCode } from './barcodeLookup';
import { isValidBarCode } from './nutritionCheck';

interface FoundProduct {
  barCode: string;
  product: Product;
}

export function useExistingBarCodeProduct(barCode: string): Product | null {
  const [found, setFound] = useState<FoundProduct | null>(null);
  const checkable = isValidBarCode(barCode);

  useEffect(() => {
    if (!checkable) return;
    let current = true;
    findProductByBarCode(barCode)
      .then(({ product }) => {
        if (current && product) setFound({ barCode, product });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [barCode, checkable]);

  return checkable && found?.barCode === barCode ? found.product : null;
}
