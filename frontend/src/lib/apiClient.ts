import { getLanguage, t } from '../i18n';

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.MODE === 'development'
    ? 'http://localhost:8080'
    : 'https://meal-planner-llet.onrender.com'
);

const TOKEN_KEY = 'mp_auth_token';
const USER_KEY = 'mp_auth_user';

// Typy 

export type UserRole = 'USER' | 'ADMIN';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role?: UserRole;
}

export interface ProductSearchFilters {
  maxKcal?: string;
  minProtein?: string;
  maxFat?: string;
  maxCarbs?: string;
}

export interface ProductSearchParams {
  query: string;
  page: number;
  size: number;
  filters: ProductSearchFilters;
}

export interface Product {
  id: string;
  name: string;
  brand?: string | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  unit?: string | null;
  image_url?: string | null;
  piece_weight?: number | null;
  bar_code?: string | null;
  status?: string;
  source?: string;
  created_by?: string | null;
  deleted?: boolean;
}

export interface ProductSearchPage {
  items: Product[];
  page: number;
  size: number;
  has_next: boolean;
}

interface AuthResponse {
  token: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
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

function toAuthUser(data: AuthResponse): AuthUser {
  return { userId: data.user_id, email: data.email, name: data.name, role: data.role };
}

function saveSession(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(toAuthUser(data)));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
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
    'Accept-Language': getLanguage(),
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
          throw new Error(t('api.sessionExpired'));
        }
      }
      let message: string;
      let errorBody: unknown = null;
      try {
        const err = await res.json();
        errorBody = err;
        message = err.error || err.message || t('api.serverError', { status: res.status });
      } catch {
        message = t('api.serverError', { status: res.status });
      }
      throw new ApiError(message, res.status, errorBody);
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
      return toAuthUser(data);
    },

    async login(email: string, password: string): Promise<AuthUser> {
      const data = await request<AuthResponse>('POST', '/api/auth/login', { email, password }, false);
      saveSession(data);
      return toAuthUser(data);
    },

    async refresh(): Promise<AuthUser> {
      const data = await request<AuthResponse>('POST', '/api/auth/refresh');
      saveSession(data);
      return toAuthUser(data);
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
    async search({ query, page, size, filters }: ProductSearchParams): Promise<ProductSearchPage> {
      const params = new URLSearchParams({ q: query.trim(), page: String(page), size: String(size) });
      const filterParams: Record<keyof ProductSearchFilters, string> = {
        maxKcal: 'max_kcal', minProtein: 'min_protein', maxFat: 'max_fat', maxCarbs: 'max_carbs',
      };
      for (const [key, param] of Object.entries(filterParams)) {
        const value = filters[key as keyof ProductSearchFilters];
        if (value !== undefined && value !== '') params.set(param, value);
      }
      return request<ProductSearchPage>('GET', `/api/products/search?${params}`);
    },
    async getById(id: string): Promise<any> {
      return request<any>('GET', `/api/products/${id}`);
    },
    async getByBarCode(barCode: string): Promise<Product> {
      return request<Product>('GET', `/api/products/barcode/${encodeURIComponent(barCode)}`);
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
