import { describe, expect, it } from 'vitest'
import { fromN8n, isN8n } from './n8nImport'
import { readWorkflowJson } from './flowModel'

const known = ['trigger.chat', 'trigger.telegram', 'trigger.orchestrator', 'trigger.schedule', 'trigger.manual', 'core.if', 'core.filter', 'core.switch', 'core.set', 'core.merge', 'core.loop', 'core.note', 'core.noop', 'core.limit', 'msg.telegram', 'ai.agent', 'respond']

const workflow = {
  nodes: [
    { id: 'u1', name: 'When Called By Orchestrator', type: 'n8n-nodes-base.executeWorkflowTrigger', position: [0, 0], parameters: {} },
    { id: 'u2', name: 'Build Classification Prompt', type: 'n8n-nodes-base.code', position: [200, 0], parameters: { jsCode: 'return items' } },
    { id: 'u3', name: 'AI Agent — Classify Email', type: '@n8n/n8n-nodes-langchain.agent', position: [400, 0], parameters: { text: '={{ $json.prompt }}', options: { systemMessage: 'Classify it.' } } },
    { id: 'u4', name: 'OpenRouter Chat Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter', position: [400, 200], parameters: {} },
    { id: 'u5', name: 'Low Confidence? (≤ 0.6)', type: 'n8n-nodes-base.if', position: [600, 0], parameters: { conditions: { combinator: 'and', conditions: [{ leftValue: '={{ $json.confidence }}', rightValue: 0.6, operator: { type: 'number', operation: 'lt' } }] } } },
    { id: 'u6', name: 'Telegram — Flag for Review', type: 'n8n-nodes-base.telegram', position: [800, 0], parameters: { chatId: 'REPLACE_TELEGRAM_CHAT_ID', text: '=⚠️ {{ $json.emailType }}' } },
    { id: 'u7', name: 'Loop', type: 'n8n-nodes-base.splitInBatches', position: [800, 200], parameters: { batchSize: 5 } },
    { id: 'u8', name: 'Each', type: 'n8n-nodes-base.noOp', position: [1000, 200], parameters: {} },
    { id: 'u9', name: 'After', type: 'n8n-nodes-base.noOp', position: [1000, 300], parameters: {} },
  ],
  connections: {
    'When Called By Orchestrator': { main: [[{ node: 'Build Classification Prompt', type: 'main', index: 0 }]] },
    'Build Classification Prompt': { main: [[{ node: 'AI Agent — Classify Email', type: 'main', index: 0 }]] },
    'OpenRouter Chat Model': { ai_languageModel: [[{ node: 'AI Agent — Classify Email', type: 'ai_languageModel', index: 0 }]] },
    'AI Agent — Classify Email': { main: [[{ node: 'Low Confidence? (≤ 0.6)', type: 'main', index: 0 }]] },
    'Low Confidence? (≤ 0.6)': { main: [[{ node: 'Telegram — Flag for Review', type: 'main', index: 0 }], []] },
    Loop: { main: [[{ node: 'After', type: 'main', index: 0 }], [{ node: 'Each', type: 'main', index: 0 }]] }, // n8n: output 0 is done, output 1 is loop
  },
}

describe('reading a workflow copied out of n8n', () => {
  it('recognises n8n’s node kinds and not this app’s own', () => {
    expect(isN8n(workflow)).toBe(true)
    expect(isN8n({ nodes: [{ id: 'a', type: 'respond' }] })).toBe(false)
  })

  it('maps the kinds this app has, with their parameters', () => {
    const r = fromN8n(workflow)
    const by = Object.fromEntries(r.nodes.map((n) => [n.name, n]))
    expect(by['When Called By Orchestrator']!.type).toBe('trigger.orchestrator')
    expect(by['AI Agent — Classify Email']).toMatchObject({ type: 'ai.agent', parameters: { prompt: '{{ $json.prompt }}', system: 'Classify it.' } })
    expect(by['Low Confidence? (≤ 0.6)']).toMatchObject({ type: 'core.if', parameters: { combine: 'all', conditions: [{ left: '{{ $json.confidence }}', op: 'lt', right: '0.6' }] } })
    expect(by['Telegram — Flag for Review']).toMatchObject({ type: 'msg.telegram', parameters: { credential: '', text: '⚠️ {{ $json.emailType }}' } })
    expect(by.Loop).toMatchObject({ type: 'core.loop', parameters: { batchSize: 5 } })
  })

  it('links by name to the new ids, and turns the loop’s outputs round', () => {
    const r = fromN8n(workflow)
    const id = (name: string) => r.nodes.find((n) => n.name === name)!.id
    expect(r.connections[id('AI Agent — Classify Email')]?.main).toEqual([[{ node: id('Low Confidence? (≤ 0.6)'), index: 0 }]])
    expect(r.connections[id('Low Confidence? (≤ 0.6)')]?.main).toEqual([[{ node: id('Telegram — Flag for Review'), index: 0 }], []])
    expect(r.connections[id('Loop')]?.main).toEqual([[{ node: id('Each'), index: 0 }], [{ node: id('After'), index: 0 }]]) // loop first, done second
  })

  it('keeps what it can’t map as notes, joins nothing to them, and says so', () => {
    const r = fromN8n(workflow)
    const code = r.nodes.find((n) => n.parameters.text && String(n.parameters.text).includes('code'))!
    expect(code.type).toBe('core.note')
    expect(r.connections[r.nodes.find((n) => n.name === 'When Called By Orchestrator')!.id]?.main).toEqual([[]]) // the join to the Code node is gone
    expect(r.warnings.join(' ')).toMatch(/Not imported.*Build Classification Prompt \(code\).*OpenRouter Chat Model/)
    expect(r.warnings.join(' ')).toMatch(/Telegram nodes need a bot/)
  })

  it('comes out of readWorkflowJson as a workflow that can be pasted', () => {
    const r = readWorkflowJson(JSON.stringify(workflow), known)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings[0]).toBe('Read as an n8n workflow.')
  })
})
