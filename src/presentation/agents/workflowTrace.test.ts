import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode, TraceEntry } from '@/domain/ai/AgentApi'
import { edgePath, fresh, labelsFor, layout } from './workflowLayout'
import { traceOf } from './workflowTrace'

const n = (id: string, type: GraphNode['type'], config: Record<string, unknown> = {}): GraphNode => ({ id, type, label: id, config })
const e = (from: string, to: string, label = 'next'): GraphEdge => ({ from, to, label })

describe('where nodes go', () => {
  it('puts each node one column right of what leads into it, and branches in their own rows', () => {
    const nodes = [n('t', 'trigger'), n('b', 'branch'), n('x', 'agent'), n('y', 'agent'), n('o', 'output')]
    const { placed } = layout(nodes, [e('t', 'b'), e('b', 'x', 'yes'), e('b', 'y', 'else'), e('x', 'o'), e('y', 'o')])
    const at = Object.fromEntries(placed.map((p) => [p.node.id, [p.col, p.row]]))
    expect(at).toEqual({ t: [0, 0], b: [1, 0], x: [2, 0], y: [2, 1], o: [3, 0] })
  })

  it('does not count a loop’s way back as a step, and arcs it over the top', () => {
    const nodes = [n('t', 'trigger'), n('a', 'agent'), n('l', 'loop'), n('o', 'output')]
    const edges = [e('t', 'a'), e('a', 'l'), e('l', 'a', 'again'), e('l', 'o', 'done')]
    const { placed } = layout(nodes, edges)
    expect(placed.map((p) => p.col)).toEqual([0, 1, 2, 3])
    const back = edgePath(placed[2]!, placed[1]!)
    expect(back.d).toContain('C')
    expect(back.ly).toBeLessThan(placed[1]!.y)
  })

  it('still places a node nothing leads to', () => {
    expect(layout([n('t', 'trigger'), n('a', 'agent'), n('lost', 'set')], [e('t', 'a')]).placed.find((p) => p.node.id === 'lost')!.col).toBeGreaterThan(1)
  })
})

describe('new nodes and their edge labels', () => {
  it('starts a node with a sensible setting and never reuses an id', () => {
    expect(fresh('agent', ['agent1']).id).toBe('agent2')
    expect(fresh('loop', []).config).toEqual({ max: 3 })
  })
  it('offers a branch its cases and else, and a loop again and done', () => {
    expect(labelsFor(n('b', 'branch', { cases: [{ label: 'money' }, { label: 'law' }] }))).toEqual(['money', 'law', 'else'])
    expect(labelsFor(n('l', 'loop'))).toEqual(['again', 'done'])
    expect(labelsFor(n('a', 'agent'))).toEqual(['next'])
  })
})

describe('a run laid over the nodes', () => {
  const visit = (node: string, over: Partial<TraceEntry> = {}): TraceEntry => ({ node, type: 'agent', label: node, state: 'ok', ms: 40, in: 'in', out: 'out', ...over })

  it('says what each node did, counts a loop’s repeats, and marks the road not taken as not reached', () => {
    const t = traceOf(['t', 'a', 'x', 'o'], [visit('t', { out: '' }), visit('a', { out: 'draft', calls: [{ tool: 'day_agenda', ms: 5, found: 0 }] }), visit('a', { out: 'FINAL' }), visit('o', { out: 'FINAL' })])
    expect(t.a).toMatchObject({ state: 'ok' })
    expect(t.a!.summary).toBe('FINAL · 80 ms · 2 times · 1 tool call')
    expect(t.x).toEqual({ state: 'skipped', summary: 'Not reached', visits: [] })
  })

  it('shows a failure on the node that failed', () => {
    expect(traceOf(['a'], [visit('a', { state: 'error', out: 'The provider is down.' })]).a).toMatchObject({ state: 'error' })
  })

  it('treats a run from before workflows (no trace) as all not reached, without failing', () => {
    expect(traceOf(['a'], undefined).a!.state).toBe('skipped')
  })
})
