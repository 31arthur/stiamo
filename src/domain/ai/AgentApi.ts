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

export interface AgentSettings {
  providers: Record<ProviderId, ProviderState>
  selection: AiSelection | null
  decision: { enabled: boolean; modelId: string }
  decisionModels: DecisionModel[]
  prompt: PromptSettings
  defaults: { system: string; inputTemplate: string }
  /** What can go between double braces in a prompt, and what each stands for. */
  variables: Record<string, string>
  thinkingLevels: ThinkingLevel[]
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

export interface ChannelPairing {
  id: number | string
  name: string
}

export interface Channel {
  id: string
  kind: 'telegram' | 'whatsapp'
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
  setSelection(selection: AiSelection): Promise<void>
  setDecision(enabled: boolean, modelId: string): Promise<void>
  setPrompt(prompt: PromptSettings): Promise<void>
  resetPrompt(): Promise<void>
  preview(question: string, prompt?: PromptSettings): Promise<PromptPackage>
  chat(message: string, messages: unknown[]): Promise<ChatReply>
  decide(state: string, questions: Record<string, DecisionQuestion>, modelId?: string): Promise<DecisionResult>
  channels(): Promise<Channel[]>
  connectTelegram(botToken: string): Promise<Channel>
  connectWhatsApp(connection: WhatsAppConnection): Promise<Channel>
  newPairingCode(channelId: string): Promise<Channel>
  unpair(channelId: string, chatId: string): Promise<Channel>
  setAllowed(channelId: string, allowed: string[]): Promise<Channel>
  sendTest(channelId: string): Promise<void>
  removeChannel(channelId: string): Promise<void>
}

const OFFLINE = 'The AI agent needs the Stiamo backend.'

/** Used when there is no backend to run the agent on (offline, Supabase). */
export const NO_AGENT: AgentApi = new Proxy({} as AgentApi, { get: () => () => Promise.reject(new Error(OFFLINE)) })
