import { targetRange } from './macros';

export type SummaryMetricKey = 'kcal' | 'protein' | 'fat' | 'carbs';
export type SummaryStatus = 'under' | 'ok' | 'over';

export type DayConsumed = { kcal: number; protein: number; fat: number; carbs: number };

export type SummaryTargets = {
  target_kcal: number;
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  target_protein_min?: number | null;
  target_protein_max?: number | null;
  target_fat_min?: number | null;
  target_fat_max?: number | null;
  target_carbs_min?: number | null;
  target_carbs_max?: number | null;
};

export type SummaryMetric = {
  key: SummaryMetricKey;
  unit: 'kcal' | 'g';
  value: number;
  target: string;
  status: SummaryStatus;
  distance: number;
  fillPercent: number;
  overflowPercent: number;
};

const MACRO_KEYS = ['protein', 'fat', 'carbs'] as const;

function metric(key: SummaryMetricKey, consumed: number, min: number, max: number, target: string): SummaryMetric {
  const percent = max > 0 ? (consumed / max) * 100 : 0;
  const status: SummaryStatus = consumed > max ? 'over' : consumed >= min ? 'ok' : 'under';
  const gap = status === 'over' ? consumed - max : min - consumed;
  return {
    key,
    unit: key === 'kcal' ? 'kcal' : 'g',
    value: Math.round(consumed),
    target,
    status,
    distance: status === 'ok' ? 0 : Math.max(1, Math.round(gap)),
    fillPercent: Math.min(100, percent),
    overflowPercent: Math.max(0, Math.min(100, percent - 100)),
  };
}

export function buildDaySummary(consumed: DayConsumed, targets: SummaryTargets): SummaryMetric[] {
  const kcalTarget = Number(targets.target_kcal) || 0;
  const macros = MACRO_KEYS.map(key => {
    const target = Number(targets[`target_${key}`]) || 0;
    const min = Number(targets[`target_${key}_min`]) || target * 0.9;
    const max = Number(targets[`target_${key}_max`]) || target * 1.1;
    return metric(key, consumed[key], min, max, targetRange(target, targets[`target_${key}_min`], targets[`target_${key}_max`]));
  });
  return [metric('kcal', consumed.kcal, kcalTarget * 0.9, kcalTarget, String(kcalTarget)), ...macros];
}

export function addConsumed(day: DayConsumed, item: DayConsumed): DayConsumed {
  const sum = (key: SummaryMetricKey) => parseFloat((day[key] + item[key]).toFixed(1));
  return { kcal: Math.round(day.kcal + item.kcal), protein: sum('protein'), fat: sum('fat'), carbs: sum('carbs') };
}
