import type { AuthUser } from './apiClient';

interface ProductOwnership {
  status?: string;
  created_by?: string | null;
  deleted?: boolean;
}

interface ItemOwnership {
  status?: string;
  created_by?: string | null;
  own?: boolean;
}

export function canDeleteProduct(product: ProductOwnership, user: AuthUser | null): boolean {
  if (!user || product.deleted) return false;
  if (user.role === 'ADMIN') return true;
  return product.status === 'PENDING' && product.created_by === user.userId;
}

export const canEditProduct = canDeleteProduct;

export function isOwnItem(item: ItemOwnership, user: AuthUser | null): boolean {
  if (typeof item.own === 'boolean') return item.own;
  return Boolean(user && item.created_by && item.created_by === user.userId);
}

export function isUnverified(item: ItemOwnership): boolean {
  return item.status === 'PENDING';
}
