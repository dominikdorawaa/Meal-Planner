import type { AuthUser } from './apiClient';

interface ProductOwnership {
  status?: string;
  created_by?: string | null;
}

export function canDeleteProduct(product: ProductOwnership, user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return product.status === 'PENDING' && product.created_by === user.userId;
}
