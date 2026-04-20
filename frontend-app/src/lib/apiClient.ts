

const API_BASE_URL = import.meta.env.MODE === 'development'
  ? 'http://localhost:8080' 
  : 'https://meal-planner-llet.onrender.com';

const TOKEN_KEY = 'mp_auth_token';
const USER_KEY = 'mp_auth_user';

// Typy 

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  name: string;
}

// Token helpers

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveSession(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify({ userId: data.userId, email: data.email, name: data.name }));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// HTTP helper 

let longPendingRequestsCount = 0;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requiresAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let isLong = false;
  const timeoutId = setTimeout(() => {
    isLong = true;
    longPendingRequestsCount++;
    if (longPendingRequestsCount === 1) {
      window.dispatchEvent(new CustomEvent('backend-loading', { detail: { isLoading: true } }));
    }
  }, 10000); // 10 sekund - próg powiadomienia o ładowaniu

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (getToken()) {
          clearSession();
          window.dispatchEvent(new Event('auth-change'));
          throw new Error('Sesja wygasła. Zaloguj się ponownie.');
        }
      }
      let message: string;
      try {
        const err = await res.json();
        const raw: string = err.message || err.error || '';
        // Wyciągnij ostatni 'default message [...]' z komunikatu Spring Validation
        const match = raw.match(/default message \[([^\]]+)\](?!.*default message)/s);
        if (match) {
          message = match[1];
        } else if (raw.startsWith('Validation failed')) {
          message = 'Dane nie spełniają wymagań – sprawdź formularz.';
        } else {
          message = raw || `Błąd serwera (${res.status})`;
        }
      } catch {
        message = `Błąd serwera (${res.status})`;
      }
      throw new Error(message);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json();
  } finally {
    clearTimeout(timeoutId);
    if (isLong) {
      longPendingRequestsCount--;
      if (longPendingRequestsCount === 0) {
        window.dispatchEvent(new CustomEvent('backend-loading', { detail: { isLoading: false } }));
      }
    }
  }
}

// Auth API 

export const api = {
  auth: {
    async register(email: string, password: string, name: string): Promise<AuthUser> {
      const data = await request<AuthResponse>('POST', '/api/auth/register', { email, password, name }, false);
      saveSession(data);
      return { userId: data.userId, email: data.email, name: data.name };
    },

    async login(email: string, password: string): Promise<AuthUser> {
      const data = await request<AuthResponse>('POST', '/api/auth/login', { email, password }, false);
      saveSession(data);
      return { userId: data.userId, email: data.email, name: data.name };
    },

    logout() {
      clearSession();
    },

    getUser(): AuthUser | null {
      return getStoredUser();
    },
  },

  // ─── Profile API ─────────────────────────────────────────────────────────────
  profile: {
    async get(): Promise<any> {
      return request<any>('GET', '/api/profile');
    },

    async update(data: any): Promise<any> {
      return request<any>('PUT', '/api/profile', data);
    }
  },

  // ─── Products API ────────────────────────────────────────────────────────────
  products: {
    async getAll(): Promise<any[]> {
      return request<any[]>('GET', '/api/products');
    },
    async getById(id: string): Promise<any> {
      return request<any>('GET', `/api/products/${id}`);
    },
    async getByBarCode(barCode: string): Promise<any> {
      return request<any>('GET', `/api/products/barcode/${barCode}`);
    },
    async create(data: any): Promise<any> {
      return request<any>('POST', '/api/products', data);
    },
    async delete(id: string): Promise<void> {
      return request<void>('DELETE', `/api/products/${id}`);
    }
  },

  // ─── Recipes API ─────────────────────────────────────────────────────────────
  recipes: {
    async getAll(): Promise<any[]> {
      return request<any[]>('GET', '/api/recipes');
    },
    async getById(id: string): Promise<any> {
      return request<any>('GET', `/api/recipes/${id}`);
    },
    async create(data: any): Promise<any> {
      return request<any>('POST', '/api/recipes', data);
    },
    async update(id: string, data: any): Promise<any> {
      return request<any>('PUT', `/api/recipes/${id}`, data);
    },
    async archive(id: string): Promise<any> {
      return request<any>('PATCH', `/api/recipes/${id}/archive`);
    }
  },

  // ─── Meals API ───────────────────────────────────────────────────────────────
  meals: {
    async getAll(): Promise<any[]> {
      return request<any[]>('GET', '/api/meals');
    },
    async getByDay(dateStr: string): Promise<any[]> {
      return request<any[]>('GET', `/api/meals/day/${dateStr}`);
    },
    async add(data: any): Promise<any> {
      return request<any>('POST', '/api/meals', data);
    },
    async update(id: string, data: any): Promise<any> {
      return request<any>('PUT', `/api/meals/${id}`, data);
    },
    async delete(id: string): Promise<void> {
      return request<void>('DELETE', `/api/meals/${id}`);
    }
  },

  // ─── Shopping List API ───────────────────────────────────────────────────────
  shoppingList: {
    async getItems(): Promise<any[]> {
      return request<any[]>('GET', '/api/shopping-list');
    },
    async getRecipes(): Promise<any[]> {
      return request<any[]>('GET', '/api/shopping-list/recipes');
    },
    async addItem(data: any): Promise<any> {
      return request<any>('POST', '/api/shopping-list', data);
    },
    async addRecipe(data: any): Promise<any> {
      return request<any>('POST', '/api/shopping-list/recipes', data);
    },
    async toggleItem(id: string, is_checked: boolean): Promise<any> {
      return request<any>('PATCH', `/api/shopping-list/${id}`, { is_checked });
    },
    async deleteItem(id: string): Promise<void> {
      return request<void>('DELETE', `/api/shopping-list/${id}`);
    },
    async clearAll(): Promise<void> {
      return request<void>('DELETE', '/api/shopping-list/clear');
    }
  },

  // Generyczne metody 
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>('PUT', path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};
