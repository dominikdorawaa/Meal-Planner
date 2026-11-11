import { parseIsoDate, todayIsoDate } from './planDates';

const PLAN_RETURN_POSITION_KEY = 'planReturnPosition';

export type PlanReturnPosition = {
  startDate: string;
  visibleIndex: number;
  stripStart?: string;
};

export function rememberPlanReturnPosition(position: PlanReturnPosition, today: string = todayIsoDate()): boolean {
  try {
    sessionStorage.setItem(PLAN_RETURN_POSITION_KEY, JSON.stringify({ ...position, savedOn: today }));
    return true;
  } catch {
    return false;
  }
}

export function readPlanReturnPosition(today: string = todayIsoDate()): PlanReturnPosition | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PLAN_RETURN_POSITION_KEY) ?? 'null');
    if (saved?.savedOn !== today || !parseIsoDate(saved.startDate)) return null;
    if (!Number.isInteger(saved.visibleIndex) || saved.visibleIndex < 0) return null;
    const stripStart = parseIsoDate(saved.stripStart) ? saved.stripStart : undefined;
    return { startDate: saved.startDate, visibleIndex: saved.visibleIndex, stripStart };
  } catch {
    return null;
  }
}
