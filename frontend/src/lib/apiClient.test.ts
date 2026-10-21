import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, t } from '../i18n';
import { api, ApiError, getStoredUser, getToken } from './apiClient';

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

    await api.recipes.getAll();

    expect(sentHeaders()['Accept-Language']).toBe('pl');
  });

  it('sends the language chosen by the user', async () => {
    setLanguage('en');
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.recipes.getAll();

    expect(sentHeaders()['Accept-Language']).toBe('en');
  });

  it('accepts a successful response without a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(api.meals.delete('meal-1')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('accepts a 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.meals.delete('meal-1')).resolves.toBeUndefined();
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

  it('stores the user id and role returned after login', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      token: 'token-1', user_id: 'user-1', email: 'alice@example.com', name: 'Alice', role: 'ADMIN',
    }));

    const user = await api.auth.login('alice@example.com', 'secret123');

    expect(user.userId).toBe('user-1');
    expect(user.role).toBe('ADMIN');
    expect(getStoredUser()?.role).toBe('ADMIN');
  });

  it('searches products with paging and only the filters that are set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], page: 1, size: 20, has_next: false }));

    await api.products.search({
      query: '  zolty ser ',
      page: 1,
      size: 20,
      filters: { maxKcal: '200', minProtein: '', maxFat: undefined, maxCarbs: '30' },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/products/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'zolty ser', page: '1', size: '20', max_kcal: '200', max_carbs: '30',
    });
  });

  it('checks for an existing product without asking Open Food Facts', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'p1' }));

    await expect(api.products.getExistingByBarCode('5900820000318')).resolves.toEqual({ id: 'p1' });

    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/api/products/barcode/5900820000318/existing');
  });

  it('keeps the HTTP status of a failed request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'Nie znaleziono zasobu.' }));

    const error = await api.products.getByBarCode('5900820000318').catch(failure => failure);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Nie znaleziono zasobu.');
    expect(error.body).toEqual({ error: 'Nie znaleziono zasobu.' });
  });

  it('calls the saved, own, own version and measure kind endpoints', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, []));
    const calls: [() => Promise<unknown>, string, string][] = [
      [() => api.products.saved(), 'GET', '/api/products/saved'],
      [() => api.products.own(), 'GET', '/api/products/own'],
      [() => api.products.save('p1'), 'POST', '/api/products/p1/saved'],
      [() => api.products.unsave('p1'), 'DELETE', '/api/products/p1/saved'],
      [() => api.products.update('p1', { name: 'Skyr' }), 'PUT', '/api/products/p1'],
      [() => api.products.createOwnVersion('p1', { name: 'Skyr' }), 'POST', '/api/products/p1/own-version'],
      [() => api.measureKinds.list(), 'GET', '/api/measure-kinds'],
      [() => api.recipes.saved(), 'GET', '/api/recipes/saved'],
      [() => api.recipes.save('r1'), 'POST', '/api/recipes/r1/saved'],
      [() => api.recipes.unsave('r1'), 'DELETE', '/api/recipes/r1/saved'],
    ];

    for (const [call, method, path] of calls) {
      fetchMock.mockClear();
      await call();
      expect(fetchMock.mock.calls[0][1].method).toBe(method);
      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe(path);
    }
  });
});

describe('apiClient recipes', () => {
  it('uploads a recipe photo as a form without a JSON content type', async () => {
    localStorage.setItem('mp_auth_token', 'token');
    fetchMock.mockResolvedValue(jsonResponse(200, { url: 'https://storage.example.com/photo.jpg' }));
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });

    await expect(api.recipes.uploadImage(photo)).resolves.toBe('https://storage.example.com/photo.jpg');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/recipes\/images$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer token');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(Blob);
  });

  it.each([
    ['restore', () => api.recipes.restore('r1'), 'PATCH', '/api/recipes/r1/restore'],
    ['saved list', () => api.recipes.saved(), 'GET', '/api/recipes/saved'],
    ['save', () => api.recipes.save('r1'), 'POST', '/api/recipes/r1/saved'],
    ['unsave', () => api.recipes.unsave('r1'), 'DELETE', '/api/recipes/r1/saved'],
  ])('calls the %s endpoint', async (_name, call, method, path) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await call();

    expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`${path}$`));
    expect(fetchMock.mock.calls[0][1].method).toBe(method);
  });
});
