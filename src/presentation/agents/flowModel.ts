import type { FlowConnections, FlowNode, FlowTrace } from '@/domain/ai/AgentApi'

/** A connection as the canvas draws it: from an output handle of one node to an input handle of another. */
export interface CanvasEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export const TRIGGERS = ['trigger.chat', 'trigger.schedule', 'trigger.manual']

/** The labels of a node's outputs, in order (an If has true and false; a Switch one per rule and a fallback). No outputs: it ends the run. */
export function outputsOf(node: Pick<FlowNode, 'type' | 'parameters'>): string[] {
  switch (node.type) {
    case 'core.if':
      return ['true', 'false']
    case 'core.loop':
      return ['loop', 'done']
    case 'msg.ask':
      return Array.from({ length: Math.max(2, ((node.parameters.options as unknown[] | undefined) ?? []).length) }, (_, i) => String(((node.parameters.options as string[] | undefined) ?? [])[i] ?? `answer ${i + 1}`))
    case 'core.switch':
      return [...((node.parameters.rules as unknown[] | undefined) ?? []).map((_, i) => `rule ${i + 1}`), 'fallback']
    case 'respond':
    case 'core.stop':
    case 'core.note':
      return []
    default:
      return ['']
  }
}

export const inputsOf = (type: string): number => (type === 'core.merge' ? 2 : TRIGGERS.includes(type) || type === 'core.note' ? 0 : 1)

export const handleOut = (i: number) => `out-${i}`
export const handleIn = (i: number) => `in-${i}`
const indexOf = (handle: string | null | undefined) => Number((handle ?? '').split('-')[1] ?? 0) || 0

/** The canvas edges of a workflow's connections. */
export function toEdges(connections: FlowConnections): CanvasEdge[] {
  return Object.entries(connections).flatMap(([source, v]) =>
    (v.main ?? []).flatMap((targets, out) => targets.map((t) => ({ id: `${source}:${out}:${t.node}:${t.index}`, source, sourceHandle: handleOut(out), target: t.node, targetHandle: handleIn(t.index) }))),
  )
}

/** The connections of a set of canvas edges: per node, one list of targets for each output (as many lists as the node has outputs). */
export function fromEdges(nodes: Pick<FlowNode, 'id' | 'type' | 'parameters'>[], edges: Pick<CanvasEdge, 'source' | 'sourceHandle' | 'target' | 'targetHandle'>[]): FlowConnections {
  const out: FlowConnections = {}
  for (const n of nodes) {
    const lanes = Math.max(outputsOf(n).length, 1)
    const mine = edges.filter((e) => e.source === n.id)
    if (mine.length === 0) continue
    out[n.id] = { main: Array.from({ length: lanes }, (_, i) => mine.filter((e) => indexOf(e.sourceHandle) === i).map((e) => ({ node: e.target, index: indexOf(e.targetHandle) }))) }
  }
  return out
}

/** What a new node of a type starts with: parameters that already do something sensible. */
export function newNode(type: string, label: string, taken: string[], position: [number, number]): FlowNode {
  const base = type.split('.')[1] ?? type
  let n = 1
  while (taken.includes(`${base}${n}`)) n++
  const parameters: Record<string, unknown> =
    {
      'trigger.schedule': { time: '07:30', timezone: 'Asia/Kolkata', days: [0, 1, 2, 3, 4, 5, 6] },
      'core.if': { combine: 'all', conditions: [{ left: '{{ $json.title }}', op: 'contains', right: '' }] },
      'core.filter': { combine: 'all', conditions: [{ left: '{{ $json.title }}', op: 'contains', right: '' }] },
      'core.switch': { rules: [{ left: '{{ $json.title }}', op: 'contains', right: '' }] },
      'core.set': { keepOthers: true, fields: [{ name: 'field', value: '{{ $json.title }}' }] },
      'core.sort': { field: 'title', order: 'asc' },
      'core.limit': { max: 5 },
      'core.loop': { batchSize: 1 },
      'core.split_out': { field: 'items' },
      'core.stop': { message: 'Stopped.' },
      'data.mail': { days: 1, limit: 20, query: '' },
      'data.contacts': { query: '{{ $json.message }}', limit: 5 },
      'data.tasks': { status: 'open', overdue: false, limit: 50 },
      'data.follow_ups': { status: 'open', overdue: false, limit: 50 },
      'data.meetings': { status: 'open', limit: 50 },
      'data.hearings': { status: 'open', limit: 50 },
      'data.cases': { status: 'active', limit: 50 },
      'data.calendar': { limit: 50 },
      'data.drive': { query: '{{ $json.message }}', limit: 10 },
      'msg.send': { text: '{{ $json.text }}', once: true },
      'msg.telegram': { credential: '', chat: '', text: '{{ $json.text }}', once: true },
      'msg.mail': { to: '{{ $json.email }}', subject: '', text: '', tell: true },
      'msg.ask': { text: 'Shall I go ahead?', options: ['Yes', 'No'] },
      'ai.agent': { prompt: '{{ $json.text }}', history: false },
      respond: { text: '{{ $json.text }}' },
      'core.note': { text: 'A note' },
    }[type] ?? {}
  return { id: `${base}${n}`, type, name: label, position, parameters }
}

/** The last time each node ran in an execution (a node a loop ran more than once keeps its last run and a count). */
export function traceByNode(trace: unknown[] | undefined): Record<string, FlowTrace & { runs: number }> {
  const out: Record<string, FlowTrace & { runs: number }> = {}
  for (const t of (trace ?? []) as FlowTrace[]) {
    if (typeof t?.node !== 'string' || typeof t.itemsIn !== 'number') continue // (a run from an older engine has no items)
    out[t.node] = { ...t, runs: (out[t.node]?.runs ?? 0) + 1 }
  }
  return out
}
