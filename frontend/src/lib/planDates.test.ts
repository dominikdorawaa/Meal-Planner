import { describe, expect, it, vi } from 'vitest'
import {
  addDaysToIsoDate,
  firstDayOfMonth,
  formatDayMonth,
  formatDayWithMonthName,
  formatRelativeDayLabel,
  parseIsoDate,
  planDays,
  toIsoDate,
  todayIsoDate,
} from './planDates'

describe('toIsoDate', () => {
  it('uses the local calendar day with the year', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('todayIsoDate', () => {
  it('returns the current local day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59))
    expect(todayIsoDate()).toBe('2026-12-31')
    vi.useRealTimers()
  })
})

describe('parseIsoDate', () => {
  it('reads a full date', () => {
    expect(parseIsoDate('2028-02-29')).toEqual(new Date(2028, 1, 29))
  })

  it('rejects dates without the year or that do not exist', () => {
    expect(parseIsoDate('16.10')).toBeNull()
    expect(parseIsoDate('2027-02-29')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate(null)).toBeNull()
    expect(parseIsoDate(undefined)).toBeNull()
  })
})

describe('addDaysToIsoDate', () => {
  it('moves into the next year', () => {
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToIsoDate('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('moves back into the previous year', () => {
    expect(addDaysToIsoDate('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('keeps an invalid date unchanged', () => {
    expect(addDaysToIsoDate('16.10', 1)).toBe('16.10')
  })
})

describe('formatDayMonth', () => {
  it('shows the day and month like before', () => {
    expect(formatDayMonth('2027-01-02')).toBe('02.01')
  })

  it('shows an invalid date as it is', () => {
    expect(formatDayMonth('abc')).toBe('abc')
  })
})

describe('formatDayWithMonthName', () => {
  it('shows the day with the Polish month name', () => {
    expect(formatDayWithMonthName('Piątek', '2027-01-01')).toBe('Piątek, 1 stycznia')
  })

  it('falls back to the raw value for an invalid date', () => {
    expect(formatDayWithMonthName('Piątek', 'abc')).toBe('Piątek (abc)')
  })
})

describe('formatRelativeDayLabel', () => {
  const today = new Date(2026, 11, 31, 18, 0)

  it('names days next to today across the new year', () => {
    expect(formatRelativeDayLabel('2026-12-31', today)).toBe('Dzisiaj')
    expect(formatRelativeDayLabel('2027-01-01', today)).toBe('Jutro')
    expect(formatRelativeDayLabel('2026-12-30', today)).toBe('Wczoraj')
  })

  it('shows other days with the day name and month name', () => {
    expect(formatRelativeDayLabel('2027-01-02', today)).toBe('Sobota, 2 stycznia')
    expect(formatRelativeDayLabel('2025-12-31', today)).toBe('Środa, 31 grudnia')
  })

  it('shows an invalid date as it is', () => {
    expect(formatRelativeDayLabel('abc', today)).toBe('abc')
  })

  it('compares with the current day by default', () => {
    expect(formatRelativeDayLabel(todayIsoDate())).toBe('Dzisiaj')
  })
})

describe('firstDayOfMonth', () => {
  it('opens the calendar on the month of the given date', () => {
    expect(firstDayOfMonth('2027-01-15')).toEqual(new Date(2027, 0, 1))
  })

  it('opens the calendar on the current month without a date', () => {
    const now = new Date()
    expect(firstDayOfMonth(null)).toEqual(new Date(now.getFullYear(), now.getMonth(), 1))
  })
})

describe('planDays', () => {
  it('lists days across the new year with full dates', () => {
    const days = planDays(new Date(2026, 11, 30), 4, new Date(2027, 0, 1, 9, 0))

    expect(days).toEqual([
      { name: 'Środa', date: '2026-12-30', active: true, isToday: false },
      { name: 'Czwartek', date: '2026-12-31', active: true, isToday: false },
      { name: 'Piątek', date: '2027-01-01', active: true, isToday: true },
      { name: 'Sobota', date: '2027-01-02', active: true, isToday: false },
    ])
  })

  it('shows two weeks by default', () => {
    const days = planDays(new Date(2026, 9, 17))

    expect(days).toHaveLength(14)
    expect(days[13].date).toBe('2026-10-30')
  })

  it('does not treat the same day of another year as today', () => {
    const days = planDays(new Date(2026, 0, 1), 1, new Date(2027, 0, 1))

    expect(days[0].isToday).toBe(false)
  })
})
