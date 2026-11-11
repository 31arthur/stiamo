import type { TraceEntry } from '@/domain/ai/AgentApi'

/** What one node did across a run: how it ended, a line for its card, and each visit (a loop visits its nodes more than once). */
export interface NodeTrace {
  state: 'ok' | 'error' | 'skipped'
  summary: string
  visits: TraceEntry[]
}

const ms = (n: number) => (n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`)
const clip = (text: string, n = 70) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

/**
 * A run laid over the workflow's nodes, from the trace the run recorded. A node the run never reached (the other side of a branch) is "skipped".
 * Nothing is inferred: each visit is exactly what the engine kept.
 */
export function traceOf(nodeIds: string[], trace: TraceEntry[] | undefined): Record<string, NodeTrace> {
  const out: Record<string, NodeTrace> = {}
  for (const id of nodeIds) {
    const visits = (trace ?? []).filter((t) => t.node === id)
    if (visits.length === 0) {
      out[id] = { state: 'skipped', summary: 'Not reached', visits }
      continue
    }
    const last = visits[visits.length - 1]!
    const total = visits.reduce((a, v) => a + v.ms, 0)
    const tools = visits.flatMap((v) => v.calls ?? [])
    const bad = visits.find((v) => v.state === 'error')
    const extra = tools.length ? ` · ${tools.length} tool call${tools.length === 1 ? '' : 's'}` : ''
    out[id] = {
      state: bad ? 'error' : 'ok',
      summary: `${clip(bad?.out || last.out || last.in || '—')} · ${ms(total)}${visits.length > 1 ? ` · ${visits.length} times` : ''}${extra}`,
      visits,
    }
  }
  return out
}
