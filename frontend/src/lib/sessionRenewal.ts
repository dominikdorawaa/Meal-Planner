import { api, getToken } from './apiClient';

export const RENEWAL_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function startSessionRenewal(now: () => number = Date.now): () => void {
  let lastRenewalAt = Number.NEGATIVE_INFINITY;

  const renew = () => {
    if (!getToken() || now() - lastRenewalAt < RENEWAL_INTERVAL_MS) return;
    lastRenewalAt = now();
    api.auth.refresh().catch(() => {
      lastRenewalAt = Number.NEGATIVE_INFINITY;
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') renew();
  };

  renew();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}
