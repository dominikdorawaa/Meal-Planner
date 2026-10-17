import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPlanReturnPosition, readPlanReturnPosition, rememberPlanReturnPosition } from './planPosition';

describe('planPosition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('restores the remembered position on the same day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', scrollLeft: 120 }, '2026-10-17');

    expect(readPlanReturnPosition('2026-10-17')).toEqual({ startDate: '2026-10-24', scrollLeft: 120 });
  });

  it('ignores a position remembered on another day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', scrollLeft: 120 }, '2026-10-16');

    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('returns nothing when no position was remembered', () => {
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('ignores a broken or invalid stored position', () => {
    sessionStorage.setItem('planReturnPosition', '{broken');
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();

    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: 'later', scrollLeft: 5, savedOn: '2026-10-17' }));
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('falls back to no scroll when the stored scroll is not a number', () => {
    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: '2026-10-17', scrollLeft: 'left', savedOn: '2026-10-17' }));

    expect(readPlanReturnPosition('2026-10-17')).toEqual({ startDate: '2026-10-17', scrollLeft: 0 });
  });

  it('uses today when no day is given', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', scrollLeft: 0 });

    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-24', scrollLeft: 0 });
  });

  it('forgets the remembered position', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', scrollLeft: 0 }, '2026-10-17');

    expect(forgetPlanReturnPosition()).toBe(true);
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('reports a failure when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(rememberPlanReturnPosition({ startDate: '2026-10-24', scrollLeft: 0 })).toBe(false);
    expect(forgetPlanReturnPosition()).toBe(false);
  });
});
