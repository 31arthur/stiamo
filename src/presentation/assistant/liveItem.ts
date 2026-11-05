import { format, parseISO } from 'date-fns'
import type { BriefingItem } from '@/domain/ai/AgentApi'
import type { Meeting } from '@/domain/meetings/Meeting'
import type { FollowUp } from '@/domain/followups/FollowUp'
import { formatClock } from '@/domain/shared/time'
import type { ISODate, Minutes } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/Task'

type Live = Task | FollowUp | Meeting | undefined

export interface Placement {
  date?: ISODate
  /** "09:00–09:15", "09:00", or nothing when it has no time. */
  time?: string
}

const span = (start: Minutes | undefined, length: Minutes | undefined) => (start === undefined ? undefined : length ? `${formatClock(start)}–${formatClock(start + length)}` : formatClock(start))

/** Where a task, call or meeting is now, read from the record itself. */
export function placementOf(live: Live): Placement | undefined {
  if (!live) return undefined
  if ('slot' in live && live.slot && 'mode' in live) return { date: live.slot.date, time: span(live.slot.start, live.slot.duration) }
  if ('estimate' in live) return live.slot ? { date: live.slot.date, time: span(live.slot.start, live.slot.duration) } : { date: live.dueDate }
  if ('channel' in live) return { date: live.due?.date, time: span(live.due?.time, live.duration) }
  return undefined
}

/**
 * What a tile on the briefing should say about where its item is, compared with the day the briefing is about: the time it has now,
 * and, when it has been moved off that day or to another time, where it went.
 */
export function movedNote(item: BriefingItem, live: Live, day: ISODate): { time?: string; movedTo?: string; changed: boolean } {
  const now = placementOf(live)
  if (!now) return { time: item.time, changed: false }
  // Where it stood when the briefing was made: at a time on the day, or else on its own due day (an overdue task is shown under a later day).
  const was = item.time ? day : (item.due ?? day)
  const offDay = !!now.date && now.date !== was
  const where = now.date ? `${format(parseISO(now.date), 'EEE d MMM')}${now.time ? ` · ${now.time}` : ''}` : 'no day'
  return {
    time: offDay ? undefined : now.time,
    movedTo: offDay ? where : undefined,
    changed: offDay || (now.time ?? '') !== (item.time ?? ''),
  }
}
