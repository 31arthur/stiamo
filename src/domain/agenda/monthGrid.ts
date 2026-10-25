import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { toISODate } from '../shared/time'
import type { ISODate } from '../shared/types'

export interface MonthGrid {
  /** Weeks (Monday-first), each with 7 days, padded with adjacent-month days. */
  weeks: ISODate[][]
  from: ISODate
  to: ISODate
}

export function buildMonthGrid(monthAnchor: Date): MonthGrid {
  const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
  const weeks: ISODate[][] = []
  for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i))))
  }
  return { weeks, from: toISODate(start), to: toISODate(end) }
}
