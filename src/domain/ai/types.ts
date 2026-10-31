/** Who can be asked. Each has its own address, key and way of describing models and tools. */
export type ProviderId = 'openai' | 'gemini' | 'openrouter'

export const PROVIDER_IDS: ProviderId[] = ['openai', 'gemini', 'openrouter']

export const PROVIDERS: Record<ProviderId, { label: string; tagline: string; keyUrl: string; keyHint: string }> = {
  openai: { label: 'OpenAI', tagline: 'GPT and o-series models', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…' },
  gemini: { label: 'Google Gemini', tagline: 'Gemini models, with optional thinking', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…' },
  openrouter: { label: 'OpenRouter', tagline: 'Hundreds of models, and the Jev decision model, behind one key', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…' },
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

/** The provider, model and thinking level the agent uses. */
export interface AiSelection {
  providerId: ProviderId
  modelId: string
  thinking: ThinkingLevel
}
