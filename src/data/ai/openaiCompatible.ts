import { AiError } from '@/domain/ai/types'
import type { ChatRequest, ChatResult, LlmClient, Message, ModelInfo, ProviderId, ThinkingLevel } from '@/domain/ai/types'

type Flavour = Extract<ProviderId, 'openai' | 'openrouter'>

const BASE: Record<Flavour, string> = { openai: 'https://api.openai.com/v1', openrouter: 'https://openrouter.ai/api/v1' }
const LEVELS: ThinkingLevel[] = ['low', 'medium', 'high']

/** OpenAI's catalogue also holds speech, images and embeddings; only models that chat are offered. */
const NOT_CHAT = /(audio|realtime|transcribe|tts|whisper|embedding|moderation|image|dall-e|davinci|babbage|instruct|search|codex|computer-use|^o1-(mini|preview|pro))/
const OPENAI_CHAT = /^(gpt-|chatgpt-|o\d)/
const OPENAI_THINKS = /^(o\d|gpt-5)/

export function openAiModels(body: { data?: { id: string }[] }): ModelInfo[] {
  return (body.data ?? [])
    .map((m) => m.id)
    .filter((id) => OPENAI_CHAT.test(id) && !NOT_CHAT.test(id))
    .sort((a, b) => b.localeCompare(a))
    .map((id) => ({ id, name: id, thinking: OPENAI_THINKS.test(id) ? LEVELS : [] }))
}

interface OpenRouterModel {
  id: string
  name?: string
  supported_parameters?: string[]
}

/** Only models that can call tools can run an agent; those that accept `reasoning` can be told how hard to think. */
export function openRouterModels(body: { data?: OpenRouterModel[] }): ModelInfo[] {
  return (body.data ?? [])
    .filter((m) => m.supported_parameters?.includes('tools'))
    .map((m) => ({ id: m.id, name: m.name ?? m.id, thinking: m.supported_parameters?.includes('reasoning') ? (['off', ...LEVELS] as ThinkingLevel[]) : [] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The wire form of a conversation. */
export function toOpenAiMessages(messages: Message[]) {
  return messages.map((m) => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })),
      }
    }
    return { role: m.role, content: m.content }
  })
}

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function fail(response: Response, who: string): Promise<never> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string } | string }
    detail = typeof body.error === 'string' ? body.error : (body.error?.message ?? '')
  } catch {
    // No readable body.
  }
  const reason =
    response.status === 401 || response.status === 403
      ? `${who} didn’t accept the key. Check it on the Providers page.`
      : response.status === 429
        ? `${who} says there have been too many requests, or the account is out of credit.`
        : `${who} couldn’t answer (${response.status}).`
  throw new AiError(detail ? `${reason} ${detail}` : reason, response.status)
}

/** OpenAI and OpenRouter speak the same chat API, so one client serves both. */
export class OpenAiCompatibleClient implements LlmClient {
  private readonly who: string

  constructor(
    private readonly flavour: Flavour,
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = (...a) => globalThis.fetch(...a),
  ) {
    this.who = flavour === 'openai' ? 'OpenAI' : 'OpenRouter'
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetchFn(`${BASE[this.flavour]}${path}`, { ...init, headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) } })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new AiError(`Couldn’t reach ${this.who}. Check the connection.`)
    }
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const r = await this.call('/models', { signal })
    if (!r.ok) return fail(r, this.who)
    const body = (await r.json()) as never
    return this.flavour === 'openai' ? openAiModels(body) : openRouterModels(body)
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const body: Record<string, unknown> = { model: req.model, messages: toOpenAiMessages(req.messages) }
    if (req.tools.length) {
      body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
      body.tool_choice = 'auto'
    }
    if (req.thinking !== 'off') {
      if (this.flavour === 'openai') body.reasoning_effort = req.thinking
      else body.reasoning = { effort: req.thinking }
    } else if (this.flavour === 'openrouter') {
      body.reasoning = { enabled: false }
    }
    const r = await this.call('/chat/completions', { method: 'POST', body: JSON.stringify(body), signal: req.signal })
    if (!r.ok) return fail(r, this.who)
    const out = (await r.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[] } }[] }
    const message = out.choices?.[0]?.message
    if (!message) throw new AiError(`${this.who} sent back an empty answer.`)
    return {
      text: message.content ?? '',
      toolCalls: (message.tool_calls ?? []).map((c, i) => ({ id: c.id || `call_${i}`, name: c.function?.name ?? '', args: parseArgs(c.function?.arguments) })),
    }
  }
}
