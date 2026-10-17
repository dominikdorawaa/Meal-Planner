import { parseIsoDate, todayIsoDate } from './planDates';

const PLAN_RETURN_POSITION_KEY = 'planReturnPosition';

export type PlanReturnPosition = {
  startDate: string;
  scrollLeft: number;
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
    return { startDate: saved.startDate, scrollLeft: Number(saved.scrollLeft) || 0 };
  } catch {
    return null;
  }
}

export function forgetPlanReturnPosition(): boolean {
  try {
    sessionStorage.removeItem(PLAN_RETURN_POSITION_KEY);
    return true;
  } catch {
    return false;
  }
}
