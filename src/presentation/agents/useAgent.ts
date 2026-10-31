import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AgentApi, AgentDetail, AgentSettings, AgentStats, AgentSummary, Channel, ReviewItem, Workflow } from '@/domain/ai/AgentApi'
import { PROVIDER_IDS } from '@/domain/ai/types'
import type { ModelInfo, ProviderId } from '@/domain/ai/types'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'

/** Whether the agent can be used here at all: it lives in the Stiamo backend. */
export function useAgentAvailable() {
  return useServices().backend === 'api'
}

/** What is set: providers, the model, the decision model and the prompt. */
export function useAgentSettings() {
  const { agent } = useServices()
  const userId = useUserId()
  const enabled = useAgentAvailable()
  const query = useQuery<AgentSettings>({ queryKey: ['agent', 'settings', userId], queryFn: () => agent.settings(), enabled, staleTime: 30_000, retry: false })
  const connected: ProviderId[] = PROVIDER_IDS.filter((id) => query.data?.providers[id]?.connected)
  return { settings: query.data, connected, loading: enabled && query.isLoading, error: query.error instanceof Error ? query.error.message : null }
}

/** What a provider offers this key, asked of the provider itself so it is always current. */
export function useModels(provider: ProviderId | undefined, connected: boolean) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<ModelInfo[]>({ queryKey: ['agent', 'models', userId, provider], queryFn: () => agent.models(provider!), enabled: !!provider && connected, staleTime: 10 * 60_000, retry: false })
}

export function useChannels() {
  const { agent } = useServices()
  const userId = useUserId()
  const enabled = useAgentAvailable()
  const query = useQuery<Channel[]>({ queryKey: ['agent', 'channels', userId], queryFn: () => agent.channels(), enabled, retry: false })
  return { channels: query.data ?? [], loading: enabled && query.isLoading, error: query.error instanceof Error ? query.error.message : null }
}

/** Runs a change on the agent, then refreshes what is shown. Errors become toasts. */
export function useAgentAction<TArgs, TResult>(run: (agent: AgentApi, args: TArgs) => Promise<TResult>, options: { success?: string | ((r: TResult) => string | undefined) } = {}) {
  const { agent } = useServices()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (args: TArgs) => run(agent, args),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['agent'] })
      const message = typeof options.success === 'function' ? options.success(result) : options.success
      if (message) toast.success(message)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })
  return { run: mutation.mutateAsync, pending: mutation.isPending }
}

/** One agent as the settings list it, by id. Undefined while loading, or when there is no such agent. */
export function useAgentSummary(agentId: string | undefined): AgentSummary | undefined {
  const { settings } = useAgentSettings()
  return settings?.agents.find((a) => a.id === agentId)
}

/** How an agent has been doing. */
export function useAgentStats(agentId: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<AgentStats>({ queryKey: ['agent', 'stats', userId, agentId], queryFn: () => agent.stats(agentId!), enabled: !!agentId, staleTime: 15_000, retry: false })
}

/** One agent with its prompt, defaults and variables. */
export function useAgentDetail(agentId: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<AgentDetail>({ queryKey: ['agent', 'detail', userId, agentId], queryFn: () => agent.agent(agentId!), enabled: !!agentId, retry: false })
}

/** An agent someone built: its setup and how many items wait for them. */
export function useWorkflow(id: string | undefined, enabled = true) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<Workflow>({ queryKey: ['agent', 'workflow', userId, id], queryFn: () => agent.workflow(id!), enabled: enabled && !!id, retry: false })
}

/** What an agent proposed or wasn't sure about, waiting for a person. */
export function useReview(id: string | undefined, enabled = true) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<ReviewItem[]>({ queryKey: ['agent', 'review', userId, id], queryFn: () => agent.review(id!), enabled: enabled && !!id, retry: false })
}
