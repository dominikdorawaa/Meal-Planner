import { useEffect, useRef } from 'react';

interface LoadMoreTriggerProps {
  onLoadMore: () => void;
  loading: boolean;
}

export function LoadMoreTrigger({ onLoadMore, loading }: LoadMoreTriggerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = buttonRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMoreRef.current();
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onLoadMore}
      disabled={loading}
      className="w-full py-3 mt-3 rounded-2xl text-sm font-bold text-primary bg-primary/5 active:scale-[0.98] transition-all disabled:opacity-60"
    >
      {loading ? 'Ładowanie...' : 'Pokaż więcej'}
    </button>
  );
}
