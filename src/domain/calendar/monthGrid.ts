import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'

export const DATE_FORMAT = 'yyyy-MM-dd'

export interface MonthGrid {
  /** Weeks (Sunday-first), each with 7 yyyy-MM-dd days, padded with adjacent-month days. */
  weeks: string[][]
  from: string
  to: string
}

export function buildMonthGrid(monthAnchor: Date): MonthGrid {
  const start = startOfWeek(startOfMonth(monthAnchor))
  const end = endOfWeek(endOfMonth(monthAnchor))

  const weeks: string[][] = []
  for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), DATE_FORMAT)))
  }

  return { weeks, from: format(start, DATE_FORMAT), to: format(end, DATE_FORMAT) }
}
