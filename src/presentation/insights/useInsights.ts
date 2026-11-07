import { useQuery } from '@tanstack/react-query'
import type { Insights } from '@/domain/ai/AgentApi'
import type { WorkspaceScope } from '@/domain/shared/workspace'
import { useAgentAvailable } from '@/presentation/agents/useAgent'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'

/** What mail, news and work add up to over a period, for a workspace or all of them. Looked at again every few minutes. */
export function useInsights(scope: WorkspaceScope, days: number) {
  const { agent } = useServices()
  const userId = useUserId()
  const enabled = useAgentAvailable()
  return useQuery<Insights>({ queryKey: ['agent', 'insights', userId, scope, days], queryFn: () => agent.insights(scope, days), enabled, staleTime: 60_000, refetchInterval: 5 * 60_000, placeholderData: (prev) => prev, retry: false })
}
