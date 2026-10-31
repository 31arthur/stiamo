import { describe, expect, it } from 'vitest'
import { runAgent } from './agent'
import type { Tool } from './agent'
import { buildCaseTools, matchCases } from './caseTools'
import type { CaseToolsData } from './caseTools'
import type { ChatRequest, ChatResult, LlmClient } from './types'

const base = { userId: 'u', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const kase = (id: string, over: Record<string, unknown> = {}) => ({ ...base, id, reference: `SA-2026-00${id}`, title: `Case ${id}`, status: 'active', type: 'pow', summary: '', organization: 'SA', ...over }) as never

/** A model that answers from a script, and remembers what it was asked. */
function scripted(...replies: ChatResult[]): LlmClient & { asked: ChatRequest[] } {
  const asked: ChatRequest[] = []
  return {
    asked,
    listModels: async () => [],
    chat: async (req) => {
      asked.push(structuredClone({ ...req, signal: undefined }))
      return replies.shift() ?? { text: 'done', toolCalls: [] }
    },
  }
}

const echo: Tool = {
  name: 'echo',
  description: 'echo',
  parameters: { type: 'object', properties: {} },
  label: (a) => `Echoed ${String(a.word)}`,
  run: async (a) => ({ result: { said: a.word }, found: [{ kind: 'case', id: '1', reference: 'R1', title: 'One', status: 'Active' }] }),
}

describe('the agent loop', () => {
  it('runs the tools the model asks for, hands back the results, and returns its answer', async () => {
    const client = scripted({ text: '', toolCalls: [{ id: 'c1', name: 'echo', args: { word: 'hi' } }] }, { text: 'It said hi.', toolCalls: [] })
    const steps: string[] = []
    const run = await runAgent({ client, model: 'm', thinking: 'off', system: 'sys', tools: [echo], question: 'say hi', onStep: (s) => steps.push(s.label) })
    expect(run.answer).toBe('It said hi.')
    expect(steps).toEqual(['Echoed hi'])
    expect(run.found.map((f) => f.id)).toEqual(['1'])
    const second = client.asked[1].messages
    expect(second.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool'])
    expect(second[3]).toMatchObject({ toolCallId: 'c1', content: '{"said":"hi"}' })
  })

  it('tells the model when a tool fails or does not exist, and carries on', async () => {
    const boom: Tool = { ...echo, name: 'boom', run: async () => Promise.reject(new Error('kaput')) }
    const client = scripted({ text: '', toolCalls: [{ id: 'a', name: 'boom', args: {} }, { id: 'b', name: 'nope', args: {} }] }, { text: 'Sorry.', toolCalls: [] })
    const run = await runAgent({ client, model: 'm', thinking: 'off', system: 's', tools: [boom], question: 'q' })
    expect(run.steps.map((s) => s.error)).toEqual(['kaput', 'There is no tool called nope.'])
    expect(run.answer).toBe('Sorry.')
  })

  it('stops asking for tools after the step limit and makes the model answer', async () => {
    const loop = { text: '', toolCalls: [{ id: 'x', name: 'echo', args: { word: 'again' } }] }
    const client = scripted(loop, loop, { text: 'Enough.', toolCalls: [] })
    const run = await runAgent({ client, model: 'm', thinking: 'off', system: 's', tools: [echo], question: 'q', maxSteps: 2 })
    expect(run.answer).toBe('Enough.')
    expect(client.asked[2].tools).toEqual([])
  })

  it('carries a conversation on from its history', async () => {
    const client = scripted({ text: 'First.', toolCalls: [] }, { text: 'Second.', toolCalls: [] })
    const one = await runAgent({ client, model: 'm', thinking: 'off', system: 's', tools: [], question: 'a' })
    await runAgent({ client, model: 'm', thinking: 'off', system: 's', tools: [], question: 'b', history: one.messages })
    expect(client.asked[1].messages.map((m) => m.content)).toEqual(['s', 'a', 'First.', 'b'])
  })
})

describe('the case tools', () => {
  const data = (over: Partial<CaseToolsData> = {}): CaseToolsData => ({
    cases: [kase('1', { title: 'Alur NHAI wages', client: 'Alur workers', opposingParty: 'NHAI', courtNumber: 'WP 1290/2026' }), kase('2', { title: 'Brick kiln', opposingParty: 'Kiln Co', status: 'closed' })],
    hearings: [{ ...base, id: 'h1', caseId: '1', date: '2026-11-03', duration: 30, purpose: 'Arguments', outcome: { status: 'open' } }] as never,
    attachments: [],
    driveAvailable: true,
    today: '2026-10-31',
    drive: {
      status: async () => ({ available: true }),
      search: async (q) => ({ items: q.includes('wage') ? [{ id: 'f1', name: 'Wage Breakdown.pdf', mimeType: 'application/pdf' }] : [] }),
      suggest: async () => [{ id: 'f2', name: 'Reply from NHAI.pdf', mimeType: 'application/pdf', matched: ['NHAI'] }],
      content: async () => new Blob(),
    },
    ...over,
  })
  const tool = (name: string, d = data()) => buildCaseTools(d).find((t) => t.name === name)!

  it('finds cases by what a person would type', () => {
    expect(matchCases(data().cases, 'nhai alur').map((c) => c.id)).toEqual(['1'])
    expect(matchCases(data().cases, 'wp 1290').map((c) => c.id)).toEqual(['1'])
    // No case has both words, so the cases with one of them come back.
    expect(matchCases(data().cases, 'kiln wages').map((c) => c.id).sort()).toEqual(['1', '2'])
  })

  it('lists matching cases with their next hearing, and filters by status', async () => {
    const out = await tool('search_cases').run({ query: 'NHAI' })
    expect(out.found?.[0]).toMatchObject({ kind: 'case', reference: 'SA-2026-001', nextHearing: { date: '2026-11-03', purpose: 'Arguments' } })
    const closed = await tool('search_cases').run({ status: 'closed' })
    expect(closed.found?.map((f) => f.id)).toEqual(['2'])
  })

  it('reads one case, and says so when there is none', async () => {
    const out = await tool('get_case').run({ id: '1' })
    expect(out.result).toMatchObject({ reference: 'SA-2026-001', hearings: [{ date: '2026-11-03' }] })
    expect((await tool('get_case').run({ id: 'zzz' })).result).toMatchObject({ error: expect.any(String) })
  })

  it('gives a case its filed documents and the Drive letters that mention it', async () => {
    const d = data({ attachments: [{ ...base, id: 'a1', owner: { kind: 'case', id: '1' }, name: 'Notice.pdf', mime: 'text/uri-list', size: 0, backend: 'link', link: { url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view', provider: 'google-drive' } }] as never })
    const out = await tool('case_documents', d).run({ id: '1' })
    expect(out.found?.map((f) => (f.kind === 'document' ? f.name : ''))).toEqual(['Notice.pdf', 'Reply from NHAI.pdf'])
  })

  it('searches the Drive, or says it is not connected', async () => {
    expect((await tool('find_documents').run({ query: 'wage' })).found).toHaveLength(1)
    expect((await tool('find_documents', data({ driveAvailable: false })).run({ query: 'wage' })).result).toMatchObject({ error: expect.stringContaining('not connected') })
  })
})
