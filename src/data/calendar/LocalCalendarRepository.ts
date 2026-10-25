import type { CalendarItem } from '@/domain/calendar/entities/CalendarItem'
import type { CalendarRepository } from '@/domain/calendar/repositories/CalendarRepository'

const STORAGE_KEY = 'stiamo.calendar-items'
const SEEDED_KEY = 'stiamo.seeded'

export class LocalCalendarRepository implements CalendarRepository {
  /** `seed` items are added once per browser, alongside anything already stored. */
  constructor(
    private readonly storage: Storage = localStorage,
    seed?: () => CalendarItem[],
  ) {
    if (seed && this.storage.getItem(SEEDED_KEY) === null) {
      this.writeAll([...this.readAll(), ...seed()])
      this.storage.setItem(SEEDED_KEY, '1')
    }
  }

  async listByRange(userId: string, from: string, to: string): Promise<CalendarItem[]> {
    return this.readAll().filter((i) => i.userId === userId && i.date >= from && i.date <= to)
  }

  async add(item: CalendarItem): Promise<void> {
    this.writeAll([...this.readAll(), item])
  }

  async update(item: CalendarItem): Promise<void> {
    this.writeAll(this.readAll().map((i) => (i.id === item.id && i.userId === item.userId ? item : i)))
  }

  async remove(userId: string, id: string): Promise<void> {
    this.writeAll(this.readAll().filter((i) => !(i.id === id && i.userId === userId)))
  }

  private readAll(): CalendarItem[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CalendarItem[]) : []
    } catch {
      return []
    }
  }

  private writeAll(items: CalendarItem[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(items))
  }
}
