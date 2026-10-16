import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Product, type ProductSearchFilters } from './apiClient';

export const PRODUCT_SEARCH_DEBOUNCE_MS = 300;
export const PRODUCT_SEARCH_PAGE_SIZE = 20;

interface ProductSearchOptions {
  query: string;
  filters: ProductSearchFilters;
  enabled: boolean;
}

export function useProductSearch({ query, filters, enabled }: ProductSearchOptions) {
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);
  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(async (pageToLoad: number, append: boolean) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const result = await api.products.search({
        query,
        page: pageToLoad,
        size: PRODUCT_SEARCH_PAGE_SIZE,
        filters: JSON.parse(filtersKey),
      });
      if (currentRequest !== requestId.current) return;
      setItems(previous => (append ? [...previous, ...result.items] : result.items));
      setPage(result.page);
      setHasNext(result.has_next);
    } catch {
      if (currentRequest !== requestId.current) return;
      setError(true);
      setHasNext(false);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [query, filtersKey]);

  useEffect(() => {
    if (!enabled) return;
    const timeoutId = setTimeout(() => fetchPage(0, false), PRODUCT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [enabled, fetchPage, reloadKey]);

  const loadMore = useCallback(() => {
    if (!enabled || loading || !hasNext) return;
    fetchPage(page + 1, true);
  }, [enabled, loading, hasNext, page, fetchPage]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  return { items, hasNext, loading, error, loadMore, reload };
}
