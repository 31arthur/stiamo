import { PROVIDER_IDS } from '@/domain/ai/types'
import type { AiSelection, LlmClient, ProviderId, ThinkingLevel } from '@/domain/ai/types'
import { GeminiClient } from './gemini'
import { OpenAiCompatibleClient } from './openaiCompatible'

/** Everything the browser keeps about AI: the keys that were entered, and which model is in use. */
export interface AiSettings {
  keys: Partial<Record<ProviderId, string>>
  selection?: AiSelection
}

const PREFIX = 'stiamo.ai.'
const THINKING: ThinkingLevel[] = ['off', 'low', 'medium', 'high']

const keyFor = (userId: string) => `${PREFIX}${userId}`

/** Settings are kept per signed-in user, in this browser only. The keys are never sent anywhere except to their own provider. */
export function readAiSettings(userId: string, storage: Storage = localStorage): AiSettings {
  try {
    const raw: unknown = JSON.parse(storage.getItem(keyFor(userId)) ?? 'null')
    if (!raw || typeof raw !== 'object') return { keys: {} }
    const r = raw as { keys?: Record<string, unknown>; selection?: Partial<AiSelection> }
    const keys: AiSettings['keys'] = {}
    for (const id of PROVIDER_IDS) {
      const k = r.keys?.[id]
      if (typeof k === 'string' && k.trim()) keys[id] = k.trim()
    }
    const s = r.selection
    const selection = s && PROVIDER_IDS.includes(s.providerId as ProviderId) && typeof s.modelId === 'string' && THINKING.includes(s.thinking as ThinkingLevel) ? (s as AiSelection) : undefined
    return { keys, selection }
  } catch {
    return { keys: {} }
  }
}

export function writeAiSettings(userId: string, settings: AiSettings, storage: Storage = localStorage) {
  try {
    storage.setItem(keyFor(userId), JSON.stringify(settings))
  } catch {
    // Storage is full or blocked: the settings last until the page is closed.
  }
}

/** On sign-out (or when a session ends) every key goes with it, so a shared computer keeps none. */
export function purgeAiSettings(storage: Storage = localStorage) {
  const mine: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k?.startsWith(PREFIX)) mine.push(k)
  }
  mine.forEach((k) => storage.removeItem(k))
}

export function createLlmClient(provider: ProviderId, apiKey: string, fetchFn?: typeof fetch): LlmClient {
  return provider === 'gemini' ? new GeminiClient(apiKey, fetchFn) : new OpenAiCompatibleClient(provider, apiKey, fetchFn)
}
