import { useEffect, useState } from 'react';
import { api } from './apiClient';
import { MAX_BASE_AMOUNT, type MeasureKind, type MeasureNames } from './measures';

export interface MeasureInput {
  code: string;
  amount: string;
  isDefault: boolean;
  names?: MeasureNames | null;
}

export function useMeasureKinds(): MeasureKind[] {
  const [kinds, setKinds] = useState<MeasureKind[]>([]);
  useEffect(() => {
    let current = true;
    api.measureKinds.list()
      .then(list => { if (current) setKinds(list); })
      .catch(() => {});
    return () => { current = false; };
  }, []);
  return kinds;
}

export function maxBaseAmount(code: string, kinds: MeasureKind[]): number {
  return kinds.find(kind => kind.code === code)?.max_base_amount ?? MAX_BASE_AMOUNT;
}

export function isEmptyMeasure(row: MeasureInput): boolean {
  return row.amount.trim() === '';
}

export function isValidMeasure(row: MeasureInput, kinds: MeasureKind[]): boolean {
  const value = Number(row.amount.replace(',', '.'));
  return isEmptyMeasure(row) || (Number.isFinite(value) && value > 0 && value <= maxBaseAmount(row.code, kinds));
}
