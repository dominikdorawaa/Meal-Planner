import { useCallback, useRef, useState } from 'react';
import type { Product } from './apiClient';
import { findProductByBarCode, type ProductPrefill } from './barcodeLookup';

interface LookupHandlers {
  onFound: (product: Product) => void;
  onMissing: (prefill: ProductPrefill | null) => void;
  onError: () => void;
}

export function useBarcodeLookup() {
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);

  const lookUp = useCallback(async (barCode: string, handlers: LookupHandlers) => {
    const currentRequest = ++requestId.current;
    setPending(true);
    try {
      const { product, prefill } = await findProductByBarCode(barCode);
      if (currentRequest !== requestId.current) return;
      if (product) handlers.onFound(product);
      else handlers.onMissing(prefill);
    } catch {
      if (currentRequest === requestId.current) handlers.onError();
    } finally {
      if (currentRequest === requestId.current) setPending(false);
    }
  }, []);

  const cancel = useCallback(() => {
    requestId.current += 1;
    setPending(false);
  }, []);

  return { pending, lookUp, cancel };
}
