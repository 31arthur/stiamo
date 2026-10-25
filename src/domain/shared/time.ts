import { addDays, format, parseISO } from 'date-fns'
import type { ISODate, Minutes, TimeSlot } from './types'

export const DATE_FORMAT = 'yyyy-MM-dd'

export const toISODate = (d: Date): ISODate => format(d, DATE_FORMAT)
export const shiftDate = (date: ISODate, days: number): ISODate => toISODate(addDays(parseISO(date), days))
export const minutesOf = (d: Date): Minutes => d.getHours() * 60 + d.getMinutes()

export const slotEnd = (s: Pick<TimeSlot, 'start' | 'duration'>) => s.start + s.duration

/** Absolute ordering key for a (date, minute) pair. */
export const instantKey = (date: ISODate, minute: Minutes = 0) => `${date}T${String(minute).padStart(4, '0')}`

/** Moves a point in time by a number of minutes, crossing midnight as needed. */
export function offsetMinutes(date: ISODate, minute: Minutes, delta: Minutes): { date: ISODate; minute: Minutes } {
  const total = minute + delta
  const dayShift = Math.floor(total / 1440)
  return { date: shiftDate(date, dayShift), minute: total - dayShift * 1440 }
}

export function formatClock(minutes: Minutes): string {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDuration(minutes: Minutes): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m'
}
