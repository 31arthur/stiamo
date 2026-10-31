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
export type Found = ({ kind: 'case' } & CaseHit) | ({ kind: 'document' } & DocumentHit)

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
}

/** What a person configures for an agent that sorts a source's items. */
export interface WorkflowConfig {
  source: { kind: 'manual' | 'table' | 'mail'; table?: string | null; /** The mailboxes, for `mail`: one or several. */ accountIds?: string[]; folder?: string }
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
  status: 'proposed' | 'needs_review' | 'failed' | 'kept' | 'applied'
  /** What is (in a test run, would be) done with it. */
  action?: 'trash'
  error?: string
  ms: number
}

/** What a test or a run did, item by item. */
export interface WorkflowRun {
  runId: string | null
  mode: 'test' | 'run'
  counts: { items: number; proposed: number; needsReview: number; failed: number; kept?: number; applied?: number; protected?: number }
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

export type LedgerStatus = 'proposed' | 'needs_review' | 'approved' | 'dismissed' | 'kept' | 'applied' | 'protected'

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

export interface AgentStats {
  totalRuns: number
  windowDays: number
  runs: number
  ok: number
  errors: number
  avgDurationMs: number
  inputTokens: number
  outputTokens: number
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
  executions(id: string): Promise<Execution[]>
  execution(id: string, runId: string): Promise<ExecutionDetail>
  decideReview(id: string, itemIds: string[], action: 'approve' | 'dismiss', label?: string): Promise<{ changed: number; moved?: number }>
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
