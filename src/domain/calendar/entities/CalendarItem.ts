export type CalendarItemType = 'task' | 'follow_up' | 'meeting'

/** A slot on the item's day, in minutes from local midnight. */
export interface TimeBlock {
  start: number
  duration: number
}

export interface CalendarItem {
  id: string
  userId: string
  title: string
  notes: string
  /** Local calendar day, formatted yyyy-MM-dd. */
  date: string
  type: CalendarItemType
  completed: boolean
  /** Present once the item has been planned onto the day's timeline. */
  schedule?: TimeBlock
  /** Pinned items keep their time when the day is reflowed (meetings default to pinned). */
  pinned?: boolean
}

export type NewCalendarItem = Pick<CalendarItem, 'title' | 'notes' | 'date' | 'type'> & {
  schedule?: TimeBlock
}
