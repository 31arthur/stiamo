import type { CalendarItem } from '../entities/CalendarItem'

export interface CalendarRepository {
  /** Items for the user whose date falls within [from, to] (inclusive, yyyy-MM-dd). */
  listByRange(userId: string, from: string, to: string): Promise<CalendarItem[]>
  add(item: CalendarItem): Promise<void>
  update(item: CalendarItem): Promise<void>
  remove(userId: string, id: string): Promise<void>
}
