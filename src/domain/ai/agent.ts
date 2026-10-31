import type { DriveFile } from '../drive/Drive'
import type { LlmClient, Message, ThinkingLevel, ToolCall, ToolSpec } from './types'

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

/** What a tool found, in a form the page can show as a card. */
export type Found = ({ kind: 'case' } & CaseHit) | ({ kind: 'document' } & DocumentHit)

export interface ToolOutput {
  /** What the model gets back. */
  result: unknown
  /** What the person is shown. */
  found?: Found[]
}

export interface Tool extends ToolSpec {
  /** A line for the trace, e.g. `Searched cases for “NHAI”`. */
  label(args: Record<string, unknown>): string
  run(args: Record<string, unknown>): Promise<ToolOutput>
}

export interface AgentStep {
  call: ToolCall
  label: string
  found: Found[]
  error?: string
}

export interface AgentRun {
  answer: string
  steps: AgentStep[]
  found: Found[]
  /** The conversation so far, without the system prompt: pass it back in to carry on. */
  messages: Message[]
}

export interface AgentOptions {
  client: LlmClient
  model: string
  thinking: ThinkingLevel
  system: string
  tools: Tool[]
  /** Earlier turns of this conversation. */
  history?: Message[]
  question: string
  maxSteps?: number
  signal?: AbortSignal
  onStep?: (step: AgentStep) => void
}

/** What goes back to a model is capped, so one wide search can't fill its whole window. */
const MAX_RESULT_CHARS = 12_000

const toJson = (v: unknown) => {
  const text = JSON.stringify(v) ?? 'null'
  return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…(shortened)` : text
}

/**
 * Asks the model, runs the tools it asks for, and gives it the results, until it answers in words. Everything the
 * tools found is collected so it can be shown as cards, whatever the model goes on to say.
 */
export async function runAgent(o: AgentOptions): Promise<AgentRun> {
  const specs: ToolSpec[] = o.tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
  const turn: Message[] = [{ role: 'user', content: o.question }]
  const messages = () => [{ role: 'system', content: o.system } as Message, ...(o.history ?? []), ...turn]
  const steps: AgentStep[] = []
  const found = new Map<string, Found>()
  const max = o.maxSteps ?? 8

  for (let i = 0; ; i++) {
    // After the last round of tools the model is asked once more, with none, so it has to answer.
    const last = i >= max
    const reply = await o.client.chat({ model: o.model, messages: messages(), tools: last ? [] : specs, thinking: o.thinking, signal: o.signal })
    if (last || reply.toolCalls.length === 0) {
      turn.push({ role: 'assistant', content: reply.text, raw: reply.raw })
      return { answer: reply.text.trim(), steps, found: [...found.values()], messages: [...(o.history ?? []), ...turn] }
    }
    turn.push({ role: 'assistant', content: reply.text, toolCalls: reply.toolCalls, raw: reply.raw })
    for (const call of reply.toolCalls) {
      const tool = o.tools.find((t) => t.name === call.name)
      const step: AgentStep = { call, label: tool ? tool.label(call.args) : `Asked for ${call.name}`, found: [] }
      let content: string
      try {
        if (!tool) throw new Error(`There is no tool called ${call.name}.`)
        const out = await tool.run(call.args)
        step.found = out.found ?? []
        for (const f of step.found) found.set(`${f.kind}:${f.id}`, f)
        content = toJson(out.result)
      } catch (e) {
        if (o.signal?.aborted) throw e
        step.error = e instanceof Error ? e.message : 'That tool failed.'
        content = toJson({ error: step.error })
      }
      steps.push(step)
      o.onStep?.(step)
      turn.push({ role: 'tool', content, toolCallId: call.id, name: call.name })
    }
  }
}
