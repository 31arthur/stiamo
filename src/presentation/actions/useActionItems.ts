import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ActionItem } from '@/domain/ai/AgentApi'
import { useAgentAvailable, useWaitingProposals, useDayPlans } from '@/presentation/agents/useAgent'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'

export const GROUPS = ['late', 'today', 'soon', 'later', 'unplaced'] as const
export type Group = (typeof GROUPS)[number]

/** Which group an item is in, by its day (or the day it is due when it is not placed). */
export function groupOf(i: ActionItem, today: string): Group {
  if (i.daysLate && i.daysLate > 0) return 'late'
  const d = i.day ?? i.due
  if (!d) return 'unplaced'
  if (d <= today) return 'today'
  const ahead = (Date.parse(d) - Date.parse(today)) / 86_400_000
  return ahead <= 7 ? 'soon' : 'later'
}

/** Every open action item, from every workspace (or the one you are in), read from the backend in one shape. */
export function useActionItems() {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  const { scope, matches } = useWorkspaceFilter()
  const query = useQuery({ queryKey: ['agent', 'action-items', userId], queryFn: () => agent.actionItems(), enabled: available, staleTime: 15_000, refetchInterval: 60_000, retry: false })
  const today = query.data?.today ?? ''
  const items = useMemo(() => (query.data?.items ?? []).filter((i) => scope === 'all' || matches(i.workspace as never)), [query.data, scope, matches])
  const groups = useMemo(() => {
    const by: Record<Group, ActionItem[]> = { late: [], today: [], soon: [], later: [], unplaced: [] }
    for (const i of items) by[groupOf(i, today)].push(i)
    return by
  }, [items, today])
  return { items, groups, today, loading: available && query.isLoading, error: query.error instanceof Error ? query.error.message : null, urgent: groups.late.length > 0 }
}

/** What the sidebar shows: what is late or today, and what is waiting for a yes. */
export function useActionCount() {
  const { groups } = useActionItems()
  const waiting = useWaitingProposals().data?.length ?? 0
  const plans = useDayPlans().data?.plans.filter((p) => p.status === 'proposed').length ?? 0
  return { total: groups.late.length + groups.today.length + waiting + plans, urgent: groups.late.length > 0 }
}

/** Done, cancel, move or snooze one item. The answer says what happened, and the toast can undo it. */
export function useActOnItem() {
  const { agent } = useServices()
  const client = useQueryClient()
  const refresh = () => void client.invalidateQueries()
  const m = useMutation({
    mutationFn: (a: { ref: string; action: 'complete' | 'cancel' | 'reopen' | 'move' | 'snooze'; to?: string }) => agent.actOnItem(a.ref, a.action, a.to),
    onSuccess: (r) => {
      refresh()
      toast.success(r.did, r.changesetId ? { action: { label: 'Undo', onClick: () => void agent.undoChange(r.changesetId).then(refresh).catch(() => toast.error('Couldn’t undo that')) } } : undefined)
    },
    onError: (e) => toast.error('Couldn’t do that', { description: e instanceof Error ? e.message : undefined }),
  })
  return { act: m.mutate, pending: m.isPending }
}
