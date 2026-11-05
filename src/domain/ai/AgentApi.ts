import type { DriveFile } from '../drive/Drive'
import type { AiSelection, ModelInfo, ProviderId, ThinkingLevel } from './types'

export interface CaseHit {
  id: string
  reference: string
  title: string
  status: string
  court?: string
  courtNumber?: string
  client?: string
  opposingParty?: string
  stage?: string
  nextHearing?: { date: string; purpose: string }
}

export interface DocumentHit extends DriveFile {
  /** Cases this document is already filed under. */
  filedUnder?: string[]
  /** The details of a case it mentions. */
  matched?: string[]
}

/** What the agent found, in a form the page shows as a card. */
export type Found = ({ kind: 'case' } & CaseHit) | ({ kind: 'document' } & DocumentHit) | ({ kind: 'schedule' } & ScheduleHit) | ({ kind: 'proposal' } & ProposalHit) | ({ kind: 'briefing' } & BriefingHit)

/** One thing in a briefing, as the planner found it. Titles and times come from the records themselves. */
export interface BriefingItem {
  type: 'hearing' | 'meeting' | 'task' | 'followUp' | 'calendar' | 'note'
  id?: string
  title?: string
  time?: string
  /** Why it matters, or what to do. */
  note?: string
  priority?: string
  minutes?: number
  caseRef?: string
  caseId?: string
  place?: string
  channel?: string
  contact?: string
  tries?: number
  due?: string
  link?: string
}

export type BriefingKind = 'fixed' | 'prepare' | 'calls' | 'work' | 'attention' | 'later'

export interface BriefingSection {
  kind: BriefingKind
  title: string
  items: BriefingItem[]
}

/** A day laid out by an agent: a headline, then sections of real items you can complete or move where they stand. */
export interface BriefingHit {
  id: string
  date: string
  headline: string
  summary?: string
  sections: BriefingSection[]
  /** What is free that day, after everything fixed. */
  free: { from: string; to: string; minutes: number }[]
}

/** Something an agent suggests adding or changing. Nothing is saved until it is approved. */
export interface ProposalHit {
  id: string
  action: string
  title: string
  lines: string[]
  /** Where it stands, when a saved conversation is reopened: still waiting, saved, or dropped. */
  status?: 'pending' | 'applied' | 'dropped'
}

/** A conversation in the list. */
export interface ConversationSummary {
  id: string
  agentId: string
  /** A workspace id, or `all`. */
  workspace: string
  title: string
  updatedAt: string
  createdAt: string
  turns: number
  preview: string
}

/** One question and the agent's answer. */
export interface ConversationTurn {
  id: string
  question: string
  answer: string
  steps: AgentStep[]
  found: Found[]
  at: string
}

export type Conversation = Omit<ConversationSummary, 'turns'> & { turns: ConversationTurn[] }

/** A day's schedule an agent proposed: time blocks for tasks and calls. Nothing is booked until it is approved. */
export interface ScheduleHit {
  id: string
  date: string
  blocks: DayPlanBlock[]
  /** Approving this puts the times on the planner (in a chat). */
  proposalId?: string
}

export interface DayPlanBlock {
  kind: 'task' | 'followUp'
  id: string
  title: string
  /** Minutes after midnight. */
  start: number
  duration: number
  from: string
  to: string
}

/** What the daily planner made for one day, waiting for you to approve or dismiss it. */
export interface DayPlan {
  id: string
  day: string
  status: 'proposed' | 'applied' | 'dismissed'
  briefing: string
  blocks: DayPlanBlock[]
  /** The day laid out as a card, when the planner did it that way. */
  card?: BriefingHit | null
  trigger: string
  createdAt: string
  decidedAt: string | null
}

/** Whether the planner runs by itself in the evening, and when. */
export interface DayPlanSettings {
  enabled: boolean
  /** 24-hour clock, like 21:00. */
  time: string
  timezone: string
  /** Also send it to the connected Telegram and WhatsApp. */
  channels: boolean
}

export interface DayPlanSchedule {
  scheduled: boolean
  at: string | null
  timezone: string | null
  nextRunAt: string | null
  lastRunAt: string | null
  error: string | null
}

export interface ProviderState {
  connected: boolean
  /** The last four characters of the key: all that is ever shown. */
  last4?: string
}

export interface ToolOverride {
  enabled: boolean
  description?: string | null
}

/** The prompt as it can be edited: a template with {{variables}}, a wrapper for what is typed, and per-tool overrides. */
export interface PromptSettings {
  system: string
  inputTemplate: string
  tools: Record<string, ToolOverride>
}

export interface DecisionModel {
  id: string
  name: string
}

/** One agent, as the list shows it. Agents are defined on the server; whatever it offers is what appears. */
export interface AgentSummary {
  id: string
  /** Built into Stiamo (`chat`), or built by the person (`workflow`). */
  kind: 'chat' | 'workflow'
  name: string
  description: string
  /** Example questions for an empty chat. */
  suggestions: string[]
  selection: AiSelection | null
  /** True when the agent has no choice of its own and follows the one made last. */
  selectionInherited: boolean
  /** True when the person has written their own prompt for it. */
  customPrompt: boolean
  /** The workspaces it is listed in. "All workspaces" lists every agent regardless. */
  workspaces: string[]
}

/** One agent with everything the prompt editor needs. */
export interface AgentDetail extends AgentSummary {
  prompt: PromptSettings
  defaults: { system: string; inputTemplate: string }
  /** What can go between double braces in this agent's prompt, and what each stands for. */
  variables: Record<string, string>
  /** The tool packs it draws on. */
  packs: string[]
}

/** What every agent shares: the providers and the decision model. */
export interface AgentSettings {
  providers: Record<ProviderId, ProviderState>
  decision: { enabled: boolean; modelId: string }
  decisionModels: DecisionModel[]
  thinkingLevels: ThinkingLevel[]
  agents: AgentSummary[]
  defaultAgent: string
}

export interface AgentStep {
  label: string
  found: number
  error?: string
}

export interface ChatReply {
  answer: string
  steps: AgentStep[]
  found: Found[]
  /** The conversation so far: send it back with the next question to carry on. */
  messages: unknown[]
}

/** Everything that goes to the model with one question. */
export interface PromptPackage {
  system: string
  user: string
  tools: { name: string; description: string; parameters: unknown }[]
}

export type DecisionKind = 'choice' | 'noul' | 'score'

export interface DecisionQuestion {
  type: DecisionKind
  instructions: string
  /** choice: option → description; noul: `true` and `false` → description; score: descriptions from lowest to highest. */
  criteria: Record<string, string> | string[]
}

export interface DecisionAnswer {
  type: DecisionKind
  choice?: string
  noul?: number
  score?: number
  confidence?: number
  probabilities?: Record<string, number>
  legend?: Record<string, string>
}

export interface DecisionResult {
  answers: Record<string, DecisionAnswer>
  model?: string
  cost?: number
}

export type WorkflowDecider = 'model' | 'jev'

export interface WorkflowLabel {
  name: string
  /** What it means, in observable terms: the model reads this to choose. */
  description: string
  /** The confidence needed to propose it; under this the item goes to review. */
  threshold?: number | null
  /** What happens to an item with this label: kept, queued for your attention, or queued with a calendar event to approve. */
  route?: 'none' | 'attention' | 'event' | 'publish'
}

/** What a person configures for an agent that sorts a source's items. */
export interface WorkflowConfig {
  source: { kind: 'manual' | 'table' | 'mail' | 'agent' | 'feed'; /** For `feed`: the news feeds to read. */ feeds?: { key: string; url: string; lang: string }[]; /** For `agent`: the agent whose kept mail this one reads, and whether to run it first. */ upstreamId?: string | null; runUpstream?: boolean; table?: string | null; /** The mailboxes, for `mail`: one or several. */ accountIds?: string[]; folder?: string }
  filters: { sinceDays?: number | null; /** A date range instead: from this day (included)… */ after?: string | null; /** …up to this day (not included). */ before?: string | null; newOnly: boolean; contains?: string | null; limit: number }
  prompt: string
  labels: WorkflowLabel[]
  decider: WorkflowDecider
  defaultThreshold: number
  /** Mail that is never judged, whatever the model would say. */
  rules?: { protectedDomains: string[]; protectedPhrases: string[]; /** The safe-senders shield: anyone written to from the mailbox is kept. */ protectCorrespondents: boolean; protectedAddresses?: string[] }
  /** What is done with a label. Mail is only ever moved to Trash. */
  action?: { trashLabel: string | null; auto: boolean }
  /** For the decision model: which one. Empty is the person's default. */
  decisionModel?: string | null
  /** How many items go to the model in one request; 1 asks about each alone. */
  batchSize?: number
  /** The prompt as five sections a person wrote (see mailGuide.ts); the prompt and labels are made from them. */
  guide?: Record<string, string> | null
  /** Points the agent learned from corrections. They are added after the prompt, never in place of it. */
  refinements?: string[]
  /** Run by itself when new mail arrives (the mail service says so), not only when asked. */
  listen?: boolean
  /** Run by itself every this many minutes (for news feeds, which can't say when something is new). */
  scheduleMinutes?: number | null
  /** For news: how the relevant stories are graded, and so ranked. */
  importance?: { prompt: string; levels: { name: string; description: string; weight: number }[] } | null
}

export interface Workflow {
  id: string
  kind: 'workflow'
  name: string
  description: string
  version: number
  config: WorkflowConfig
  lastRunAt: string | null
  /** How many items are in each state: proposed, needs_review, approved, dismissed. */
  ledger: Record<string, number>
  /** Waiting for a person: proposed plus needs review. */
  pending: number
}

export interface DecisionItem {
  id: string
  title: string
  excerpt: string
  label: string | null
  confidence: number
  reason: string
  /** `kept`: judged fine, nothing to do. `applied`: moved to Trash. */
  status: 'proposed' | 'needs_review' | 'failed' | 'kept' | 'applied' | 'queued' | 'event_proposed' | 'published' | 'irrelevant'
  /** What is (in a test run, would be) done with it. */
  action?: 'trash'
  /** What the agent worked out: a summary, priority, suggested action and any event. */
  data?: { summary?: string; priority?: string; action?: string | null; event?: AttentionEvent | null }
  error?: string
  ms: number
}

/** What a test or a run did, item by item. */
export interface WorkflowRun {
  runId: string | null
  mode: 'test' | 'run'
  counts: { items: number; proposed: number; needsReview: number; failed: number; kept?: number; applied?: number; protected?: number; queued?: number; events?: number; published?: number; irrelevant?: number }
  /** How many items matched the filters before the cap. */
  matched: number
  usage: { inputTokens: number; outputTokens: number }
  stats?: RunStats
  summary: string
  durationMs: number
  items: DecisionItem[]
}

/** What a run did overall: how much it read, how it asked, and what it cost. */
export interface RunStats {
  scanned: number
  protected: number
  judged: number
  requests: number
  batchSize: number
  decider: WorkflowDecider
  provider: string
  model: string
  mailboxes: number
  cost: number | null
  /** Messages in the date range at all. */
  inRange?: number
  /** Still waiting for a later run. */
  remaining?: number
}

/** Who the safe-senders shield protects in one mailbox. */
export interface SafeSenders {
  accountId: string
  count: number
  sample: string[]
  error: string | null
}

/** Exactly what the model would be sent, filled with example emails. */
export interface PromptPreview {
  decider: WorkflowDecider
  batchSize: number
  batched: boolean
  provider: string | null
  model: string | null
  /** The instructions sent first. Empty for the decision model, which takes a state and questions instead. */
  system: string | null
  user: string
  questions: Record<string, unknown> | null
}

export interface ReviewItem {
  id: string
  title: string
  excerpt: string
  label: string | null
  confidence: number
  reason: string
  status: 'proposed' | 'needs_review'
  at: string | null
}

/** What the agent suggests adding to its prompt after being told an email wasn't spam. */
export interface FeedbackSuggestion {
  point: string
  /** An earlier point already covers it. */
  duplicate: boolean
  /** A domain the reason is about, which could be always kept. */
  protectDomain: string | null
  note: string
  /** Written by the model, or the owner's own words when no model could be asked. */
  source: 'model' | 'reason'
  senderDomain: string | null
}

/** A run through a whole inbox, going on (or finished) on the server. */
export interface Sweep {
  id: string
  state: 'running' | 'done' | 'stopped' | 'failed'
  runs: number
  judged: number
  moved: number
  kept: number
  toReview: number
  protected: number
  failedItems: number
  inRange: number | null
  remaining: number | null
  lastRunId: string | null
  error: string | null
  stopRequested: boolean
  startedAt: string
  finishedAt: string | null
}

/** An event an email names, to check before it goes in the calendar. */
export interface AttentionEvent {
  title: string
  date: string
  start: string | null
  end: string | null
  durationMinutes: number | null
  location: string | null
  link: string | null
  mode: 'in_person' | 'virtual' | 'phone'
  attendees: string[]
}

/** An email an agent read and found worth your time. */
export interface AttentionItem {
  agentId: string
  agentName: string
  itemId: string
  title: string
  excerpt: string
  label: string | null
  confidence: number
  status: 'queued' | 'event_proposed'
  summary: string
  priority: 'high' | 'normal' | 'low' | string
  action: string | null
  due: string | null
  event: AttentionEvent | null
  note: string | null
  at: string | null
  folder: string
  workspaces: string[]
}

/** Whether an agent is listening to its mailbox, and how that is going. */
export interface ListenStatus {
  listening: boolean
  state: 'off' | 'connecting' | 'listening' | 'reconnecting'
  mailboxes: number
  lastEventAt: string | null
  lastRunAt: string | null
  runs: number
  error: string | null
  schedule?: { scheduled: boolean; everyMinutes: number | null; nextRunAt: string | null; lastRunAt: string | null; runs: number; error: string | null }
}

/** The two rankings of the news page: what matters most, and what is newest. */
export type NewsSort = 'importance' | 'latest'

/** A story on the news page. */
export interface NewsStory {
  agentId: string
  itemId: string
  title: string
  source: string | null
  link: string | null
  description: string | null
  imageUrl: string | null
  publishedAt: string | null
  importance: string | null
  weight: number
  lang: string | null
  feed: string | null
  relevance: number | null
  rank: number
}

export type LedgerStatus = 'proposed' | 'needs_review' | 'approved' | 'dismissed' | 'kept' | 'applied' | 'protected' | 'queued' | 'event_proposed' | 'done' | 'published' | 'irrelevant'

/** One real run of an agent you built. `counts` is what the run did; `now` is where its items stand today. */
export interface Execution {
  id: string
  startedAt: string
  durationMs: number
  status: 'ok' | 'error'
  summary: string
  counts: { items?: number; proposed?: number; needsReview?: number; failed?: number; kept?: number; applied?: number; protected?: number }
  stats: Partial<RunStats>
  error: string | null
  version: number
  now: Partial<Record<LedgerStatus, number>>
}

export interface ExecutionItem {
  id: string
  title: string
  /** The start of the item as the agent read it (for mail: sender, subject, the first lines). */
  excerpt: string
  label: string | null
  confidence: number
  reason: string
  status: LedgerStatus
  at: string | null
  decidedAt: string | null
}

export interface ExecutionDetail {
  execution: Execution
  items: ExecutionItem[]
}

/** Where a question came from. */
export type RunTrigger = 'chat' | 'telegram' | 'whatsapp' | 'test' | 'schedule'

/** One time an agent was asked, as the history list shows it. */
export interface RunSummary {
  id: string
  agentId: string
  trigger: RunTrigger | string
  status: 'ok' | 'error'
  startedAt: string
  durationMs: number
  provider: string
  model: string
  /** The start of what was asked, and of the answer. */
  input: string
  output: string
  found: number
  steps: number
  error?: string
}

/** What the agent did with one tool. */
export interface RunStep {
  tool: string
  label: string
  args: Record<string, unknown>
  found: number
  ms: number
  /** What the tool gave back, shortened. */
  result: string
  error?: string
}

/** One run in full: what the model was given, each step, and the answer. */
export interface RunDetail extends RunSummary {
  thinking: string
  /** The message as the model got it, after the agent's template. */
  userMessage: string
  systemPrompt: string
  tools: string[]
  stepLog: RunStep[]
  usage: { inputTokens?: number; outputTokens?: number }
  channel?: string | null
}

export interface RunPage {
  items: RunSummary[]
  /** Pass as `before` to get the next, older page; null when there are no more. */
  next: string | null
}

/** What runs used. `cost` is null (not 0) when no run in it had a price to report. */
export interface UsageTotals {
  runs: number
  errors: number
  inputTokens: number
  outputTokens: number
  items: number
  cost: number | null
  /** How many of the runs had a cost reported. */
  pricedRuns: number
}

export interface UsageSummary {
  windowDays: number | null
  total: UsageTotals
  allTime: UsageTotals
  byAgent: (UsageTotals & { agentId: string; name: string; kind: 'chat' | 'workflow' })[]
  byModel: (UsageTotals & { provider: string; model: string })[]
  daily: (UsageTotals & { date: string })[]
}

/** One run and what it used. */
export interface UsageTransaction {
  id: string
  at: string
  agentId: string
  agentName: string
  kind: 'chat' | 'workflow'
  trigger: string
  status: 'ok' | 'error'
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number | null
  items: number
  durationMs: number
}

export interface UsagePage {
  items: UsageTransaction[]
  nextBefore: string | null
}

export interface AgentStats {
  totalRuns: number
  windowDays: number
  runs: number
  ok: number
  errors: number
  avgDurationMs: number
  inputTokens: number
  outputTokens: number
  /** US dollars over the window, when the provider says what it charged; null when it doesn't. */
  cost: number | null
  /** Everything this agent has used since it began, whatever happened to its history. */
  allTime: UsageTotals
  byTrigger: Record<string, number>
  daily: { date: string; runs: number; errors: number }[]
  lastRun: RunSummary | null
}

export interface ChannelPairing {
  id: number | string
  name: string
}

export interface Channel {
  id: string
  kind: 'telegram' | 'whatsapp'
  /** The agent that answers on it. */
  agent: string
  /** Where the channel's messages are delivered to (for WhatsApp this goes into the Twilio console). */
  webhookUrl?: string | null
  // Telegram
  username?: string
  name?: string
  paired?: ChannelPairing[]
  pairingCode?: string
  pairingLink?: string
  // WhatsApp
  account?: string
  accountSid?: string
  from?: string
  allowed?: string[]
}

export interface WhatsAppConnection {
  agent?: string
  accountSid: string
  authToken: string
  sender: string
  allowed: string[]
}

/** The AI agent as the backend's `agent` service offers it: keys and prompt are kept there, and so are the chat channels. */
export interface AgentApi {
  settings(): Promise<AgentSettings>
  putKey(provider: ProviderId, apiKey: string): Promise<ModelInfo[]>
  removeKey(provider: ProviderId): Promise<void>
  models(provider: ProviderId): Promise<ModelInfo[]>
  setDecision(enabled: boolean, modelId: string): Promise<void>
  agent(agentId: string): Promise<AgentDetail>
  setSelection(agentId: string, selection: AiSelection): Promise<void>
  setPrompt(agentId: string, prompt: PromptSettings): Promise<void>
  resetPrompt(agentId: string): Promise<void>
  preview(agentId: string, question: string, prompt?: PromptSettings): Promise<PromptPackage>
  chat(agentId: string, message: string, messages: unknown[]): Promise<ChatReply>
  stats(agentId: string): Promise<AgentStats>
  usageSummary(days: number | null, agent?: string): Promise<UsageSummary>
  usageTransactions(opts: { days: number | null; agent?: string; before?: string }): Promise<UsagePage>
  runs(agentId: string, before?: string): Promise<RunPage>
  run(runId: string): Promise<RunDetail>
  clearRuns(agentId: string): Promise<void>
  decide(state: string, questions: Record<string, DecisionQuestion>, modelId?: string): Promise<DecisionResult>
  workflow(id: string): Promise<Workflow>
  createWorkflow(name: string, description: string, config: WorkflowConfig, workspaces?: string[]): Promise<Workflow>
  setWorkspaces(agentId: string, workspaces: string[]): Promise<void>
  updateWorkflow(id: string, name: string, description: string, config: WorkflowConfig): Promise<Workflow>
  deleteWorkflow(id: string): Promise<void>
  testDraft(config: WorkflowConfig, manual?: string): Promise<WorkflowRun>
  promptPreview(config: WorkflowConfig): Promise<PromptPreview>
  safeSenders(accountIds: string[]): Promise<SafeSenders[]>
  testWorkflow(id: string, manual?: string): Promise<WorkflowRun>
  runWorkflow(id: string, manual?: string): Promise<WorkflowRun>
  review(id: string): Promise<ReviewItem[]>
  attention(workspace?: string): Promise<{ items: AttentionItem[]; count: number }>
  actOnAttention(a: { agentId: string; itemId: string; action: 'done' | 'dismiss' | 'approve_event' | 'skip_event'; event?: AttentionEvent }): Promise<{ status: string; meetingId?: string }>
  listenStatus(id: string): Promise<ListenStatus>
  conversations(workspace: string): Promise<ConversationSummary[]>
  conversation(id: string): Promise<Conversation>
  startConversation(agentId: string, workspace: string): Promise<Conversation>
  say(id: string, message: string): Promise<{ turn: ConversationTurn; conversation: ConversationSummary }>
  renameConversation(id: string, title: string): Promise<ConversationSummary>
  deleteConversation(id: string): Promise<void>
  approveProposal(id: string): Promise<{ id: string; status: string }>
  dropProposal(id: string): Promise<{ id: string; status: string }>
  dayPlans(): Promise<{ settings: DayPlanSettings; schedule: DayPlanSchedule; plans: DayPlan[] }>
  setDayPlanSettings(settings: DayPlanSettings): Promise<{ settings: DayPlanSettings; schedule: DayPlanSchedule }>
  generateDayPlan(day?: string, force?: boolean): Promise<DayPlan>
  applyDayPlan(id: string): Promise<{ plan: DayPlan; booked: number; skipped: number }>
  dismissDayPlan(id: string): Promise<DayPlan>
  news(workspace: string | undefined, days: number, sort: NewsSort): Promise<{ items: NewsStory[]; total: number; sort: NewsSort; generatedAt: string }>
  hideNews(agentId: string, itemId: string): Promise<void>
  startSweep(id: string): Promise<Sweep>
  sweepStatus(id: string): Promise<Sweep | null>
  stopSweep(id: string): Promise<Sweep | null>
  executions(id: string): Promise<Execution[]>
  execution(id: string, runId: string): Promise<ExecutionDetail>
  decideReview(id: string, itemIds: string[], action: 'approve' | 'dismiss', label?: string, note?: string): Promise<{ changed: number; moved?: number }>
  analyseFeedback(id: string, itemId: string, reason: string): Promise<FeedbackSuggestion>
  addRefinement(id: string, add: { point?: string; protectDomain?: string }): Promise<Workflow>
  removeRefinement(id: string, index: number): Promise<Workflow>
  channels(): Promise<Channel[]>
  connectTelegram(botToken: string, agent?: string): Promise<Channel>
  connectWhatsApp(connection: WhatsAppConnection): Promise<Channel>
  setChannelAgent(channelId: string, agent: string): Promise<Channel>
  newPairingCode(channelId: string): Promise<Channel>
  unpair(channelId: string, chatId: string): Promise<Channel>
  setAllowed(channelId: string, allowed: string[]): Promise<Channel>
  sendTest(channelId: string): Promise<void>
  removeChannel(channelId: string): Promise<void>
}

const OFFLINE = 'The AI agent needs the Stiamo backend.'

/** Used when there is no backend to run the agent on (offline, Supabase). */
export const NO_AGENT: AgentApi = new Proxy({} as AgentApi, { get: () => () => Promise.reject(new Error(OFFLINE)) })
