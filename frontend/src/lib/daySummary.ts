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
  min: number;
  max: number;
  target: string;
  status: SummaryStatus;
  fillPercent: number;
  overflowPercent: number;
};

const MACRO_KEYS = ['protein', 'fat', 'carbs'] as const;

function metric(key: SummaryMetricKey, consumed: number, min: number, max: number, target: string): SummaryMetric {
  const value = Math.round(consumed);
  const percent = max > 0 ? (consumed / max) * 100 : 0;
  return {
    key,
    unit: key === 'kcal' ? 'kcal' : 'g',
    value,
    min,
    max,
    target,
    status: value > max ? 'over' : value >= min ? 'ok' : 'under',
    fillPercent: Math.min(100, percent),
    overflowPercent: Math.max(0, Math.min(100, percent - 100)),
  };
}

export function buildDaySummary(consumed: DayConsumed, targets: SummaryTargets): SummaryMetric[] {
  const kcalTarget = Number(targets.target_kcal) || 0;
  const macros = MACRO_KEYS.map(key => {
    const target = Number(targets[`target_${key}`]) || 0;
    const min = targets[`target_${key}_min`] || Math.round(target * 0.9);
    const max = targets[`target_${key}_max`] || Math.round(target * 1.1);
    return metric(key, consumed[key], min, max, `${min}-${max}`);
  });
  return [metric('kcal', consumed.kcal, Math.round(kcalTarget * 0.9), kcalTarget, String(kcalTarget)), ...macros];
}

export function distanceToTarget(metric: SummaryMetric): number {
  if (metric.status === 'over') return metric.value - metric.max;
  if (metric.status === 'under') return (metric.key === 'kcal' ? metric.max : metric.min) - metric.value;
  return 0;
}
