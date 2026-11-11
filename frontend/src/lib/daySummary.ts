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
  goal: number;
  status: SummaryStatus;
  distance: number;
  exceeded: boolean;
  fillPercent: number;
  overflowPercent: number;
};

const MACRO_KEYS = ['protein', 'fat', 'carbs'] as const;
const KCAL_TOLERANCE = 0.02;

function metric(key: SummaryMetricKey, consumed: number, min: number, max: number, target: string, goal: number): SummaryMetric {
  const percent = max > 0 ? (consumed / max) * 100 : 0;
  const status: SummaryStatus = consumed > max ? 'over' : consumed >= min ? 'ok' : 'under';
  const gap = status === 'over' ? consumed - max : min - consumed;
  return {
    key,
    unit: 'g',
    value: Math.round(consumed),
    target,
    goal: Math.round(goal),
    status,
    distance: status === 'ok' ? 0 : Math.max(1, Math.round(gap)),
    exceeded: status === 'over',
    fillPercent: Math.min(100, percent),
    overflowPercent: Math.max(0, Math.min(100, percent - 100)),
  };
}

function kcalMetric(consumed: number, goal: number): SummaryMetric {
  const percent = goal > 0 ? (consumed / goal) * 100 : 0;
  const status: SummaryStatus = consumed > goal * (1 + KCAL_TOLERANCE) ? 'over' : consumed >= goal * (1 - KCAL_TOLERANCE) ? 'ok' : 'under';
  const distance = Math.round(Math.abs(consumed - goal));
  return {
    key: 'kcal',
    unit: 'kcal',
    value: Math.round(consumed),
    target: String(goal),
    goal,
    status,
    distance: status === 'ok' ? distance : Math.max(1, distance),
    exceeded: consumed > goal,
    fillPercent: Math.min(100, percent),
    overflowPercent: status === 'over' ? Math.max(0, Math.min(100, percent - 100)) : 0,
  };
}

export function buildDaySummary(consumed: DayConsumed, targets: SummaryTargets): SummaryMetric[] {
  const kcalTarget = Number(targets.target_kcal) || 0;
  const macros = MACRO_KEYS.map(key => {
    const target = Number(targets[`target_${key}`]) || 0;
    const min = Number(targets[`target_${key}_min`]) || target * 0.9;
    const max = Number(targets[`target_${key}_max`]) || target * 1.1;
    return metric(key, consumed[key], min, max, targetRange(target, targets[`target_${key}_min`], targets[`target_${key}_max`]), target);
  });
  return [kcalMetric(consumed.kcal, kcalTarget), ...macros];
}

export function addConsumed(day: DayConsumed, item: DayConsumed): DayConsumed {
  const sum = (key: SummaryMetricKey) => parseFloat((day[key] + item[key]).toFixed(1));
  return { kcal: Math.round(day.kcal + item.kcal), protein: sum('protein'), fat: sum('fat'), carbs: sum('carbs') };
}

const GOAL_MET_KCAL_TOLERANCE = 0.05;

export function isDayGoalMet(consumed: DayConsumed, targets: SummaryTargets): boolean {
  const goal = Number(targets.target_kcal) || 0;
  if (goal <= 0 || consumed.kcal <= 0) return false;
  if (Math.abs(consumed.kcal - goal) > goal * GOAL_MET_KCAL_TOLERANCE) return false;
  return buildDaySummary(consumed, targets).every(metric => metric.key === 'kcal' || metric.status !== 'over');
}
