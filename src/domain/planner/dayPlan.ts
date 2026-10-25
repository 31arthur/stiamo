import type { AgendaEntry } from '../agenda/agenda'
import type { Minutes } from '../shared/types'

/** The planner's visible day, in minutes from midnight. */
export const DAY_START = 6 * 60
export const DAY_END = 24 * 60
export const SLOT_MINUTES = 15
export const MIN_DURATION = 5

export interface Block {
  start: Minutes
  duration: Minutes
}

export type ScheduledEntry = AgendaEntry & { slot: Block }

export interface DayPlan {
  scheduled: ScheduledEntry[]
  unplanned: AgendaEntry[]
  /** Keys of scheduled entries that overlap another. */
  conflicts: Set<string>
  /** Side-by-side placement for overlapping blocks. */
  layout: Map<string, { column: number; columns: number }>
  plannedMinutes: number
  closedCount: number
}

export const isScheduled = (e: AgendaEntry): e is ScheduledEntry => e.slot !== undefined
export const blockEnd = (b: Block) => b.start + b.duration

export const snapToSlot = (minutes: number, mode: 'round' | 'up' = 'round') =>
  (mode === 'up' ? Math.ceil : Math.round)(minutes / SLOT_MINUTES) * SLOT_MINUTES

/** Keeps a block inside the visible day and at least MIN_DURATION long. */
export function clampBlock({ start, duration }: Block): Block {
  const d = Math.max(MIN_DURATION, Math.min(duration, DAY_END - DAY_START))
  const s = Math.min(Math.max(start, DAY_START), DAY_END - d)
  return { start: s, duration: d }
}

const overlaps = (a: Block, b: Block) => a.start < blockEnd(b) && b.start < blockEnd(a)

export function buildDayPlan(entries: AgendaEntry[]): DayPlan {
  const scheduled = entries
    .filter(isScheduled)
    .sort((a, b) => a.slot.start - b.slot.start || b.slot.duration - a.slot.duration)
  const unplanned = entries.filter((e) => !isScheduled(e))

  const conflicts = new Set<string>()
  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length && scheduled[j].slot.start < blockEnd(scheduled[i].slot); j++) {
      conflicts.add(scheduled[i].key)
      conflicts.add(scheduled[j].key)
    }
  }

  return {
    scheduled,
    unplanned,
    conflicts,
    layout: layoutColumns(scheduled),
    plannedMinutes: scheduled.reduce((sum, e) => sum + e.slot.duration, 0),
    closedCount: entries.filter((e) => e.outcome.status !== 'open').length,
  }
}

/** Greedy column packing per overlap cluster (the classic calendar layout). */
function layoutColumns(sorted: ScheduledEntry[]) {
  const layout = new Map<string, { column: number; columns: number }>()
  let cluster: ScheduledEntry[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const e of cluster) layout.get(e.key)!.columns = columnEnds.length
    cluster = []
    columnEnds = []
  }

  for (const e of sorted) {
    if (e.slot.start >= clusterEnd) flush()
    let column = columnEnds.findIndex((end) => end <= e.slot.start)
    if (column === -1) column = columnEnds.push(0) - 1
    columnEnds[column] = blockEnd(e.slot)
    clusterEnd = Math.max(clusterEnd, blockEnd(e.slot))
    layout.set(e.key, { column, columns: 0 })
    cluster.push(e)
  }
  flush()
  return layout
}

export interface PackOptions {
  /** Nothing is placed before this minute (e.g. "now"). */
  from: Minutes
  /** Breathing room between consecutive flexible blocks. */
  gap: Minutes
  /** Also place unscheduled, open, movable entries into the free time. */
  includeUnplanned: boolean
}

export interface Placement {
  entry: AgendaEntry
  slot: Block
}

/**
 * Re-flows the day: pinned, immovable, closed and already-finished blocks stay put; every other
 * scheduled block (in its current order), followed optionally by unplanned entries, is packed
 * back-to-back from `from`, flowing around the fixed blocks. Returns only entries whose time changed.
 */
export function packDay(entries: AgendaEntry[], { from, gap, includeUnplanned }: PackOptions): Placement[] {
  const start = Math.max(DAY_START, snapToSlot(from, 'up'))
  const scheduled = entries.filter(isScheduled).sort((a, b) => a.slot.start - b.slot.start)

  const isFixed = (e: ScheduledEntry) => e.pinned || !e.movable || e.outcome.status !== 'open' || blockEnd(e.slot) <= start
  const occupied: Block[] = scheduled.filter(isFixed).map((e) => e.slot)
  const extra = includeUnplanned ? entries.filter((e) => !isScheduled(e) && e.movable && e.outcome.status === 'open') : []
  const queue: AgendaEntry[] = [...scheduled.filter((e) => !isFixed(e)), ...extra]

  const changed: Placement[] = []
  let cursor = start
  for (const entry of queue) {
    const duration = entry.slot?.duration ?? entry.duration
    let slot: Block = { start: cursor, duration }
    for (let blocker = occupied.find((b) => overlaps(b, slot)); blocker; blocker = occupied.find((b) => overlaps(b, slot))) {
      slot = { start: blockEnd(blocker), duration }
    }
    if (blockEnd(slot) > DAY_END) continue // Doesn't fit today; leave it where it was.
    occupied.push(slot)
    cursor = blockEnd(slot) + gap
    if (slot.start !== entry.slot?.start || slot.duration !== entry.slot?.duration) changed.push({ entry, slot })
  }
  return changed
}
