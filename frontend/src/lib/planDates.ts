const MONTH_NAMES = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const DAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

const pad = (value: number) => String(value).padStart(2, '0');

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIsoDate = () => toIsoDate(new Date());

export const parseIsoDate = (isoDate: string | null | undefined): Date | null => {
  const match = isoDate ? ISO_DATE_PATTERN.exec(isoDate) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export const addDaysToIsoDate = (isoDate: string, days: number) => {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

export const formatDayMonth = (isoDate: string) => {
  const date = parseIsoDate(isoDate);
  return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}` : isoDate;
};

export const formatDayWithMonthName = (dayName: string, isoDate: string) => {
  const date = parseIsoDate(isoDate);
  return date ? `${dayName}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}` : `${dayName} (${isoDate})`;
};

export const formatRelativeDayLabel = (isoDate: string, today: Date = new Date()) => {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((date.getTime() - todayStart.getTime()) / DAY_IN_MS);
  if (diffDays === 0) return 'Dzisiaj';
  if (diffDays === 1) return 'Jutro';
  if (diffDays === -1) return 'Wczoraj';
  return formatDayWithMonthName(DAY_NAMES[date.getDay()], isoDate);
};

export const firstDayOfMonth = (isoDate: string | null | undefined) => {
  const date = parseIsoDate(isoDate) ?? new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const planDays = (startDate: Date, count: number = 14, today: Date = new Date()) => {
  const todayIso = toIsoDate(today);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offset);
    const isoDate = toIsoDate(date);
    return { name: DAY_NAMES[date.getDay()], date: isoDate, active: true, isToday: isoDate === todayIso };
  });
};
