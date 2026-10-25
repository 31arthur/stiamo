import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { formatClock } from '@/domain/shared/time'
import type { ISODate, Minutes } from '@/domain/shared/types'

/** "Today", "Tomorrow", "Yesterday", "Mon 27 Oct", or with the year when it isn't this year. */
export function friendlyDate(date: ISODate, today: ISODate): string {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(today))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const d = parseISO(date)
  return format(d, d.getFullYear() === parseISO(today).getFullYear() ? 'EEE d MMM' : 'd MMM yyyy')
}

export function friendlyDateTime(date: ISODate, time: Minutes | undefined, today: ISODate): string {
  return time === undefined ? friendlyDate(date, today) : `${friendlyDate(date, today)}, ${formatClock(time)}`
}

/** "in 3 days", "2 days ago", "today". */
export function relativeDays(date: ISODate, today: ISODate): string {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(today))
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}
