import { useMemo } from 'react'
import { unrecordedHearings } from '@/domain/cases/LegalCase'
import { followUpKey } from '@/domain/followups/FollowUp'
import { minutesOf } from '@/domain/shared/time'
import { isOverdue } from '@/domain/tasks/Task'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { useWorkspaceFilter } from './workspaceFilter'

/**
 * What is slipping: overdue tasks, follow-ups that are due, meetings that happened without a
 * recorded outcome, and hearings that haven't been written up.
 */
export function useAttention() {
  const today = useToday()
  const { matches } = useWorkspaceFilter()
  const { data: tasks } = useEntities('task')
  const { data: followUps } = useEntities('followUp')
  const { data: meetings } = useEntities('meeting')
  const { data: hearings } = useEntities('hearing')

  return useMemo(() => {
    const nowMinute = minutesOf(new Date())
    const overdueTasks = tasks.filter((t) => matches(t.workspace) && isOverdue(t, today))
    const dueFollowUps = followUps
      .filter((f) => matches(f.workspace) && f.outcome.status === 'open' && f.due.date <= today)
      .sort((a, b) => followUpKey(a).localeCompare(followUpKey(b)))
    const meetingsToRecord = meetings.filter(
      (m) =>
        matches(m.workspace) &&
        m.outcome.status === 'open' &&
        (m.slot.date < today || (m.slot.date === today && m.slot.start + m.slot.duration <= nowMinute)),
    )
    const hearingsToRecord = matches('sb') ? unrecordedHearings(hearings, today) : []
    return {
      overdueTasks,
      dueFollowUps,
      meetingsToRecord,
      hearingsToRecord,
      total: overdueTasks.length + dueFollowUps.length + meetingsToRecord.length + hearingsToRecord.length,
    }
  }, [tasks, followUps, meetings, hearings, matches, today])
}
