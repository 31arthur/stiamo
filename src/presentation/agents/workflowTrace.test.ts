import { describe, expect, it } from 'vitest'
import type { AgentGraph, RunDetail } from '@/domain/ai/AgentApi'
import { traceOf } from './workflowTrace'

const graph: AgentGraph = {
  agentId: 'daily-planner',
  name: 'Daily planner',
  nodes: [
    { id: 'trigger', type: 'trigger', label: 'Starts when', config: {} },
    { id: 'scope', type: 'scope', label: 'Workspace scope', config: {} },
    { id: 'prompt', type: 'prompt', label: 'Prompt', config: {} },
    { id: 'model', type: 'model', label: 'Model', config: {} },
    { id: 'tool:day_agenda', type: 'tool', label: 'day_agenda', pack: 'agenda', config: {} },
    { id: 'tool:free_time', type: 'tool', label: 'free_time', pack: 'agenda', config: {} },
    { id: 'output', type: 'output', label: 'Answer', config: {} },
  ],
  edges: [],
}

const run = (over: Partial<RunDetail> = {}): RunDetail =>
  ({
    id: 'r', agentId: 'daily-planner', trigger: 'telegram', status: 'ok', startedAt: '', durationMs: 2300, provider: 'openrouter', model: 'm', input: 'Plan my day', output: 'Here is the day.', found: 1, steps: 2,
    thinking: 'off', userMessage: 'wrapped', systemPrompt: 'system', tools: [], usage: { inputTokens: 100, outputTokens: 20 }, workspace: 'sb',
    stepLog: [{ tool: 'day_agenda', label: 'Read the agenda', args: { date: '2026-11-12' }, found: 0, ms: 40, result: '{"hearings":[]}' }, { tool: 'day_agenda', label: 'Read the agenda', args: {}, found: 0, ms: 60, result: '{}' }],
    ...over,
  }) as RunDetail

describe('an execution laid over the nodes', () => {
  it('says what each node did, from what the run recorded', () => {
    const t = traceOf(graph, run())
    expect(t.trigger).toMatchObject({ state: 'ok', summary: 'Plan my day' })
    expect(t.scope!.summary).toBe('S&B Consultants')
    expect(t.prompt!.data[0]).toEqual({ label: 'What the model was given', text: 'wrapped' })
    expect(t.model!.summary).toBe('m · 2.3 s · 120 tokens')
    expect(t['tool:day_agenda']).toMatchObject({ state: 'ok', summary: '2 calls · 100 ms' })
    expect(t['tool:day_agenda']!.data).toHaveLength(4)
    expect(t.output).toMatchObject({ state: 'ok', summary: 'Here is the day.' })
  })

  it('shows a tool the model never called as skipped, and a run with no workspace as all of them', () => {
    const t = traceOf(graph, run({ workspace: '' }))
    expect(t['tool:free_time']).toEqual({ state: 'skipped', summary: 'Not called', data: [] })
    expect(t.scope!.summary).toBe('All workspaces')
  })

  it('marks the failing node and the answer when a tool or the run failed', () => {
    const bad = run({ status: 'error', error: 'The model did not answer.', stepLog: [{ tool: 'free_time', label: 'x', args: {}, found: 0, ms: 5, result: '', error: 'No calendar' }] })
    const t = traceOf(graph, bad)
    expect(t['tool:free_time']).toMatchObject({ state: 'error' })
    expect(t.output).toMatchObject({ state: 'error', summary: 'The model did not answer.' })
  })
})
