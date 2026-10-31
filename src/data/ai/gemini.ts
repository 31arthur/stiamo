import { AiError } from '@/domain/ai/types'
import type { ChatRequest, ChatResult, LlmClient, Message, ModelInfo, ThinkingLevel, ToolCall } from '@/domain/ai/types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiModel {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
  thinking?: boolean
}

/** Which levels a Gemini model accepts: older ones take a budget, newer ones a level, and some can't be switched off. */
export function geminiThinking(id: string, flagged?: boolean): ThinkingLevel[] {
  if (/gemini-3/.test(id)) return ['low', 'high']
  if (/gemini-2\.5-pro/.test(id)) return ['low', 'medium', 'high']
  if (/gemini-2\.5/.test(id) || flagged) return ['off', 'low', 'medium', 'high']
  return []
}

export function geminiModels(body: { models?: GeminiModel[] }): ModelInfo[] {
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /^models\/gemini-/.test(m.name) && !/(embedding|image|tts|live|aqa|robotics|computer-use)/.test(m.name))
    .map((m) => {
      const id = m.name.replace(/^models\//, '')
      return { id, name: m.displayName ?? id, thinking: geminiThinking(id, m.thinking) }
    })
    .sort((a, b) => b.id.localeCompare(a.id))
}

const BUDGET: Record<Exclude<ThinkingLevel, 'off'>, number> = { low: 1024, medium: 8192, high: 24576 }

export function thinkingConfig(model: string, level: ThinkingLevel): Record<string, unknown> | undefined {
  const allowed = geminiThinking(model)
  // A model that doesn't think, or can't be switched off, is left to its default.
  if (!allowed.length || (level === 'off' && !allowed.includes('off'))) return undefined
  if (/gemini-3/.test(model)) return { thinkingLevel: level === 'low' ? 'low' : 'high' }
  return { thinkingBudget: level === 'off' ? 0 : BUDGET[level] }
}

type Part = Record<string, unknown>
type Content = { role: 'user' | 'model'; parts: Part[] }

/**
 * The wire form of a conversation. An assistant turn is sent back exactly as it arrived (`raw`) when we have it,
 * because newer models want their thought signatures returned with the calls they made. Consecutive tool results
 * share one turn, as the API expects.
 */
export function toGeminiContents(messages: Message[]): Content[] {
  const out: Content[] = []
  for (const m of messages) {
    if (m.role === 'system') continue
    if (m.role === 'tool') {
      const part = { functionResponse: { name: m.name ?? '', response: { result: safeJson(m.content) } } }
      const last = out[out.length - 1]
      if (last?.role === 'user' && last.parts.every((p) => 'functionResponse' in p)) last.parts.push(part)
      else out.push({ role: 'user', parts: [part] })
    } else if (m.role === 'assistant') {
      const raw = m.raw as Content | undefined
      if (raw?.parts) out.push({ role: 'model', parts: raw.parts })
      else {
        const parts: Part[] = []
        if (m.content) parts.push({ text: m.content })
        for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } })
        out.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] })
      }
    } else out.push({ role: 'user', parts: [{ text: m.content }] })
  }
  return out
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

/** Gemini's schema dialect has no `additionalProperties`. */
const cleanSchema = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(cleanSchema)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'additionalProperties').map(([k, x]) => [k, cleanSchema(x)]))
  return v
}

async function fail(response: Response): Promise<never> {
  let detail = ''
  try {
    detail = ((await response.json()) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    // No readable body.
  }
  const reason =
    response.status === 400 && /api key/i.test(detail)
      ? 'Gemini didn’t accept the key. Check it on the Providers page.'
      : response.status === 401 || response.status === 403
        ? 'Gemini didn’t accept the key. Check it on the Providers page.'
        : response.status === 429
          ? 'Gemini says there have been too many requests, or the quota is used up.'
          : `Gemini couldn’t answer (${response.status}).`
  throw new AiError(detail && !reason.includes('key') ? `${reason} ${detail}` : reason, response.status)
}

export class GeminiClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = (...a) => globalThis.fetch(...a),
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetchFn(`${BASE}${path}`, { ...init, headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' } })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new AiError('Couldn’t reach Gemini. Check the connection.')
    }
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const models: GeminiModel[] = []
    let token = ''
    for (let page = 0; page < 5; page++) {
      const r = await this.call(`/models?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, { signal })
      if (!r.ok) return fail(r)
      const body = (await r.json()) as { models?: GeminiModel[]; nextPageToken?: string }
      models.push(...(body.models ?? []))
      if (!body.nextPageToken) break
      token = body.nextPageToken
    }
    return geminiModels({ models })
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const system = req.messages.find((m) => m.role === 'system')?.content
    const config = thinkingConfig(req.model, req.thinking)
    const body: Record<string, unknown> = { contents: toGeminiContents(req.messages) }
    if (system) body.systemInstruction = { parts: [{ text: system }] }
    if (req.tools.length) body.tools = [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: cleanSchema(t.parameters) })) }]
    if (config) body.generationConfig = { thinkingConfig: config }
    const r = await this.call(`/models/${encodeURIComponent(req.model)}:generateContent`, { method: 'POST', body: JSON.stringify(body), signal: req.signal })
    if (!r.ok) return fail(r)
    const out = (await r.json()) as { candidates?: { content?: Content; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
    const content = out.candidates?.[0]?.content
    if (!content?.parts) throw new AiError(out.promptFeedback?.blockReason ? `Gemini declined to answer (${out.promptFeedback.blockReason}).` : 'Gemini sent back an empty answer.')
    const toolCalls: ToolCall[] = []
    let text = ''
    for (const p of content.parts) {
      if (p.thought === true) continue
      if (typeof p.text === 'string') text += p.text
      const fc = p.functionCall as { name?: string; args?: Record<string, unknown> } | undefined
      if (fc?.name) toolCalls.push({ id: `call_${toolCalls.length}`, name: fc.name, args: fc.args ?? {} })
    }
    return { text, toolCalls, raw: { role: 'model', parts: content.parts } }
  }
}
