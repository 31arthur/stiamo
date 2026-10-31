/** Who can be asked. Each has its own address, key and way of describing models and tools. */
export type ProviderId = 'openai' | 'gemini' | 'openrouter'

export const PROVIDER_IDS: ProviderId[] = ['openai', 'gemini', 'openrouter']

export const PROVIDERS: Record<ProviderId, { label: string; tagline: string; keyUrl: string; keyHint: string }> = {
  openai: { label: 'OpenAI', tagline: 'GPT and o-series models', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…' },
  gemini: { label: 'Google Gemini', tagline: 'Gemini models, with optional thinking', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…' },
  openrouter: { label: 'OpenRouter', tagline: 'Hundreds of models behind one key', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…' },
}

/** How hard a model is asked to think before answering. `off` only exists where the model can be told not to. */
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high'

export const THINKING_LABELS: Record<ThinkingLevel, string> = { off: 'Off', low: 'Low', medium: 'Medium', high: 'High' }

export interface ModelInfo {
  id: string
  name: string
  /** The levels this model accepts; empty when it doesn't think (or doesn't say). */
  thinking: ThinkingLevel[]
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** Set on an assistant message that asked for tools to be run. */
  toolCalls?: ToolCall[]
  /** Set on a tool message: which call it answers. */
  toolCallId?: string
  name?: string
  /** The provider's own form of an assistant message, sent back untouched (some models need their thought signatures returned). */
  raw?: unknown
}

/** What the model is told about a tool: its name, what it is for, and the arguments it takes (JSON schema). */
export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatRequest {
  model: string
  messages: Message[]
  tools: ToolSpec[]
  thinking: ThinkingLevel
  signal?: AbortSignal
}

export interface ChatResult {
  text: string
  toolCalls: ToolCall[]
  raw?: unknown
}

/** A provider, as the agent sees it. */
export interface LlmClient {
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>
  chat(request: ChatRequest): Promise<ChatResult>
}

/** Something went wrong asking a provider, in words for people. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

/** The provider, model and thinking level the agent uses. */
export interface AiSelection {
  providerId: ProviderId
  modelId: string
  thinking: ThinkingLevel
}
