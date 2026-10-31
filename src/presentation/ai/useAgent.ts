import { useCallback, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AgentApi, AgentDetail, AgentSettings, AgentSummary, Channel } from '@/domain/ai/AgentApi'
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

// --- which agent a person is looking at -----------------------------------------------------------------------

const AGENT_KEY = 'stiamo.ai.agent'
const listeners = new Set<() => void>()
const read = () => {
  try {
    return localStorage.getItem(AGENT_KEY) ?? ''
  } catch {
    return ''
  }
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** The agent chosen on the AI pages, remembered in this browser. Falls back to the server's default if it no longer exists. */
export function useCurrentAgent() {
  const { settings } = useAgentSettings()
  const stored = useSyncExternalStore(subscribe, read)
  const agents: AgentSummary[] = settings?.agents ?? []
  const current = agents.find((a) => a.id === stored) ?? agents.find((a) => a.id === settings?.defaultAgent) ?? agents[0]
  const choose = useCallback((id: string) => {
    try {
      localStorage.setItem(AGENT_KEY, id)
    } catch {
      // Remembering it is a convenience.
    }
    listeners.forEach((l) => l())
  }, [])
  return { agents, agent: current, choose }
}

/** One agent with its prompt, defaults and variables. */
export function useAgentDetail(agentId: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<AgentDetail>({ queryKey: ['agent', 'detail', userId, agentId], queryFn: () => agent.agent(agentId!), enabled: !!agentId, retry: false })
}
