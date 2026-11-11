import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPlanReturnPosition, rememberPlanReturnPosition } from './planPosition';

describe('planPosition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('restores the remembered position on the same day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', visibleIndex: 9, stripStart: '2026-10-31' }, '2026-10-17');

    expect(readPlanReturnPosition('2026-10-17')).toEqual({ startDate: '2026-10-24', visibleIndex: 9, stripStart: '2026-10-31' });
  });

  it('restores a position without a strip week', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', visibleIndex: 0 }, '2026-10-17');

    expect(readPlanReturnPosition('2026-10-17')).toEqual({ startDate: '2026-10-24', visibleIndex: 0 });
  });

  it('drops an invalid strip week', () => {
    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: '2026-10-17', visibleIndex: 7, stripStart: 'soon', savedOn: '2026-10-17' }));

    expect(readPlanReturnPosition('2026-10-17')).toStrictEqual({ startDate: '2026-10-17', visibleIndex: 7, stripStart: undefined });
  });

  it('ignores a position remembered on another day', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', visibleIndex: 7 }, '2026-10-16');

    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('returns nothing when no position was remembered', () => {
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('ignores a broken or invalid stored position', () => {
    sessionStorage.setItem('planReturnPosition', '{broken');
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();

    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: 'later', visibleIndex: 7, savedOn: '2026-10-17' }));
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('ignores a position without a valid visible day', () => {
    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: '2026-10-17', scrollLeft: 120, savedOn: '2026-10-17' }));
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();

    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: '2026-10-17', visibleIndex: -1, savedOn: '2026-10-17' }));
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();

    sessionStorage.setItem('planReturnPosition', JSON.stringify({ startDate: '2026-10-17', visibleIndex: 1.5, savedOn: '2026-10-17' }));
    expect(readPlanReturnPosition('2026-10-17')).toBeNull();
  });

  it('uses today when no day is given', () => {
    rememberPlanReturnPosition({ startDate: '2026-10-24', visibleIndex: 7 });

    expect(readPlanReturnPosition()).toEqual({ startDate: '2026-10-24', visibleIndex: 7 });
  });

  it('reports a failure when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(rememberPlanReturnPosition({ startDate: '2026-10-24', visibleIndex: 7 })).toBe(false);
  });
});
