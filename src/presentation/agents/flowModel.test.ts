import { describe, expect, it } from 'vitest'
import type { FlowConnections, FlowNode } from '@/domain/ai/AgentApi'
import { fromEdges, handleIn, handleOut, inputsOf, newNode, outputsOf, toEdges, traceByNode } from './flowModel'

const n = (id: string, type: string, parameters: Record<string, unknown> = {}): FlowNode => ({ id, type, name: id, position: [0, 0], parameters })

describe('a node’s outputs and inputs', () => {
  it('gives an If true and false, a Switch a lane per rule and a fallback, a Loop loop and done, and an Answer none', () => {
    expect(outputsOf(n('i', 'core.if'))).toEqual(['true', 'false'])
    expect(outputsOf(n('s', 'core.switch', { rules: [{}, {}] }))).toEqual(['rule 1', 'rule 2', 'fallback'])
    expect(outputsOf(n('l', 'core.loop'))).toEqual(['loop', 'done'])
    expect(outputsOf(n('r', 'respond'))).toEqual([])
    expect(outputsOf(n('d', 'data.tasks'))).toEqual([''])
  })
  it('gives a Merge two inputs and a trigger none', () => {
    expect([inputsOf('core.merge'), inputsOf('trigger.chat'), inputsOf('core.if')]).toEqual([2, 0, 1])
  })
})

describe('connections and canvas edges are the same thing', () => {
  const nodes = [n('t', 'trigger.chat'), n('if', 'core.if'), n('a', 'respond'), n('b', 'respond'), n('m', 'core.merge')]
  const connections: FlowConnections = {
    t: { main: [[{ node: 'if', index: 0 }]] },
    if: { main: [[{ node: 'a', index: 0 }, { node: 'm', index: 0 }], [{ node: 'm', index: 1 }]] },
  }

  it('draws one edge per target from the right output handle to the right input handle', () => {
    const edges = toEdges(connections)
    expect(edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual([
      ['t', handleOut(0), 'if', handleIn(0)],
      ['if', handleOut(0), 'a', handleIn(0)],
      ['if', handleOut(0), 'm', handleIn(0)],
      ['if', handleOut(1), 'm', handleIn(1)],
    ])
  })
  it('reads the edges back into the same connections, with a lane for every output of a connected node', () => {
    expect(fromEdges(nodes, toEdges(connections))).toEqual(connections)
    const only = fromEdges(nodes, [{ source: 'if', sourceHandle: handleOut(1), target: 'a', targetHandle: handleIn(0) }])
    expect(only.if!.main).toEqual([[], [{ node: 'a', index: 0 }]]) // the true lane is kept, empty
  })
})

describe('new nodes and traces', () => {
  it('starts a node with parameters that already work, never reusing an id', () => {
    const a = newNode('core.if', 'If', ['if1'], [0, 0])
    expect(a.id).toBe('if2')
    expect((a.parameters.conditions as unknown[]).length).toBe(1)
    expect(newNode('trigger.schedule', 'On a schedule', [], [0, 0]).parameters).toMatchObject({ time: '07:30' })
  })
  it('keeps each node’s last run and counts a loop’s repeats, and ignores a run from an older engine', () => {
    const t = traceByNode([
      { node: 'a', name: 'A', type: 'core.set', state: 'ok', ms: 1, itemsIn: 1 },
      { node: 'a', name: 'A', type: 'core.set', state: 'ok', ms: 2, itemsIn: 1 },
      { node: 'old', type: 'agent', label: 'x', state: 'ok', ms: 3, in: '', out: '' },
    ])
    expect(t.a).toMatchObject({ ms: 2, runs: 2 })
    expect(t.old).toBeUndefined()
  })
})
