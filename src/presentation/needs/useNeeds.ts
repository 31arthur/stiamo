import { useMemo } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import type { AttentionItem, DayPlan, WaitingProposal } from '@/domain/ai/AgentApi'
import type { Hearing } from '@/domain/cases/LegalCase'
import type { FollowUp } from '@/domain/followups/FollowUp'
import type { Meeting } from '@/domain/meetings/Meeting'
import type { Task } from '@/domain/tasks/Task'
import { useAgentAvailable, useAgentAttention, useDayPlans, useWaitingProposals } from '@/presentation/agents/useAgent'
import { useAttention } from '@/presentation/app/attention'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { useEntities, useToday } from '@/presentation/data/hooks'

/** The groups of the queue, most pressing first. */
export const SECTIONS = ['urgent', 'late', 'approve', 'today', 'record', 'mail'] as const
export type NeedSection = (typeof SECTIONS)[number]

export type Need =
  | { key: string; section: NeedSection; kind: 'mail'; item: AttentionItem }
  | { key: string; section: NeedSection; kind: 'followUp'; item: FollowUp; late: boolean }
  | { key: string; section: NeedSection; kind: 'task'; item: Task; late: boolean }
  | { key: string; section: NeedSection; kind: 'meeting'; item: Meeting }
  | { key: string; section: NeedSection; kind: 'hearing'; item: Hearing }
  | { key: string; section: NeedSection; kind: 'proposal'; item: WaitingProposal }
  | { key: string; section: NeedSection; kind: 'plan'; item: DayPlan }

const byDue = (a: { date: string; time: number }, b: { date: string; time: number }) => a.date.localeCompare(b.date) || a.time - b.time

/**
 * Everything waiting on you, from every place it lives: mail your agents flagged, overdue and due-today tasks and follow-ups, what agents
 * proposed and the evening plan waiting for a yes, and meetings and hearings still to write up. One list, in the order to deal with it.
 */
export function useNeeds() {
  const today = useToday()
  const { scope, matches } = useWorkspaceFilter()
  const available = useAgentAvailable()
  const attention = useAttention()
  const { data: tasks } = useEntities('task')
  const mail = useAgentAttention(scope === 'all' ? undefined : scope, available).data?.items
  const proposals = useWaitingProposals().data
  const plans = useDayPlans(available).data?.plans

  return useMemo(() => {
    const needs: Need[] = []
    for (const i of mail ?? []) needs.push({ key: `mail:${i.agentId}/${i.itemId}`, section: i.priority === 'high' ? 'urgent' : 'mail', kind: 'mail', item: i })
    const lateTasks = new Set(attention.overdueTasks.map((t) => t.id))
    for (const t of attention.overdueTasks) needs.push({ key: `task:${t.id}`, section: 'late', kind: 'task', item: t, late: true })
    for (const t of tasks) {
      if (t.outcome.status !== 'open' || lateTasks.has(t.id) || !matches(t.workspace)) continue
      if ((t.slot?.date ?? t.dueDate) === today) needs.push({ key: `task:${t.id}`, section: 'today', kind: 'task', item: t, late: false })
    }
    for (const f of attention.dueFollowUps) {
      const late = !!f.due && f.due.date < today
      needs.push({ key: `followUp:${f.id}`, section: late ? 'late' : 'today', kind: 'followUp', item: f, late })
    }
    for (const m of attention.meetingsToRecord) needs.push({ key: `meeting:${m.id}`, section: 'record', kind: 'meeting', item: m })
    for (const h of attention.hearingsToRecord) needs.push({ key: `hearing:${h.id}`, section: 'record', kind: 'hearing', item: h })
    for (const p of proposals ?? []) needs.push({ key: `proposal:${p.id}`, section: 'approve', kind: 'proposal', item: p })
    for (const p of (plans ?? []).filter((x) => x.status === 'proposed')) needs.push({ key: `plan:${p.id}`, section: 'approve', kind: 'plan', item: p })

    const when = (n: Need): { date: string; time: number } => {
      if (n.kind === 'followUp') return { date: n.item.due?.date ?? today, time: n.item.due?.time ?? 24 * 60 }
      if (n.kind === 'task') return { date: n.item.slot?.date ?? n.item.dueDate ?? today, time: n.item.slot?.start ?? 24 * 60 }
      return { date: today, time: 0 }
    }
    needs.sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || byDue(when(a), when(b)) || a.key.localeCompare(b.key))
    const count = (s: NeedSection) => needs.filter((n) => n.section === s).length
    return { needs, total: needs.length, urgent: count('urgent') + count('late'), count, tomorrow: format(addDays(parseISO(today), 1), 'yyyy-MM-dd') }
  }, [mail, attention, tasks, proposals, plans, matches, today])
}
