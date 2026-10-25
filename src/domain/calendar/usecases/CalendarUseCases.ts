import type { CalendarItem, NewCalendarItem } from '../entities/CalendarItem'
import { ValidationError } from '@/domain/auth/errors'
import { buildMonthGrid } from '../monthGrid'
import type { MonthGrid } from '../monthGrid'
import type { CalendarRepository } from '../repositories/CalendarRepository'

export interface MonthView {
  grid: MonthGrid
  itemsByDate: Record<string, CalendarItem[]>
}

export class GetMonthViewUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  async execute(userId: string, monthAnchor: Date): Promise<MonthView> {
    const grid = buildMonthGrid(monthAnchor)
    const items = await this.repository.listByRange(userId, grid.from, grid.to)
    const itemsByDate: Record<string, CalendarItem[]> = {}
    for (const item of items) (itemsByDate[item.date] ??= []).push(item)
    return { grid, itemsByDate }
  }
}

export class AddCalendarItemUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  async execute(userId: string, input: NewCalendarItem): Promise<CalendarItem> {
    const title = input.title.trim()
    if (!title) throw new ValidationError('Title is required')
    const item: CalendarItem = {
      id: crypto.randomUUID(),
      userId,
      title,
      notes: input.notes.trim(),
      date: input.date,
      type: input.type,
      completed: false,
    }
    await this.repository.add(item)
    return item
  }
}

export class ToggleCalendarItemUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  async execute(item: CalendarItem): Promise<void> {
    await this.repository.update({ ...item, completed: !item.completed })
  }
}

export class DeleteCalendarItemUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  execute(userId: string, id: string): Promise<void> {
    return this.repository.remove(userId, id)
  }
}
