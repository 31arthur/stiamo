import { addDays, format, nextMonday, parseISO } from 'date-fns'
import { toISODate } from '@/domain/shared/time'
import type { ISODate } from '@/domain/shared/types'

export interface MoveOption {
  label: string
  date: ISODate
}

/** Where something can be moved to in one tap: today, tomorrow, the day after (named), and next Monday. Each day once. */
export function moveOptions(today: ISODate): MoveOption[] {
  const base = parseISO(today)
  const all: MoveOption[] = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: toISODate(addDays(base, 1)) },
    { label: format(addDays(base, 2), 'EEEE'), date: toISODate(addDays(base, 2)) },
    { label: 'Next Monday', date: toISODate(nextMonday(base)) },
  ]
  return all.filter((o, i) => all.findIndex((x) => x.date === o.date) === i)
}
