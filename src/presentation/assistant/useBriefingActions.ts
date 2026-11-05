import { useCallback } from 'react'
import type { ISODate, Minutes } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'
import { useEntities, useUserId } from '@/presentation/data/hooks'

/**
 * What can be done to an item on a briefing without leaving it: finish it, or move it to another day or time. These go straight to
 * the app's own records (the same as doing it on the Tasks page), not through the agent.
 */
export function useBriefingActions() {
  const services = useServices()
  const userId = useUserId()
  const tasks = useEntities('task').data
  const followUps = useEntities('followUp').data
  const meetings = useEntities('meeting').data

  const complete = useCallback(
    async (type: 'task' | 'followUp', id: string) => {
      try {
        await services.outcomes.execute(userId, { kind: type, id }, { status: 'done' })
      } catch (e) {
        toast.error('Couldn’t mark it done', { description: e instanceof Error ? e.message : undefined })
      }
    },
    [services, userId],
  )

  const reopen = useCallback(
    async (type: 'task' | 'followUp', id: string) => {
      try {
        await services.outcomes.execute(userId, { kind: type, id }, { status: 'open' })
      } catch (e) {
        toast.error('Couldn’t reopen it', { description: e instanceof Error ? e.message : undefined })
      }
    },
    [services, userId],
  )

  /** To a day, and to a time on it when one is given. A meeting always has a time, so it keeps its own. */
  const move = useCallback(
    async (type: 'task' | 'followUp' | 'meeting', id: string, date: ISODate, start?: Minutes) => {
      try {
        if (type === 'task') {
          const t = tasks.find((x) => x.id === id)
          if (!t) throw new Error('That task is gone.')
          await services.crud.task.update({ ...t, dueDate: date, slot: start === undefined ? undefined : { date, start, duration: t.slot?.duration ?? t.estimate } })
        } else if (type === 'followUp') {
          const f = followUps.find((x) => x.id === id)
          if (!f) throw new Error('That follow-up is gone.')
          await services.crud.followUp.update({ ...f, due: start === undefined ? { date } : { date, time: start } })
        } else {
          const m = meetings.find((x) => x.id === id)
          if (!m) throw new Error('That meeting is gone.')
          await services.agenda.schedule(userId, { kind: 'meeting', id }, date, { start: start ?? m.slot.start, duration: m.slot.duration })
        }
        toast.success('Moved')
      } catch (e) {
        toast.error('Couldn’t move it', { description: e instanceof Error ? e.message : undefined })
      }
    },
    [services, userId, tasks, followUps, meetings],
  )

  return { complete, reopen, move, tasks, followUps }
}
