import type { CalendarItem, CalendarItemType, TimeBlock } from '@/domain/calendar/entities/CalendarItem'

/** The planner's visible day, in minutes from midnight. */
export const DAY_START = 6 * 60
export const DAY_END = 24 * 60
export const SLOT_MINUTES = 15
export const MIN_DURATION = SLOT_MINUTES

export const DEFAULT_DURATION: Record<CalendarItemType, number> = {
  task: 45,
  follow_up: 15,
  meeting: 60,
}

export type ScheduledItem = CalendarItem & { schedule: TimeBlock }

export interface DayPlan {
  scheduled: ScheduledItem[]
  unplanned: CalendarItem[]
  /** Ids of scheduled items that overlap another scheduled item. */
  conflicts: Set<string>
  /** Side-by-side placement for overlapping blocks. */
  layout: Map<string, { column: number; columns: number }>
  plannedMinutes: number
  completedCount: number
}

export const isScheduled = (item: CalendarItem): item is ScheduledItem => item.schedule !== undefined
export const blockEnd = (b: TimeBlock) => b.start + b.duration
export const isPinned = (item: CalendarItem) => item.pinned ?? item.type === 'meeting'

export const snapToSlot = (minutes: number, mode: 'round' | 'up' = 'round') =>
  (mode === 'up' ? Math.ceil : Math.round)(minutes / SLOT_MINUTES) * SLOT_MINUTES

/** Keeps a block inside the visible day and at least one slot long. */
export function clampBlock({ start, duration }: TimeBlock): TimeBlock {
  const d = Math.max(MIN_DURATION, Math.min(duration, DAY_END - DAY_START))
  const s = Math.min(Math.max(start, DAY_START), DAY_END - d)
  return { start: s, duration: d }
}

const overlaps = (a: TimeBlock, b: TimeBlock) => a.start < blockEnd(b) && b.start < blockEnd(a)

export function buildDayPlan(items: CalendarItem[]): DayPlan {
  const scheduled = items.filter(isScheduled).sort((a, b) => a.schedule.start - b.schedule.start || b.schedule.duration - a.schedule.duration)
  const unplanned = items.filter((i) => !isScheduled(i))

  const conflicts = new Set<string>()
  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length && scheduled[j].schedule.start < blockEnd(scheduled[i].schedule); j++) {
      conflicts.add(scheduled[i].id)
      conflicts.add(scheduled[j].id)
    }
  }

  return {
    scheduled,
    unplanned,
    conflicts,
    layout: layoutColumns(scheduled),
    plannedMinutes: scheduled.reduce((sum, i) => sum + i.schedule.duration, 0),
    completedCount: items.filter((i) => i.completed).length,
  }
}

/** Greedy column packing per overlap cluster (the classic calendar layout). */
function layoutColumns(sorted: ScheduledItem[]) {
  const layout = new Map<string, { column: number; columns: number }>()
  let cluster: ScheduledItem[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const item of cluster) layout.get(item.id)!.columns = columnEnds.length
    cluster = []
    columnEnds = []
  }

  for (const item of sorted) {
    if (item.schedule.start >= clusterEnd) flush()
    let column = columnEnds.findIndex((end) => end <= item.schedule.start)
    if (column === -1) column = columnEnds.push(0) - 1
    columnEnds[column] = blockEnd(item.schedule)
    clusterEnd = Math.max(clusterEnd, blockEnd(item.schedule))
    layout.set(item.id, { column, columns: 0 })
    cluster.push(item)
  }
  flush()
  return layout
}

export interface PackOptions {
  /** Nothing is placed before this minute (e.g. "now"). */
  from: number
  /** Breathing room between consecutive flexible blocks. */
  gap: number
}

/**
 * Re-flows the day: pinned, completed and already-finished blocks stay put; every other scheduled
 * block (in its current order) followed by `extra` items is packed back-to-back from `from`,
 * flowing around the fixed blocks. Returns only the items whose schedule changed.
 */
export function packDay(items: CalendarItem[], extra: CalendarItem[], { from, gap }: PackOptions): ScheduledItem[] {
  const start = Math.max(DAY_START, snapToSlot(from, 'up'))
  const scheduled = items.filter(isScheduled).sort((a, b) => a.schedule.start - b.schedule.start)

  const isFixed = (i: ScheduledItem) => isPinned(i) || i.completed || blockEnd(i.schedule) <= start
  const occupied: TimeBlock[] = scheduled.filter(isFixed).map((i) => i.schedule)
  const queue: CalendarItem[] = [...scheduled.filter((i) => !isFixed(i)), ...extra.filter((i) => !i.completed)]

  const changed: ScheduledItem[] = []
  let cursor = start
  for (const item of queue) {
    const duration = item.schedule?.duration ?? DEFAULT_DURATION[item.type]
    let slot: TimeBlock = { start: cursor, duration }
    for (let blocker = occupied.find((b) => overlaps(b, slot)); blocker; blocker = occupied.find((b) => overlaps(b, slot))) {
      slot = { start: blockEnd(blocker), duration }
    }
    if (blockEnd(slot) > DAY_END) continue // Doesn't fit today; leave it where it was.
    occupied.push(slot)
    cursor = blockEnd(slot) + gap
    if (slot.start !== item.schedule?.start || slot.duration !== item.schedule?.duration) {
      changed.push({ ...item, schedule: slot })
    }
  }
  return changed
}
