import { describe, expect, it } from 'vitest';
import { canDeleteProduct, canEditProduct, isOwnItem, isUnverified } from './productPermissions';

const user = { userId: 'user-1', email: 'user@example.com', name: 'User', role: 'USER' as const };
const admin = { ...user, userId: 'admin-1', role: 'ADMIN' as const };

describe('canDeleteProduct', () => {
  it('lets an admin delete any product', () => {
    expect(canDeleteProduct({ status: 'VERIFIED', created_by: null }, admin)).toBe(true);
  });

  it('lets a user delete their own pending product', () => {
    expect(canDeleteProduct({ status: 'PENDING', created_by: 'user-1' }, user)).toBe(true);
  });

  it('does not let a user delete their own verified product', () => {
    expect(canDeleteProduct({ status: 'VERIFIED', created_by: 'user-1' }, user)).toBe(false);
  });

  it('does not let a user delete someone else\'s pending product', () => {
    expect(canDeleteProduct({ status: 'PENDING', created_by: 'user-2' }, user)).toBe(false);
  });

  it('treats a stored session without a role as a regular user', () => {
    const legacyUser = { userId: 'user-1', email: 'user@example.com', name: 'User' };
    expect(canDeleteProduct({ status: 'VERIFIED', created_by: null }, legacyUser)).toBe(false);
  });

  it('does not offer deleting a product that is already deleted', () => {
    expect(canDeleteProduct({ status: 'VERIFIED', created_by: null, deleted: true }, admin)).toBe(false);
    expect(canDeleteProduct({ status: 'PENDING', created_by: 'user-1', deleted: true }, user)).toBe(false);
  });

  it('does not let a signed out visitor delete products', () => {
    expect(canDeleteProduct({ status: 'PENDING', created_by: 'user-1' }, null)).toBe(false);
  });
});

describe('isOwnItem', () => {
  it('uses the own flag sent by the server', () => {
    expect(isOwnItem({ own: true, created_by: 'user-2' }, user)).toBe(true);
    expect(isOwnItem({ own: false, created_by: 'user-1' }, user)).toBe(false);
  });

  it('falls back to the author when the server does not send the flag', () => {
    expect(isOwnItem({ created_by: 'user-1' }, user)).toBe(true);
    expect(isOwnItem({ created_by: 'user-2' }, user)).toBe(false);
    expect(isOwnItem({ created_by: null }, user)).toBe(false);
    expect(isOwnItem({ created_by: 'user-1' }, null)).toBe(false);
  });
});

describe('isUnverified', () => {
  it('marks only pending items', () => {
    expect(isUnverified({ status: 'PENDING' })).toBe(true);
    expect(isUnverified({ status: 'VERIFIED' })).toBe(false);
    expect(isUnverified({})).toBe(false);
  });
});

describe('canEditProduct', () => {
  it('follows the same rules as deleting', () => {
    expect(canEditProduct({ status: 'PENDING', created_by: 'user-1' }, user)).toBe(true);
    expect(canEditProduct({ status: 'VERIFIED', created_by: null }, user)).toBe(false);
  });
});
