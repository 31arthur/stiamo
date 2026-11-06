import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/presentation/notifications/toast'
import type { MailWatch, Theme, EnvVariable, ReminderSettings, DayPlan, DayPlanSchedule, DayPlanSettings, NewsSort, NewsStory, ListenStatus, AttentionItem, Sweep, UsagePage, UsageSummary, AgentApi, Execution, ExecutionDetail, AgentDetail, AgentSettings, AgentStats, AgentSummary, Channel, ReviewItem, Workflow } from '@/domain/ai/AgentApi'
import { PROVIDER_IDS } from '@/domain/ai/types'
import type { ModelInfo, ProviderId } from '@/domain/ai/types'
import { useServices } from '@/presentation/app/services'
import { useScope } from '@/presentation/app/workspaceFilter'
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

/** What every agent has used (or one agent), over the last `days` days or all time. */
export function useUsageSummary(days: number | null, agentId?: string) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<UsageSummary>({ queryKey: ['agent', 'usage', userId, days, agentId], queryFn: () => agent.usageSummary(days, agentId), enabled: useAgentAvailable(), staleTime: 15_000, retry: false })
}

/** Every run and what it used, newest first, a page at a time. */
export function useUsageTransactions(days: number | null, agentId?: string) {
  const { agent } = useServices()
  const userId = useUserId()
  return useInfiniteQuery({
    queryKey: ['agent', 'usage-runs', userId, days, agentId],
    queryFn: ({ pageParam }) => agent.usageTransactions({ days, agent: agentId, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: UsagePage) => last.nextBefore ?? undefined,
    enabled: useAgentAvailable(),
    staleTime: 15_000,
    retry: false,
  })
}

/** What the agents found that needs you. Checked every minute, so a new item shows up without a refresh. */
export function useAgentAttention(workspace?: string, enabled = true) {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<{ items: AttentionItem[]; count: number }>({ queryKey: ['agent', 'attention', userId, workspace ?? 'all'], queryFn: () => agent.attention(workspace), enabled: available && enabled, refetchInterval: 60_000, staleTime: 15_000, retry: false })
}

/** The evening plan: its settings, and the plans made for the latest days. Looked at every minute, so a plan made at nine shows up on its own. */
export function useDayPlans(enabled = true) {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<{ settings: DayPlanSettings; schedule: DayPlanSchedule; plans: DayPlan[] }>({ queryKey: ['agent', 'dayPlans', userId], queryFn: () => agent.dayPlans(), enabled: available && enabled, refetchInterval: 60_000, staleTime: 15_000, retry: false })
}

/** Whether reminders about calls not marked done are on, and whether they are spoken. */
export function useReminders() {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<ReminderSettings>({ queryKey: ['agent', 'reminders', userId], queryFn: () => agent.reminders(), enabled: available, staleTime: 30_000, retry: false })
}

/** The organisation themes: how replies to each organisation sound and look. */
export function useThemes() {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<Theme[]>({ queryKey: ['agent', 'themes', userId], queryFn: () => agent.themes(), enabled: available, staleTime: 30_000, retry: false })
}

/** The priority mail watch of each workspace with a mailbox. Asking for it also makes any that is missing, and its state is looked at every half minute. */
export function useMailWatch() {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<MailWatch[]>({ queryKey: ['agent', 'mailWatch', userId], queryFn: () => agent.mailWatch(), enabled: available, staleTime: 15_000, refetchInterval: 30_000, retry: false })
}

/** The environment variables you can set, and which are set. Never their values. */
export function useEnvironment() {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<EnvVariable[]>({ queryKey: ['agent', 'environment', userId], queryFn: () => agent.environment(), enabled: available, staleTime: 30_000, retry: false })
}

/** The top stories. Looked at again every five minutes. */
export function useNews(workspace: string | undefined, days: number, sort: NewsSort) {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<{ items: NewsStory[]; total: number; sort: NewsSort; generatedAt: string }>({ queryKey: ['agent', 'news', userId, workspace ?? 'all', days, sort], queryFn: () => agent.news(workspace, days, sort), enabled: available, refetchInterval: 5 * 60_000, staleTime: 60_000, retry: false })
}

/** Whether the agent is listening to its mailbox. Looked at every 20 seconds while it is. */
export function useListen(id: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<ListenStatus>({ queryKey: ['agent', 'listen', userId, id], queryFn: () => agent.listenStatus(id!), enabled: !!id && available, refetchInterval: (q) => (q.state.data?.listening ? 20_000 : false), staleTime: 10_000, retry: false })
}

/** The run through the whole inbox: refreshed every couple of seconds while it is going, and not at all once it has ended. */
export function useSweep(id: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  return useQuery<Sweep | null>({
    queryKey: ['agent', 'sweep', userId, id],
    queryFn: () => agent.sweepStatus(id!),
    enabled: !!id && available,
    refetchInterval: (q) => (q.state.data?.state === 'running' ? 2000 : false),
    staleTime: 0,
    retry: false,
  })
}

/** Every real run of an agent you built, newest first. */
export function useExecutions(id: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<Execution[]>({ queryKey: ['agent', 'executions', userId, id], queryFn: () => agent.executions(id!), enabled: !!id, retry: false })
}

/** One run and every item it decided, as it stands now. */
export function useExecution(id: string | undefined, runId: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<ExecutionDetail>({ queryKey: ['agent', 'execution', userId, id, runId], queryFn: () => agent.execution(id!, runId!), enabled: !!id && !!runId, retry: false })
}

/** The agents listed in the workspace you are in; under "All workspaces", every agent. */
export function useScopedAgents() {
  const { settings, loading } = useAgentSettings()
  const scope = useScope()
  const all: AgentSummary[] = settings?.agents ?? []
  return { scope, all, agents: scope === 'all' ? all : all.filter((a) => a.workspaces.includes(scope)), loading }
}
