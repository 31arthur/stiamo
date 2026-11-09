import type { AgentApi, Conversation, ConversationSummary, ConversationTurn, DayPlan, DayPlanSchedule, DayPlanSettings, Delivery, EnvVariable, Health, WaitingProposal, InsightDigest, Insights, MailWatch, ReminderSettings, Theme, NewsSort, NewsStory, ListenStatus, AttentionEvent, AttentionItem, Sweep, UsagePage, UsageSummary, FeedbackSuggestion, Execution, ExecutionDetail, PromptPreview, SafeSenders, AgentDetail, AgentSettings, AgentStats, ReviewItem, RunDetail, RunPage, Workflow, WorkflowConfig, WorkflowRun, Channel, ChatReply, DecisionQuestion, DecisionResult, PromptPackage, PromptSettings, WhatsAppConnection } from '@/domain/ai/AgentApi'
import type { WorkspaceId } from '@/domain/shared/workspace'
import type { AiSelection, ModelInfo, ProviderId } from '@/domain/ai/types'
import { ApiHttp } from './ApiHttp'

/** The AI agent through the backend's `agent` service. Keys, prompt and channels are kept there. */
export class RemoteAgent implements AgentApi {
  constructor(private readonly http: ApiHttp) {}

  async settings(): Promise<AgentSettings> {
    const s = await this.http.get<AgentSettings>('/v1/agent/settings')
    // A server that hasn't been updated yet leaves out what newer versions added (`kind`, `workspaces`): fill it in, so the app works with either.
    return { ...s, agents: (s.agents ?? []).map((a) => ({ ...a, kind: a.kind ?? 'chat', workspaces: a.workspaces ?? [] })) }
  }

  async putKey(provider: ProviderId, apiKey: string): Promise<ModelInfo[]> {
    return (await this.http.put<{ models: ModelInfo[] }>(`/v1/agent/providers/${provider}`, { apiKey })).models
  }

  async removeKey(provider: ProviderId) {
    await this.http.delete(`/v1/agent/providers/${provider}`)
  }

  async models(provider: ProviderId): Promise<ModelInfo[]> {
    return (await this.http.get<{ items: ModelInfo[] }>(`/v1/agent/providers/${provider}/models`)).items
  }

  async setDecision(enabled: boolean, modelId: string) {
    await this.http.put('/v1/agent/decision', { enabled, modelId })
  }

  agent(agentId: string) {
    return this.http.get<AgentDetail>(`/v1/agent/agents/${encodeURIComponent(agentId)}`)
  }

  async setSelection(agentId: string, s: AiSelection) {
    await this.http.put(`/v1/agent/agents/${encodeURIComponent(agentId)}/selection`, { providerId: s.providerId, modelId: s.modelId, thinking: s.thinking })
  }

  async setPrompt(agentId: string, prompt: PromptSettings) {
    await this.http.put(`/v1/agent/agents/${encodeURIComponent(agentId)}/prompt`, prompt)
  }

  async resetPrompt(agentId: string) {
    await this.http.delete(`/v1/agent/agents/${encodeURIComponent(agentId)}/prompt`)
  }

  preview(agentId: string, question: string, prompt?: PromptSettings) {
    return this.http.post<PromptPackage>(`/v1/agent/agents/${encodeURIComponent(agentId)}/prompt/preview`, { question, prompt })
  }

  chat(agentId: string, message: string, messages: unknown[]) {
    return this.http.post<ChatReply>(`/v1/agent/agents/${encodeURIComponent(agentId)}/chat`, { message, messages })
  }

  stats(agentId: string) {
    return this.http.get<AgentStats>(`/v1/agent/agents/${encodeURIComponent(agentId)}/stats`)
  }

  usageSummary(days: number | null, agent?: string) {
    return this.http.get<UsageSummary>('/v1/agent/usage/summary', { days: days ?? undefined, agent })
  }

  usageTransactions(opts: { days: number | null; agent?: string; before?: string }) {
    return this.http.get<UsagePage>('/v1/agent/usage/transactions', { days: opts.days ?? undefined, agent: opts.agent, before: opts.before, limit: 50 })
  }

  runs(agentId: string, before?: string) {
    return this.http.get<RunPage>(`/v1/agent/agents/${encodeURIComponent(agentId)}/runs`, { limit: 30, before })
  }

  async run(runId: string): Promise<RunDetail> {
    // The server calls the steps `steps`; here they are `stepLog` so a summary's step count and a detail's steps don't share a name.
    const r = await this.http.get<Omit<RunDetail, 'stepLog'> & { steps: RunDetail['stepLog'] }>(`/v1/agent/runs/${encodeURIComponent(runId)}`)
    const { steps, ...rest } = r
    return { ...rest, steps: steps.length, stepLog: steps }
  }

  async clearRuns(agentId: string) {
    await this.http.delete(`/v1/agent/agents/${encodeURIComponent(agentId)}/runs`)
  }

  decide(state: string, questions: Record<string, DecisionQuestion>, modelId?: string) {
    return this.http.post<DecisionResult>('/v1/agent/decide', { state, questions, modelId })
  }

  workflow(id: string) {
    return this.http.get<Workflow>(`/v1/agent/workflows/${encodeURIComponent(id)}`)
  }

  createWorkflow(name: string, description: string, config: WorkflowConfig, workspaces: string[] = []) {
    return this.http.post<Workflow>('/v1/agent/workflows', { name, description, config, workspaces })
  }

  async setWorkspaces(agentId: string, workspaces: string[]) {
    await this.http.put(`/v1/agent/agents/${encodeURIComponent(agentId)}/workspaces`, { workspaces })
  }

  updateWorkflow(id: string, name: string, description: string, config: WorkflowConfig) {
    return this.http.put<Workflow>(`/v1/agent/workflows/${encodeURIComponent(id)}`, { name, description, config })
  }

  async deleteWorkflow(id: string) {
    await this.http.delete(`/v1/agent/workflows/${encodeURIComponent(id)}`)
  }

  async safeSenders(accountIds: string[]) {
    return (await this.http.post<{ items: SafeSenders[] }>('/v1/agent/workflows/safe-senders', { accountIds })).items
  }

  promptPreview(config: WorkflowConfig) {
    return this.http.post<PromptPreview>('/v1/agent/workflows/prompt-preview', { config })
  }

  testDraft(config: WorkflowConfig, manual?: string) {
    return this.http.post<WorkflowRun>('/v1/agent/workflows/test', { config, manual })
  }

  testWorkflow(id: string, manual?: string) {
    return this.http.post<WorkflowRun>(`/v1/agent/workflows/${encodeURIComponent(id)}/test`, { manual })
  }

  runWorkflow(id: string, manual?: string) {
    return this.http.post<WorkflowRun>(`/v1/agent/workflows/${encodeURIComponent(id)}/run`, { manual })
  }

  attention(workspace?: string) {
    return this.http.get<{ items: AttentionItem[]; count: number }>('/v1/agent/attention', { workspace })
  }

  actOnAttention(a: { agentId: string; itemId: string; action: 'done' | 'dismiss' | 'approve_event' | 'skip_event'; event?: AttentionEvent }) {
    return this.http.post<{ status: string; meetingId?: string }>('/v1/agent/attention/act', a)
  }

  async conversations(workspace: string) {
    return (await this.http.get<{ items: ConversationSummary[] }>('/v1/agent/conversations', { workspace })).items
  }

  conversation(id: string) {
    return this.http.get<Conversation>(`/v1/agent/conversations/${encodeURIComponent(id)}`)
  }

  startConversation(agentId: string, workspace: string) {
    return this.http.post<Conversation>('/v1/agent/conversations', { agentId, workspace })
  }

  say(id: string, message: string) {
    return this.http.post<{ turn: ConversationTurn; conversation: ConversationSummary }>(`/v1/agent/conversations/${encodeURIComponent(id)}/messages`, { message })
  }

  renameConversation(id: string, title: string) {
    return this.http.patch<ConversationSummary>(`/v1/agent/conversations/${encodeURIComponent(id)}`, { title })
  }

  async deleteConversation(id: string) {
    await this.http.delete(`/v1/agent/conversations/${encodeURIComponent(id)}`)
  }

  approveProposal(id: string) {
    return this.http.post<{ id: string; status: string }>(`/v1/agent/proposals/${encodeURIComponent(id)}/apply`, {})
  }

  dropProposal(id: string) {
    return this.http.post<{ id: string; status: string }>(`/v1/agent/proposals/${encodeURIComponent(id)}/drop`, {})
  }

  dayPlans() {
    return this.http.get<{ settings: DayPlanSettings; schedule: DayPlanSchedule; plans: DayPlan[] }>('/v1/agent/day-plans')
  }

  setDayPlanSettings(settings: DayPlanSettings) {
    return this.http.put<{ settings: DayPlanSettings; schedule: DayPlanSchedule }>('/v1/agent/day-plans/settings', settings)
  }

  reminders() {
    return this.http.get<ReminderSettings>('/v1/agent/reminders')
  }

  setReminders(settings: { enabled: boolean; voice: boolean; call: boolean; callUser: string; callVoice: string }) {
    return this.http.put<ReminderSettings>('/v1/agent/reminders', settings)
  }

  async themes() {
    return (await this.http.get<{ themes: Theme[] }>('/v1/agent/themes')).themes
  }

  async setThemes(themes: Theme[]) {
    return (await this.http.put<{ themes: Theme[] }>('/v1/agent/themes', { themes })).themes
  }

  previewTheme(theme: Theme) {
    return this.http.post<{ text: string; html: string }>('/v1/agent/themes/preview', { theme })
  }

  sendSampleAlert() {
    return this.http.post<{ sent: number }>('/v1/agent/alerts/test', {})
  }

  insights(workspace: string, days: number) {
    return this.http.get<Insights>('/v1/agent/insights', { workspace, days })
  }

  insightsDigest(workspace: string, days: number, force?: boolean) {
    return this.http.post<InsightDigest>('/v1/agent/insights/digest', { workspace, days, force: !!force })
  }

  async waitingProposals() {
    return (await this.http.get<{ items: WaitingProposal[] }>('/v1/agent/proposals')).items
  }

  health() {
    return this.http.get<Health>('/v1/agent/health')
  }

  testMailbox(accountId: string) {
    return this.http.post<{ ok: boolean; message: string }>(`/v1/agent/health/mailbox/${encodeURIComponent(accountId)}/test`, {})
  }

  deliveries(limit: number, failedOnly: boolean) {
    return this.http.get<{ items: Delivery[]; last24h: { sent: number; failed: number } }>('/v1/agent/deliveries', { limit, failed: failedOnly ? true : undefined })
  }

  async mailWatch() {
    return (await this.http.get<{ workspaces: MailWatch[] }>('/v1/agent/mail-watch')).workspaces
  }

  async setMailWatch(workspace: WorkspaceId, enabled: boolean) {
    return (await this.http.put<{ workspaces: MailWatch[] }>(`/v1/agent/mail-watch/${encodeURIComponent(workspace)}`, { enabled })).workspaces
  }

  async environment() {
    return (await this.http.get<{ items: EnvVariable[] }>('/v1/agent/secrets')).items
  }

  async setEnvironment(id: string, value: string) {
    return (await this.http.put<{ items: EnvVariable[] }>(`/v1/agent/secrets/${encodeURIComponent(id)}`, { value })).items
  }

  async removeEnvironment(id: string) {
    return (await this.http.delete<{ items: EnvVariable[] }>(`/v1/agent/secrets/${encodeURIComponent(id)}`)).items
  }

  testEnvironment(id: string) {
    return this.http.post<{ ok: boolean; message: string }>(`/v1/agent/secrets/${encodeURIComponent(id)}/test`, {})
  }

  testCall(callUser?: string) {
    return this.http.post<{ called: boolean; user: string }>('/v1/agent/reminders/test-call', { callUser })
  }

  testReminder() {
    return this.http.post<{ sent: number; spoken: boolean; rang: boolean }>('/v1/agent/reminders/test', {})
  }

  generateDayPlan(day?: string, force?: boolean, workspace?: string) {
    return this.http.post<DayPlan>('/v1/agent/day-plans/generate', { day, force, workspace: workspace ?? '' })
  }

  applyDayPlan(id: string) {
    return this.http.post<Awaited<ReturnType<AgentApi['applyDayPlan']>>>(`/v1/agent/day-plans/${encodeURIComponent(id)}/apply`, {})
  }

  dismissDayPlan(id: string) {
    return this.http.post<DayPlan>(`/v1/agent/day-plans/${encodeURIComponent(id)}/dismiss`, {})
  }

  news(workspace: string | undefined, days: number, sort: NewsSort) {
    return this.http.get<{ items: NewsStory[]; total: number; sort: NewsSort; generatedAt: string }>('/v1/agent/news', { workspace, days, sort, limit: 20 })
  }

  async hideNews(agentId: string, itemId: string) {
    await this.http.post('/v1/agent/news/hide', { agentId, itemId })
  }

  listenStatus(id: string) {
    return this.http.get<ListenStatus>(`/v1/agent/workflows/${encodeURIComponent(id)}/listen`)
  }

  async startSweep(id: string) {
    return (await this.http.post<{ sweep: Sweep }>(`/v1/agent/workflows/${encodeURIComponent(id)}/sweep`)).sweep
  }

  async sweepStatus(id: string) {
    return (await this.http.get<{ sweep: Sweep | null }>(`/v1/agent/workflows/${encodeURIComponent(id)}/sweep`)).sweep
  }

  async stopSweep(id: string) {
    return (await this.http.post<{ sweep: Sweep | null }>(`/v1/agent/workflows/${encodeURIComponent(id)}/sweep/stop`)).sweep
  }

  async executions(id: string): Promise<Execution[]> {
    return (await this.http.get<{ items: Execution[] }>(`/v1/agent/workflows/${encodeURIComponent(id)}/executions`)).items
  }

  execution(id: string, runId: string) {
    return this.http.get<ExecutionDetail>(`/v1/agent/workflows/${encodeURIComponent(id)}/executions/${encodeURIComponent(runId)}`)
  }

  async review(id: string): Promise<ReviewItem[]> {
    return (await this.http.get<{ items: ReviewItem[] }>(`/v1/agent/workflows/${encodeURIComponent(id)}/review`)).items
  }

  decideReview(id: string, itemIds: string[], action: 'approve' | 'dismiss', label?: string, note?: string) {
    return this.http.post<{ changed: number; moved?: number }>(`/v1/agent/workflows/${encodeURIComponent(id)}/review`, { itemIds, action, label, note })
  }

  analyseFeedback(id: string, itemId: string, reason: string) {
    return this.http.post<FeedbackSuggestion>(`/v1/agent/workflows/${encodeURIComponent(id)}/feedback`, { itemId, reason })
  }

  addRefinement(id: string, add: { point?: string; protectDomain?: string }) {
    return this.http.post<Workflow>(`/v1/agent/workflows/${encodeURIComponent(id)}/refinements`, add)
  }

  removeRefinement(id: string, index: number) {
    return this.http.delete<Workflow>(`/v1/agent/workflows/${encodeURIComponent(id)}/refinements/${index}`)
  }

  async channels(): Promise<Channel[]> {
    return (await this.http.get<{ items: Channel[] }>('/v1/agent/channels')).items
  }

  connectTelegram(botToken: string, agent?: string, workspace?: string) {
    return this.http.post<Channel>('/v1/agent/channels/telegram', { botToken, agent, workspace })
  }

  setChannelAgent(channelId: string, agent: string) {
    return this.http.put<Channel>(`/v1/agent/channels/${channelId}/agent`, { agent })
  }

  connectWhatsApp(c: WhatsAppConnection) {
    return this.http.post<Channel>('/v1/agent/channels/whatsapp', c)
  }

  newPairingCode(channelId: string) {
    return this.http.post<Channel>(`/v1/agent/channels/${channelId}/pairing`)
  }

  async unpair(channelId: string, chatId: string) {
    return this.http.request<Channel>('DELETE', `/v1/agent/channels/${channelId}/pairing/${encodeURIComponent(chatId)}`)
  }

  setAllowed(channelId: string, allowed: string[]) {
    return this.http.put<Channel>(`/v1/agent/channels/${channelId}/allowed`, { allowed })
  }

  async sendTest(channelId: string) {
    await this.http.post(`/v1/agent/channels/${channelId}/test`)
  }

  async removeChannel(channelId: string) {
    await this.http.delete(`/v1/agent/channels/${channelId}`)
  }
}
