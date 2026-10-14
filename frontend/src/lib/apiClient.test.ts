import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, t } from '../i18n';
import { api, getToken } from './apiClient';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function sentHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers;
}

describe('apiClient', () => {
  it('sends the default Polish language with every request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.products.getAll();

    expect(sentHeaders()['Accept-Language']).toBe('pl');
  });

  it('sends the language chosen by the user', async () => {
    setLanguage('en');
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.products.getAll();

    expect(sentHeaders()['Accept-Language']).toBe('en');
  });

  it('shows the message returned by the backend for a bad request without logging out', async () => {
    localStorage.setItem('mp_auth_token', 'token');
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Invalid email format' }));

    await expect(api.post('/api/meals', {})).rejects.toThrow('Invalid email format');
    expect(getToken()).toBe('token');
  });

  it('shows the message returned by the backend for a server error without logging out', async () => {
    localStorage.setItem('mp_auth_token', 'token');
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'Internal server error.' }));

    await expect(api.get('/api/meals')).rejects.toThrow('Internal server error.');
    expect(getToken()).toBe('token');
  });

  it('uses a translated fallback when the error body is not JSON', async () => {
    setLanguage('en');
    fetchMock.mockResolvedValue(new Response('oops', { status: 502 }));

    await expect(api.get('/api/meals')).rejects.toThrow('Server error (502)');
  });

  it('uses a translated fallback when the error body has no message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    await expect(api.get('/api/meals')).rejects.toThrow(t('api.serverError', { status: 500 }));
  });

  it('logs out and reports an expired session on 401 with a token', async () => {
    localStorage.setItem('mp_auth_token', 'token');
    const listener = vi.fn();
    window.addEventListener('auth-change', listener);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Authentication required.' }));

    await expect(api.get('/api/meals')).rejects.toThrow(t('api.sessionExpired'));
    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('auth-change', listener);
  });

  it('shows the backend message on 401 without a token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Invalid email or password.' }));

    await expect(api.auth.login('alice@example.com', 'wrong')).rejects.toThrow('Invalid email or password.');
  });
});
