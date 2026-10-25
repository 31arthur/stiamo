export type CalendarItemType = 'task' | 'follow_up'

export interface CalendarItem {
  id: string
  userId: string
  title: string
  notes: string
  /** Local calendar day, formatted yyyy-MM-dd. */
  date: string
  type: CalendarItemType
  completed: boolean
}

export type NewCalendarItem = Pick<CalendarItem, 'title' | 'notes' | 'date' | 'type'>
