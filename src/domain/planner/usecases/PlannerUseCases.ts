import type { CalendarItem, TimeBlock } from '@/domain/calendar/entities/CalendarItem'
import type { CalendarRepository } from '@/domain/calendar/repositories/CalendarRepository'
import { clampBlock, isPinned, packDay } from '../dayPlan'
import type { PackOptions } from '../dayPlan'

export class GetDayItemsUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  execute(userId: string, date: string): Promise<CalendarItem[]> {
    return this.repository.listByRange(userId, date, date)
  }
}

export class ScheduleItemUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  /** Places (or moves/resizes) an item on its day; returns the stored item. */
  async execute(item: CalendarItem, block: TimeBlock): Promise<CalendarItem> {
    const updated = { ...item, schedule: clampBlock(block) }
    await this.repository.update(updated)
    return updated
  }
}

export class UnscheduleItemUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  async execute(item: CalendarItem): Promise<CalendarItem> {
    const updated: CalendarItem = { ...item, schedule: undefined }
    await this.repository.update(updated)
    return updated
  }
}

export class TogglePinUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  async execute(item: CalendarItem): Promise<CalendarItem> {
    const updated = { ...item, pinned: !isPinned(item) }
    await this.repository.update(updated)
    return updated
  }
}

export class RestoreItemsUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  /** Writes earlier snapshots of items back (used for undo). */
  async execute(items: CalendarItem[]): Promise<void> {
    for (const item of items) await this.repository.update(item)
  }
}

export class ReflowDayUseCase {
  constructor(private readonly repository: CalendarRepository) {}

  /**
   * Packs flexible blocks from `options.from`, optionally pulling unplanned items onto the timeline.
   * Returns the items that moved.
   */
  async execute(items: CalendarItem[], options: PackOptions & { includeUnplanned: boolean }): Promise<CalendarItem[]> {
    const extra = options.includeUnplanned ? items.filter((i) => !i.schedule) : []
    const changed = packDay(items, extra, options)
    for (const item of changed) await this.repository.update(item)
    return changed
  }
}
