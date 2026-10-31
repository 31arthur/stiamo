import { describe, expect, it } from 'vitest'
import { geminiModels, GeminiClient, thinkingConfig, toGeminiContents } from './gemini'
import { OpenAiCompatibleClient, openAiModels, openRouterModels, toOpenAiMessages } from './openaiCompatible'
import { purgeAiSettings, readAiSettings, writeAiSettings } from './store'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('model lists', () => {
  it('offers only OpenAI models that chat, and marks the ones that think', () => {
    const out = openAiModels({ data: [{ id: 'gpt-4o' }, { id: 'o3' }, { id: 'gpt-5-mini' }, { id: 'text-embedding-3-small' }, { id: 'whisper-1' }, { id: 'gpt-4o-audio-preview' }, { id: 'o1-mini' }] })
    expect(out.map((m) => m.id).sort()).toEqual(['gpt-4o', 'gpt-5-mini', 'o3'])
    expect(out.find((m) => m.id === 'o3')?.thinking).toEqual(['low', 'medium', 'high'])
    expect(out.find((m) => m.id === 'gpt-4o')?.thinking).toEqual([])
  })

  it('offers OpenRouter models that can call tools, with thinking where they take `reasoning`', () => {
    const out = openRouterModels({
      data: [
        { id: 'a/plain', name: 'Plain', supported_parameters: ['tools'] },
        { id: 'b/thinker', name: 'Thinker', supported_parameters: ['tools', 'reasoning'] },
        { id: 'c/no-tools', name: 'No tools', supported_parameters: ['temperature'] },
      ],
    })
    expect(out.map((m) => m.id)).toEqual(['a/plain', 'b/thinker'])
    expect(out[1].thinking).toEqual(['off', 'low', 'medium', 'high'])
  })

  it('offers Gemini models that generate text, with the thinking each one allows', () => {
    const out = geminiModels({
      models: [
        { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-pro-preview', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/text-bison', supportedGenerationMethods: ['generateContent'] },
      ],
    })
    const by = Object.fromEntries(out.map((m) => [m.id, m.thinking]))
    expect(Object.keys(by).sort()).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'])
    expect(by['gemini-2.5-pro']).toEqual(['low', 'medium', 'high'])
    expect(by['gemini-2.5-flash']).toContain('off')
    expect(by['gemini-3-pro-preview']).toEqual(['low', 'high'])
  })

  it('turns a thinking level into what each Gemini generation expects', () => {
    expect(thinkingConfig('gemini-2.5-flash', 'off')).toEqual({ thinkingBudget: 0 })
    expect(thinkingConfig('gemini-2.5-pro', 'high')).toEqual({ thinkingBudget: 24576 })
    expect(thinkingConfig('gemini-3-pro-preview', 'medium')).toEqual({ thinkingLevel: 'high' })
    expect(thinkingConfig('gemini-1.5-pro', 'high')).toBeUndefined()
  })
})

describe('talking to OpenAI and OpenRouter', () => {
  it('sends tools and the thinking level, and reads tool calls back', async () => {
    let sent: { url: string; body: Record<string, unknown>; auth: string | null } | undefined
    const client = new OpenAiCompatibleClient('openai', 'sk-test', async (url, init) => {
      sent = { url: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('Authorization') }
      return json({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'search_cases', arguments: '{"query":"NHAI"}' } }] } }] })
    })
    const out = await client.chat({ model: 'o3', thinking: 'high', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 'search_cases', description: 'd', parameters: { type: 'object' } }] })
    expect(sent?.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(sent?.auth).toBe('Bearer sk-test')
    expect(sent?.body).toMatchObject({ model: 'o3', reasoning_effort: 'high', tool_choice: 'auto' })
    expect(out.toolCalls).toEqual([{ id: 'c1', name: 'search_cases', args: { query: 'NHAI' } }])
  })

  it('asks OpenRouter for reasoning in its own way', async () => {
    const bodies: Record<string, unknown>[] = []
    const client = new OpenAiCompatibleClient('openrouter', 'k', async (_u, init) => (bodies.push(JSON.parse(String(init?.body))), json({ choices: [{ message: { content: 'ok' } }] })))
    await client.chat({ model: 'm', thinking: 'medium', messages: [], tools: [] })
    await client.chat({ model: 'm', thinking: 'off', messages: [], tools: [] })
    expect(bodies[0].reasoning).toEqual({ effort: 'medium' })
    expect(bodies[1].reasoning).toEqual({ enabled: false })
  })

  it('writes tool calls and their results the way the API wants them', () => {
    const wire = toOpenAiMessages([
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'x', args: { a: 1 } }] },
      { role: 'tool', content: '{"ok":true}', toolCallId: 'c1', name: 'x' },
    ])
    expect(wire[0]).toMatchObject({ role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{"a":1}' } }] })
    expect(wire[1]).toEqual({ role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' })
  })

  it('says what went wrong in words', async () => {
    const client = new OpenAiCompatibleClient('openai', 'bad', async () => json({ error: { message: 'Incorrect API key provided' } }, 401))
    await expect(client.listModels()).rejects.toThrow(/didn’t accept the key/)
  })
})

describe('talking to Gemini', () => {
  it('sends the system prompt, tools and thinking, and reads function calls back with their signatures', async () => {
    let body: Record<string, unknown> = {}
    let headers: Headers | undefined
    const client = new GeminiClient('g-key', async (_u, init) => {
      body = JSON.parse(String(init?.body))
      headers = new Headers(init?.headers)
      return json({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_cases', args: { query: 'x' } }, thoughtSignature: 'sig' }] } }] })
    })
    const out = await client.chat({
      model: 'gemini-2.5-flash',
      thinking: 'low',
      messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }],
      tools: [{ name: 'search_cases', description: 'd', parameters: { type: 'object', additionalProperties: false, properties: {} } }],
    })
    expect(headers?.get('x-goog-api-key')).toBe('g-key')
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'be brief' }] })
    expect(JSON.stringify(body.tools)).not.toContain('additionalProperties')
    expect(body.generationConfig).toEqual({ thinkingConfig: { thinkingBudget: 1024 } })
    expect(out.toolCalls).toEqual([{ id: 'call_0', name: 'search_cases', args: { query: 'x' } }])
    expect(out.raw).toMatchObject({ parts: [{ thoughtSignature: 'sig' }] })
  })

  it('returns the model’s own turn untouched and groups tool results into one turn', () => {
    const raw = { role: 'model', parts: [{ functionCall: { name: 'a', args: {} }, thoughtSignature: 's' }, { functionCall: { name: 'b', args: {} } }] }
    const contents = toGeminiContents([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: '', toolCalls: [{ id: '0', name: 'a', args: {} }, { id: '1', name: 'b', args: {} }], raw },
      { role: 'tool', content: '{"n":1}', name: 'a', toolCallId: '0' },
      { role: 'tool', content: '{"n":2}', name: 'b', toolCallId: '1' },
    ])
    expect(contents).toHaveLength(3)
    expect(contents[1].parts).toBe(raw.parts)
    expect(contents[2]).toEqual({ role: 'user', parts: [{ functionResponse: { name: 'a', response: { result: { n: 1 } } } }, { functionResponse: { name: 'b', response: { result: { n: 2 } } } }] })
  })

  it('lists models across pages', async () => {
    let calls = 0
    const client = new GeminiClient('k', async () => (calls++ === 0 ? json({ models: [{ name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 't' }) : json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] })))
    expect((await client.listModels()).map((m) => m.id).sort()).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro'])
  })
})

describe('keeping the keys', () => {
  const memory = (): Storage => {
    const m = new Map<string, string>()
    return { get length() { return m.size }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear() }
  }

  it('keeps a user’s keys and selection apart from everyone else’s', () => {
    const s = memory()
    writeAiSettings('u1', { keys: { openai: 'sk-1' }, selection: { providerId: 'openai', modelId: 'o3', thinking: 'high' } }, s)
    expect(readAiSettings('u1', s)).toEqual({ keys: { openai: 'sk-1' }, selection: { providerId: 'openai', modelId: 'o3', thinking: 'high' } })
    expect(readAiSettings('u2', s)).toEqual({ keys: {} })
  })

  it('ignores damaged settings', () => {
    const s = memory()
    s.setItem('stiamo.ai.u1', '{"keys":{"openai":5,"nope":"x"},"selection":{"providerId":"x"}}')
    expect(readAiSettings('u1', s)).toEqual({ keys: {}, selection: undefined })
  })

  it('removes every key on sign-out and touches nothing else', () => {
    const s = memory()
    writeAiSettings('u1', { keys: { gemini: 'g' } }, s)
    writeAiSettings('u2', { keys: { openai: 'o' } }, s)
    s.setItem('stiamo.session.v1', 'keep')
    purgeAiSettings(s)
    expect(s.length).toBe(1)
    expect(s.getItem('stiamo.session.v1')).toBe('keep')
  })
})
