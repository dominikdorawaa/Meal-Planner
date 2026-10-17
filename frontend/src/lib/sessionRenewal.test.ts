import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredUser, getToken } from './apiClient';
import { RENEWAL_INTERVAL_MS, startSessionRenewal } from './sessionRenewal';

const fetchMock = vi.fn();
let currentTime = 0;
let stop: (() => void) | undefined;

function renewedSession(token: string) {
  return new Response(JSON.stringify({
    token, user_id: 'user-1', email: 'alice@example.com', name: 'Alice', role: 'USER',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function start() {
  stop = startSessionRenewal(() => currentTime);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  currentTime = 1_000_000;
});

afterEach(() => {
  stop?.();
  stop = undefined;
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('startSessionRenewal', () => {
  it('silently stores a renewed token when a signed-in user opens the app', async () => {
    localStorage.setItem('mp_auth_token', 'old-token');
    fetchMock.mockResolvedValue(renewedSession('new-token'));

    start();

    await vi.waitFor(() => expect(getToken()).toBe('new-token'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/auth/refresh');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer old-token');
    expect(getStoredUser()?.name).toBe('Alice');
  });

  it('does nothing when nobody is signed in', () => {
    start();
    setVisibility('visible');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the user to the login screen when the token has expired', async () => {
    localStorage.setItem('mp_auth_token', 'expired-token');
    localStorage.setItem('mp_auth_user', JSON.stringify({ userId: 'user-1' }));
    const listener = vi.fn();
    window.addEventListener('auth-change', listener);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }));

    start();

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    window.removeEventListener('auth-change', listener);
  });

  it('renews again when the app returns to the foreground after the renewal interval', async () => {
    localStorage.setItem('mp_auth_token', 'old-token');
    fetchMock.mockImplementation(() => Promise.resolve(renewedSession('new-token')));
    start();
    await vi.waitFor(() => expect(getToken()).toBe('new-token'));

    currentTime += RENEWAL_INTERVAL_MS - 1;
    setVisibility('visible');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    currentTime += 1;
    setVisibility('hidden');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the session and retries on the next foreground after a network failure', async () => {
    localStorage.setItem('mp_auth_token', 'old-token');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(renewedSession('new-token'));

    start();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(getToken()).toBe('old-token');

    await vi.waitFor(() => {
      setVisibility('visible');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(() => expect(getToken()).toBe('new-token'));
  });

  it('stops listening for the app returning to the foreground', async () => {
    localStorage.setItem('mp_auth_token', 'old-token');
    fetchMock.mockImplementation(() => Promise.resolve(renewedSession('new-token')));
    start();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    stop?.();
    currentTime += RENEWAL_INTERVAL_MS;
    setVisibility('visible');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
