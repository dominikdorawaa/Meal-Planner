import { useEffect, useState } from 'react';
import { api } from './apiClient';
import { MAX_BASE_AMOUNT, MAX_PACKAGE_BASE_AMOUNT, PACKAGE_CODE, type MeasureKind, type MeasureNames } from './measures';

export interface MeasureInput {
  code: string;
  amount: string;
  isDefault: boolean;
  names?: MeasureNames | null;
}

export interface MeasureKindsState {
  kinds: MeasureKind[];
  failed: boolean;
  retry: () => void;
}

const FALLBACK_MAX_BASE_AMOUNTS: Record<string, number> = { [PACKAGE_CODE]: MAX_PACKAGE_BASE_AMOUNT };

export function useMeasureKinds(): MeasureKindsState {
  const [kinds, setKinds] = useState<MeasureKind[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    api.measureKinds.list()
      .then(list => {
        if (!current) return;
        setKinds(list);
        setFailed(false);
      })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [attempt]);
  return { kinds, failed, retry: () => setAttempt(previous => previous + 1) };
}

export function maxBaseAmount(code: string, kinds: MeasureKind[]): number {
  return kinds.find(kind => kind.code === code)?.max_base_amount ?? FALLBACK_MAX_BASE_AMOUNTS[code] ?? MAX_BASE_AMOUNT;
}

export function isEmptyMeasure(row: MeasureInput): boolean {
  return row.amount.trim() === '';
}

export function isValidMeasure(row: MeasureInput, kinds: MeasureKind[]): boolean {
  const value = Number(row.amount.replace(',', '.'));
  return isEmptyMeasure(row) || (Number.isFinite(value) && value > 0 && value <= maxBaseAmount(row.code, kinds));
}
