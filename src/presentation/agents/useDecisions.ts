import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ExecutionDetail, LedgerStatus, ReviewItem } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'

export interface DecisionGroup {
  ids: string[]
  /** The label to use instead of the agent's (one email at a time). */
  label?: string
}

/** A run as it will look once these emails are approved or dismissed: their rows change, and the run's live counts follow. */
export function decided(d: ExecutionDetail, labelFor: Map<string, string | undefined>, status: LedgerStatus): ExecutionDetail {
  const items = d.items.map((i) => (labelFor.has(i.id) ? { ...i, status, label: labelFor.get(i.id) ?? i.label, decidedAt: new Date().toISOString() } : i))
  const now: ExecutionDetail['execution']['now'] = {}
  for (const i of items) now[i.status] = (now[i.status] ?? 0) + 1
  return { ...d, items, execution: { ...d.execution, now } }
}

/**
 * Approving and dismissing, made to feel instant. The emails leave the list the moment you press the button; the server is told in
 * the background, a toast says when it is done (or what went wrong), and if it fails the list goes back as it was.
 */
export function useDecisions(workflowId: string | undefined) {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()

  return useCallback(
    async (groups: DecisionGroup[], action: 'approve' | 'dismiss', opts: { moving?: number; note?: string } = {}) => {
      if (!workflowId || groups.every((g) => g.ids.length === 0)) return
      const labelFor = new Map(groups.flatMap((g) => g.ids.map((id) => [id, g.label] as const)))
      const total = labelFor.size
      const executionKey = ['agent', 'execution', userId, workflowId]
      const reviewKey = ['agent', 'review', userId, workflowId]

      // What is on screen now, to put back if the server says no.
      const before = [...client.getQueriesData<ExecutionDetail>({ queryKey: executionKey }), ...client.getQueriesData<ReviewItem[]>({ queryKey: reviewKey })]
      const status: LedgerStatus = action === 'approve' ? 'approved' : 'dismissed'
      client.setQueriesData<ExecutionDetail>({ queryKey: executionKey }, (d) => d && decided(d, labelFor, status))
      client.setQueriesData<ReviewItem[]>({ queryKey: reviewKey }, (d) => d?.filter((i) => !labelFor.has(i.id)))

      const pending = toast.loading(action === 'dismiss' ? `Dismissing ${total}…` : opts.moving ? `Moving ${opts.moving} to Trash…` : `Approving ${total}…`)
      let changed = 0
      let moved = 0
      try {
        for (const g of groups) {
          if (g.ids.length === 0) continue
          const r = await agent.decideReview(workflowId, g.ids, action, g.label, opts.note)
          changed += r.changed
          moved += r.moved ?? 0
        }
        if (changed === 0) throw new Error('Choose a label first.')
        toast.success(action === 'approve' ? `Approved ${changed}${moved ? `, moved ${moved} to Trash` : ''}` : `Dismissed ${changed}`, { id: pending })
      } catch (e) {
        for (const [key, data] of before) client.setQueryData(key, data)
        toast.error('Couldn’t save that. It is back in the list.', { id: pending, description: e instanceof Error ? e.message : undefined })
      } finally {
        for (const key of ['execution', 'executions', 'review', 'workflow']) void client.invalidateQueries({ queryKey: ['agent', key] })
      }
    },
    [workflowId, agent, client, userId],
  )
}
