import { useState } from 'react';
import type { Product } from '../lib/apiClient';
import { measureUnit } from '../lib/nutrients';
import { productDisplayName } from '../lib/productName';
import { useProductSearch } from '../lib/useProductSearch';
import { t } from '../i18n';
import { LoadMoreTrigger } from './LoadMoreTrigger';

export const MIN_SEARCH_LENGTH = 3;
const NO_FILTERS = {};

interface IngredientSearchProps {
  onClose: () => void;
  onSelect: (product: Product) => void;
  onAddProduct: (name: string) => void;
  onScan: () => void;
}

export function IngredientSearch({ onClose, onSelect, onAddProduct, onScan }: IngredientSearchProps) {
  const [query, setQuery] = useState('');
  const longEnough = query.trim().length >= MIN_SEARCH_LENGTH;
  const search = useProductSearch({ query: query.trim(), filters: NO_FILTERS, enabled: longEnough });
  const items = longEnough && search.current ? search.items : [];
  const settled = longEnough && search.current && !search.loading;

  return (
    <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-fade-in">
      <header className="px-4 py-3 pt-safe-3 flex items-center gap-3 bg-surface border-b border-outline-variant/10">
        <button
          onClick={onClose}
          aria-label={t('recipeIngredients.close')}
          className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform shrink-0"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex-1 relative min-w-0">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-on-surface-variant/60">search</span>
          </div>
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('recipeIngredients.searchPlaceholder')}
            className="w-full bg-surface-container-low border-none rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 text-on-surface text-sm font-medium"
          />
        </div>
        <button
          onClick={onScan}
          aria-label={t('scanner.title')}
          className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/20 transition-colors active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-xl">barcode_scanner</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col w-full max-w-xl mx-auto">
        {!longEnough && (
          <p className="py-8 text-center text-sm font-medium text-on-surface-variant/60">{t('recipeIngredients.minChars')}</p>
        )}

        {items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map(product => (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className="flex items-center text-left bg-surface-container-lowest p-3 rounded-[20px] shadow-sm border border-outline-variant/10 active:scale-[0.98] transition-all"
              >
                <span className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[24px]">nutrition</span>
                </span>
                <span className="flex-1 min-w-0 px-3 font-bold text-[13px] leading-relaxed line-clamp-2">{productDisplayName(product)}</span>
                <span className="flex flex-col items-end shrink-0 pr-1">
                  <span className="text-xs font-black">{product.kcal} kcal</span>
                  <span className="text-[9px] font-bold text-on-surface-variant uppercase">
                    {t('recipeIngredients.per100', { unit: `100 ${measureUnit(product.unit)}` })}
                  </span>
                </span>
              </button>
            ))}
            {search.error && (
              <p className="pt-3 text-center text-sm font-medium text-error">{t('recipeIngredients.loadMoreFailed')}</p>
            )}
            {search.hasNext && <LoadMoreTrigger onLoadMore={search.loadMore} loading={search.loading} />}
          </div>
        )}

        {longEnough && items.length === 0 && !settled && !search.error && (
          <p className="py-8 text-center text-sm font-medium text-on-surface-variant/60">{t('recipeIngredients.searching')}</p>
        )}

        {longEnough && items.length === 0 && search.error && !search.loading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-on-surface-variant/60">{t('recipeIngredients.searchFailed')}</p>
            <button
              type="button"
              onClick={search.reload}
              className="px-5 py-2 rounded-full text-sm font-bold text-primary bg-primary/10 active:scale-95 transition-all"
            >
              {t('recipeIngredients.retry')}
            </button>
          </div>
        )}

        {settled && items.length === 0 && !search.error && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">search_off</span>
            <p className="font-bold text-on-surface-variant text-sm">{t('recipeIngredients.noResults')}</p>
            <div className="flex gap-3 w-full max-w-sm">
              <button
                onClick={() => onAddProduct(query.trim())}
                className="flex-1 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-transform"
              >
                {t('recipeIngredients.addProduct')}
              </button>
              <button
                onClick={onScan}
                className="flex-1 py-3 rounded-2xl bg-primary/10 text-primary font-bold text-sm active:scale-95 transition-transform"
              >
                {t('recipeIngredients.scan')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
