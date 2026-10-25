import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import { buildDayPlan, clampBlock } from '@/domain/planner/dayPlan'
import type { Block } from '@/domain/planner/dayPlan'
import type { AnyEntity } from '@/domain/shared/registry'
import { formatClock } from '@/domain/shared/time'
import type { ISODate } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { useAgenda, useUserId } from '@/presentation/data/hooks'

interface HistoryEntry {
  before: AnyEntity[]
  label: string
}

const MAX_HISTORY = 30

/**
 * The planner's state: the live agenda for the day plus optimistic overrides (so a drop lands on the
 * frame it's released, before the database echoes it back), persisted through the agenda use cases,
 * with an undo stack of prior snapshots.
 */
export function useDayPlanner(date: ISODate) {
  const services = useServices()
  const userId = useUserId()
  const { data: base, isLoading } = useAgenda(date, date)
  const [pending, setPending] = useState<Map<string, { entry: AgendaEntry; block: Block | null }>>(new Map())
  const history = useRef<HistoryEntry[]>([])

  // Fresh data from the store supersedes any optimistic guess.
  useEffect(() => setPending(new Map()), [base])
  useEffect(() => {
    history.current = []
  }, [date])

  const entries = useMemo(() => {
    if (!pending.size) return base
    const apply = (e: AgendaEntry, block: Block | null): AgendaEntry => ({ ...e, date, slot: block ?? undefined, duration: block?.duration ?? e.duration })
    const merged = base.map((e) => (pending.has(e.key) ? apply(e, pending.get(e.key)!.block) : e))
    for (const [key, p] of pending) if (!base.some((e) => e.key === key)) merged.push(apply(p.entry, p.block))
    return merged
  }, [base, pending, date])

  const plan = useMemo(() => buildDayPlan(entries), [entries])

  const undo = useCallback(async () => {
    const entry = history.current.pop()
    if (!entry) return void toast('Nothing to undo')
    await services.agenda.restore(userId, entry.before)
    toast(`Undid: ${entry.label}`)
  }, [services, userId])

  const record = useCallback(
    (before: AnyEntity[], label: string) => {
      history.current = [...history.current.slice(-MAX_HISTORY + 1), { before, label }]
      toast(label, { action: { label: 'Undo', onClick: () => void undo() } })
    },
    [undo],
  )

  const move = useCallback(
    async (entry: AgendaEntry, block: Block | null) => {
      setPending((p) => new Map(p).set(entry.key, { entry, block }))
      try {
        const before = await services.agenda.schedule(userId, entry.ref, date, block)
        record([before], block ? `${entry.slot ? 'Moved' : 'Planned'} “${entry.title}” at ${formatClock(block.start)}` : `Took “${entry.title}” off the timeline`)
      } catch (e) {
        setPending((p) => {
          const next = new Map(p)
          next.delete(entry.key)
          return next
        })
        toast.error(e instanceof Error ? e.message : 'Couldn’t move that')
      }
    },
    [services, userId, date, record],
  )

  const schedule = useCallback((entry: AgendaEntry, block: Block) => move(entry, clampBlock(block)), [move])
  const unschedule = useCallback((entry: AgendaEntry) => move(entry, null), [move])

  const reflow = useCallback(
    async (from: number, gap: number, includeUnplanned: boolean) => {
      const before = await services.agenda.reflow(userId, date, { from, gap, includeUnplanned })
      if (before.length === 0) {
        toast(includeUnplanned ? 'Nothing more fits today' : 'Already in flow — nothing to move')
        return 0
      }
      record(before, includeUnplanned ? `Planned ${before.length} item${before.length > 1 ? 's' : ''}` : `Reflowed ${before.length} block${before.length > 1 ? 's' : ''}`)
      return before.length
    },
    [services, userId, date, record],
  )

  return { entries, plan, ready: !isLoading, schedule, unschedule, reflow, undo }
}
