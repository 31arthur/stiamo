import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
 * The planner's state: the day's agenda from the query cache, changed optimistically so drops land
 * instantly, persisted through the agenda use cases, with an undo stack of prior snapshots.
 */
export function useDayPlanner(date: ISODate) {
  const services = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const { data: entries, isLoading, queryKey } = useAgenda(date, date)
  const plan = useMemo(() => buildDayPlan(entries), [entries])
  const history = useRef<HistoryEntry[]>([])

  useEffect(() => {
    history.current = []
  }, [date])

  const refresh = useCallback(() => client.invalidateQueries(), [client])

  const undo = useCallback(async () => {
    const entry = history.current.pop()
    if (!entry) return void toast('Nothing to undo')
    await services.agenda.restore(userId, entry.before)
    await refresh()
    toast(`Undid: ${entry.label}`)
  }, [services, userId, refresh])

  const record = useCallback(
    (before: AnyEntity[], label: string) => {
      history.current = [...history.current.slice(-MAX_HISTORY + 1), { before, label }]
      toast(label, { action: { label: 'Undo', onClick: () => void undo() } })
    },
    [undo],
  )

  /** Puts the change into the cached agenda immediately (adding the entry if it came from another day). */
  const patchLocal = useCallback(
    (entry: AgendaEntry, block: Block | null) =>
      client.setQueryData<AgendaEntry[]>([...queryKey], (old = []) => {
        const next = { ...entry, date, slot: block ?? undefined, duration: block?.duration ?? entry.duration }
        return old.some((e) => e.key === entry.key) ? old.map((e) => (e.key === entry.key ? next : e)) : [...old, next]
      }),
    [client, queryKey, date],
  )

  const schedule = useCallback(
    async (entry: AgendaEntry, block: Block) => {
      const b = clampBlock(block)
      patchLocal(entry, b)
      try {
        const before = await services.agenda.schedule(userId, entry.ref, date, b)
        record([before], `${entry.slot ? 'Moved' : 'Planned'} “${entry.title}” at ${formatClock(b.start)}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Couldn’t move that')
      } finally {
        await refresh()
      }
    },
    [patchLocal, services, userId, date, record, refresh],
  )

  const unschedule = useCallback(
    async (entry: AgendaEntry) => {
      patchLocal(entry, null)
      try {
        const before = await services.agenda.schedule(userId, entry.ref, date, null)
        record([before], `Took “${entry.title}” off the timeline`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Couldn’t unplan that')
      } finally {
        await refresh()
      }
    },
    [patchLocal, services, userId, date, record, refresh],
  )

  const reflow = useCallback(
    async (from: number, gap: number, includeUnplanned: boolean) => {
      const before = await services.agenda.reflow(userId, date, { from, gap, includeUnplanned })
      await refresh()
      if (before.length === 0) {
        toast(includeUnplanned ? 'Nothing more fits today' : 'Already in flow — nothing to move')
        return 0
      }
      record(before, includeUnplanned ? `Planned ${before.length} item${before.length > 1 ? 's' : ''}` : `Reflowed ${before.length} block${before.length > 1 ? 's' : ''}`)
      return before.length
    },
    [services, userId, date, refresh, record],
  )

  return { entries, plan, ready: !isLoading, schedule, unschedule, reflow, undo }
}
