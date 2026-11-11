import type { AgentGraph, GraphNode, RunDetail } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'

export type NodeState = 'ok' | 'error' | 'skipped'

/** What one node did in one execution: how it ended, a line for the card, and the data that went through it. */
export interface NodeTrace {
  state: NodeState
  summary: string
  /** Labelled blocks of what went in and came out (shown when the node is opened). */
  data: { label: string; text: string }[]
}

const clip = (text: string, n = 90) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
const ms = (n: number) => (n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`)

/**
 * An execution laid over the agent's nodes. Every node gets what it did: the trigger what was asked, the scope which workspace the run was held
 * to, the prompt what the model was given, the model its time and tokens, each tool its calls, and the answer what came back. Built only from
 * what the run recorded, so nothing is invented: a tool the model never called is "skipped".
 */
export function traceOf(graph: AgentGraph, run: RunDetail): Record<string, NodeTrace> {
  const out: Record<string, NodeTrace> = {}
  const failed = run.status === 'error'
  const scope = run.workspace && run.workspace in WORKSPACES ? WORKSPACES[run.workspace as WorkspaceId].name : 'All workspaces'
  for (const n of graph.nodes) out[n.id] = nodeTrace(n, run, failed, scope)
  return out
}

function nodeTrace(n: GraphNode, run: RunDetail, failed: boolean, scope: string): NodeTrace {
  switch (n.type) {
    case 'trigger':
      return { state: 'ok', summary: clip(run.input, 60) || run.trigger, data: [{ label: 'Started by', text: run.trigger }, { label: 'Asked', text: run.input }] }
    case 'scope':
      return { state: 'ok', summary: scope, data: [{ label: 'Limited to', text: run.workspace ? `${scope} only: the model was given nothing from another workspace.` : 'Every workspace (the app’s own chat).' }] }
    case 'prompt':
      return { state: 'ok', summary: 'Prompt filled in', data: [{ label: 'What the model was given', text: run.userMessage }, { label: 'System prompt', text: run.systemPrompt }] }
    case 'model': {
      const u = run.usage ?? {}
      const tokens = (u.inputTokens ?? 0) + (u.outputTokens ?? 0)
      return {
        state: failed && !run.stepLog.length ? 'error' : 'ok',
        summary: `${run.model || 'model'} · ${ms(run.durationMs)}${tokens ? ` · ${tokens} tokens` : ''}`,
        data: [
          { label: 'Model', text: `${run.provider} · ${run.model} · thinking ${run.thinking}` },
          { label: 'Used', text: `${u.inputTokens ?? 0} tokens in, ${u.outputTokens ?? 0} out, ${ms(run.durationMs)} in all, ${run.steps} tool call${run.steps === 1 ? '' : 's'}` },
        ],
      }
    }
    case 'tool': {
      const calls = run.stepLog.filter((s) => s.tool === n.label)
      if (calls.length === 0) return { state: 'skipped', summary: 'Not called', data: [] }
      const bad = calls.find((c) => c.error)
      return {
        state: bad ? 'error' : 'ok',
        summary: `${calls.length} call${calls.length === 1 ? '' : 's'} · ${ms(calls.reduce((a, c) => a + c.ms, 0))}`,
        data: calls.flatMap((c, i) => [
          { label: `Call ${i + 1} asked`, text: JSON.stringify(c.args, null, 2) },
          { label: `Call ${i + 1} gave back`, text: c.error ? `Error: ${c.error}` : `${c.result}${c.found ? `\n(${c.found} card${c.found === 1 ? '' : 's'} shown)` : ''}` },
        ]),
      }
    }
    default:
      return { state: failed ? 'error' : 'ok', summary: clip(failed ? (run.error ?? 'Failed') : run.output, 70), data: [{ label: failed ? 'Error' : 'Answer', text: failed ? (run.error ?? '') : run.output }] }
  }
}
