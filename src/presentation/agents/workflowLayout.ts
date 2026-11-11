import type { GraphEdge, GraphNode, NodeType } from '@/domain/ai/AgentApi'

export const NODE_W = 156
export const NODE_H = 66
const GAP_X = 52
const GAP_Y = 22

export interface Placed {
  node: GraphNode
  col: number
  row: number
  x: number
  y: number
}

/** Where each node goes: a column per step from the trigger (a loop's way back doesn't count as a step), and a row for each branch within a column. */
export function layout(nodes: GraphNode[], edges: GraphEdge[]): { placed: Placed[]; width: number; height: number } {
  const forward = edges.filter((e) => e.label !== 'again')
  const start = nodes.find((n) => n.type === 'trigger')?.id
  const depth = new Map<string, number>()
  if (start) {
    depth.set(start, 0)
    // longest path from the trigger, so a node always sits to the right of everything that leads into it
    for (let pass = 0; pass < nodes.length; pass++) {
      let moved = false
      for (const e of forward) {
        const d = depth.get(e.from)
        if (d !== undefined && (depth.get(e.to) ?? -1) < d + 1 && d + 1 <= nodes.length) {
          depth.set(e.to, d + 1)
          moved = true
        }
      }
      if (!moved) break
    }
  }
  const rows = new Map<number, number>()
  const placed = nodes.map((node) => {
    const col = depth.get(node.id) ?? Math.max(0, ...depth.values()) + 1 // a node nothing leads to goes after the rest
    const row = rows.get(col) ?? 0
    rows.set(col, row + 1)
    return { node, col, row, x: col * (NODE_W + GAP_X), y: row * (NODE_H + GAP_Y) }
  })
  return { placed, width: Math.max(0, ...placed.map((p) => p.x)) + NODE_W, height: Math.max(0, ...placed.map((p) => p.y)) + NODE_H }
}

/** The curve of one edge, and where to write its label. A way back (a loop's `again`) arcs over the top. */
export function edgePath(from: Placed, to: Placed): { d: string; lx: number; ly: number } {
  const sx = from.x + NODE_W
  const sy = from.y + NODE_H / 2
  const tx = to.x
  const ty = to.y + NODE_H / 2
  if (tx <= sx) {
    const top = Math.min(from.y, to.y) - 22
    return { d: `M ${from.x + NODE_W / 2} ${from.y} C ${from.x + NODE_W / 2} ${top}, ${to.x + NODE_W / 2} ${top}, ${to.x + NODE_W / 2} ${to.y}`, lx: (from.x + to.x) / 2 + NODE_W / 2, ly: top + 4 }
  }
  const mx = (sx + tx) / 2
  return { d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`, lx: mx, ly: (sy + ty) / 2 - 4 }
}

export const TYPE_LABEL: Record<NodeType, string> = {
  trigger: 'Trigger',
  scope: 'Workspace scope',
  prompt: 'Prompt',
  agent: 'Agent',
  branch: 'Branch',
  set: 'Set a value',
  loop: 'Loop',
  output: 'Answer',
}

/** What a new node of a type starts with. */
export function fresh(type: NodeType, taken: string[]): GraphNode {
  let n = 1
  while (taken.includes(`${type}${n}`)) n++
  const config: Record<string, unknown> = {
    scope: { mode: 'inherit' },
    prompt: {},
    agent: { input: '{{input}}' },
    branch: { cases: [{ var: 'input', op: 'contains', value: '', label: 'yes' }] },
    set: { name: 'value', value: '{{answer}}' },
    loop: { max: 3 },
    output: {},
    trigger: {},
  }[type] as Record<string, unknown>
  return { id: `${type}${n}`, type, label: TYPE_LABEL[type], config }
}

/** The labels an edge leaving a node may carry. */
export function labelsFor(node: GraphNode): string[] {
  if (node.type === 'branch') return [...((node.config.cases as { label?: string }[] | undefined) ?? []).map((c) => String(c.label ?? '')).filter(Boolean), 'else']
  if (node.type === 'loop') return ['again', 'done']
  return ['next']
}
