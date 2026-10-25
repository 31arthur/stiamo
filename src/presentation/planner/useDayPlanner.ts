import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Container } from '@/di/container'
import type { CalendarItem, NewCalendarItem, TimeBlock } from '@/domain/calendar/entities/CalendarItem'
import { buildDayPlan, clampBlock } from '@/domain/planner/dayPlan'
import { formatMinutes } from '@/presentation/calendar/itemStyles'

export interface PlannerNotice {
  id: number
  message: string
  canUndo: boolean
}

interface HistoryEntry {
  /** Snapshots of items as they were before the change. */
  before: CalendarItem[]
  message: string
}

const MAX_HISTORY = 30

export function useDayPlanner(container: Pick<Container, 'calendar' | 'planner'>, userId: string, date: string) {
  const { calendar, planner } = container
  const [loaded, setLoaded] = useState<{ date: string; items: CalendarItem[] } | null>(null)
  const [notice, setNotice] = useState<PlannerNotice | null>(null)
  const history = useRef<HistoryEntry[]>([])
  const itemsRef = useRef<CalendarItem[]>([])

  useEffect(() => {
    let active = true
    history.current = []
    planner.getDayItems.execute(userId, date).then((items) => active && setLoaded({ date, items }))
    return () => {
      active = false
    }
  }, [planner, userId, date])

  const items = useMemo(() => (loaded?.date === date ? loaded.items : []), [loaded, date])
  itemsRef.current = items
  const plan = useMemo(() => buildDayPlan(items), [items])

  const dismissNotice = useCallback(() => setNotice(null), [])
  const notify = useCallback((message: string, canUndo = true) => setNotice({ id: Date.now(), message, canUndo }), [])

  /** Applies updated items locally right away (so drops never flicker) and records an undo point. */
  const apply = useCallback((updated: CalendarItem[], message?: string) => {
    if (updated.length === 0) return
    const byId = new Map(updated.map((i) => [i.id, i]))
    const before = itemsRef.current.filter((i) => byId.has(i.id))
    if (message) {
      history.current = [...history.current.slice(-MAX_HISTORY + 1), { before, message }]
    }
    setLoaded((prev) => prev && { ...prev, items: prev.items.map((i) => byId.get(i.id) ?? i) })
  }, [])

  const schedule = useCallback(
    async (item: CalendarItem, block: TimeBlock, verb = item.schedule ? 'Moved' : 'Planned') => {
      const next = { ...item, schedule: clampBlock(block) }
      apply([next], `${verb} “${item.title}” to ${formatMinutes(next.schedule.start)}`)
      notify(`${verb} “${item.title}” to ${formatMinutes(next.schedule.start)}`)
      await planner.schedule.execute(item, block)
    },
    [apply, notify, planner],
  )

  const resize = useCallback(
    async (item: CalendarItem, duration: number) => {
      if (!item.schedule) return
      const next = { ...item, schedule: clampBlock({ ...item.schedule, duration }) }
      apply([next], `Resized “${item.title}”`)
      await planner.schedule.execute(item, next.schedule)
    },
    [apply, planner],
  )

  const unschedule = useCallback(
    async (item: CalendarItem) => {
      apply([{ ...item, schedule: undefined }], `Unplanned “${item.title}”`)
      notify(`Moved “${item.title}” back to unplanned`)
      await planner.unschedule.execute(item)
    },
    [apply, notify, planner],
  )

  const toggleComplete = useCallback(
    async (item: CalendarItem) => {
      apply([{ ...item, completed: !item.completed }], `Toggled “${item.title}”`)
      await calendar.toggleItem.execute(item)
    },
    [apply, calendar],
  )

  const togglePin = useCallback(
    async (item: CalendarItem) => {
      const updated = await planner.togglePin.execute(item)
      apply([updated], `${updated.pinned ? 'Pinned' : 'Unpinned'} “${item.title}”`)
      notify(updated.pinned ? `Pinned “${item.title}” — reflow won’t move it` : `Unpinned “${item.title}”`)
    },
    [apply, notify, planner],
  )

  const add = useCallback(
    async (input: NewCalendarItem) => {
      const created = await calendar.addItem.execute(userId, input)
      setLoaded((prev) => prev && { ...prev, items: [...prev.items, created] })
    },
    [calendar, userId],
  )

  const remove = useCallback(
    async (item: CalendarItem) => {
      setLoaded((prev) => prev && { ...prev, items: prev.items.filter((i) => i.id !== item.id) })
      notify(`Deleted “${item.title}”`, false)
      await calendar.deleteItem.execute(userId, item.id)
    },
    [calendar, notify, userId],
  )

  const reflow = useCallback(
    async (from: number, gap: number, includeUnplanned: boolean) => {
      const before = itemsRef.current
      const changed = await planner.reflow.execute(before, { from, gap, includeUnplanned })
      if (changed.length === 0) {
        notify(includeUnplanned ? 'Nothing more fits today' : 'Already in flow — nothing to move', false)
        return 0
      }
      const label = includeUnplanned ? `Planned ${changed.length} item${changed.length > 1 ? 's' : ''}` : `Reflowed ${changed.length} block${changed.length > 1 ? 's' : ''}`
      apply(changed, label)
      notify(label)
      return changed.length
    },
    [apply, notify, planner],
  )

  const undo = useCallback(async () => {
    const entry = history.current.pop()
    if (!entry) return
    apply(entry.before)
    notify(`Undid: ${entry.message}`, false)
    await planner.restore.execute(entry.before)
  }, [apply, notify, planner])

  return {
    ready: loaded?.date === date,
    items,
    plan,
    notice,
    dismissNotice,
    schedule,
    resize,
    unschedule,
    toggleComplete,
    togglePin,
    add,
    remove,
    reflow,
    undo,
  }
}

export type DayPlanner = ReturnType<typeof useDayPlanner>
