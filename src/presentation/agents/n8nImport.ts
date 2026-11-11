import type { FlowConnections, FlowNode, NodeSettings } from '@/domain/ai/AgentApi'

/**
 * Reads a workflow copied out of n8n and says it in this app's terms. n8n names its nodes' kinds its own way (`n8n-nodes-base.if`), links nodes by
 * their NAME rather than an id, and keeps conditions and values in its own shapes; this maps the kinds this app has, and says plainly what it left
 * out (a node of a kind with no counterpart here is kept as a sticky note, so nothing silently vanishes and the wiring around it is still visible).
 */

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : [])
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : d)
/** n8n marks an expression with a leading "=": here an expression is just text with {{ }} in it. */
const expr = (v: unknown): string => str(v).replace(/^=/, '')

export function isN8n(v: unknown): boolean {
  const nodes = list(obj(v).nodes)
  return nodes.length > 0 && nodes.every((n) => typeof n.type === 'string' && /^(n8n-nodes-base|@n8n\/n8n-nodes-langchain)\./.test(n.type as string))
}

const OPS: Record<string, string> = {
  contains: 'contains', notContains: 'not_contains', equals: 'equals', equal: 'equals', notEquals: 'not_equals', notEqual: 'not_equals', startsWith: 'starts_with',
  regex: 'matches', empty: 'empty', isEmpty: 'empty', notEmpty: 'not_empty', isNotEmpty: 'not_empty', gt: 'gt', larger: 'gt', gte: 'gt', lt: 'lt', smaller: 'lt', lte: 'lt',
}

interface Cond {
  left: string
  op: string
  right: string
}

/** n8n's conditions come in two shapes (the newer one with an operator object, the older one grouped by type): both become {left, op, right}. */
function conditionsOf(p: Raw): { combine: 'all' | 'any'; conditions: Cond[] } {
  const c = obj(p.conditions)
  const newer = list(c.conditions)
  if (newer.length) {
    return { combine: str(c.combinator) === 'or' ? 'any' : 'all', conditions: newer.map((x) => ({ left: expr(x.leftValue), op: OPS[str(obj(x.operator).operation)] ?? 'contains', right: expr(x.rightValue) })) }
  }
  const older = ['string', 'number', 'boolean'].flatMap((t) => list(c[t])).map((x) => ({ left: expr(x.value1), op: OPS[str(x.operation)] ?? 'equals', right: expr(x.value2) }))
  return { combine: str(p.combineOperation) === 'any' ? 'any' : 'all', conditions: older.length ? older : [{ left: '{{ $json.title }}', op: 'contains', right: '' }] }
}

function assignmentsOf(p: Raw): { name: string; value: string }[] {
  const newer = list(obj(p.assignments).assignments).map((a) => ({ name: str(a.name), value: expr(a.value) }))
  if (newer.length) return newer
  const v = obj(p.values)
  return ['string', 'number', 'boolean'].flatMap((t) => list(v[t])).map((a) => ({ name: str(a.name), value: expr(a.value) }))
}

function timeOf(p: Raw): string {
  const r = list(obj(p.rule).interval)[0]
  if (!r) return '07:30'
  const h = Number(r.triggerAtHour ?? 7), m = Number(r.triggerAtMinute ?? 0)
  return `${String(Math.min(Math.max(h, 0), 23)).padStart(2, '0')}:${String(Math.min(Math.max(m, 0), 59)).padStart(2, '0')}`
}

/** What each n8n kind becomes here, and its parameters. Returns undefined for a kind with no counterpart. */
function convert(type: string, p: Raw, name: string): { type: string; parameters: Record<string, unknown> } | undefined {
  const t = type.replace(/^(n8n-nodes-base|@n8n\/n8n-nodes-langchain)\./, '')
  switch (t) {
    case 'manualTrigger':
      return { type: 'trigger.manual', parameters: {} }
    case 'scheduleTrigger':
    case 'cron':
      return { type: 'trigger.schedule', parameters: { time: timeOf(p), timezone: 'Asia/Kolkata', days: [0, 1, 2, 3, 4, 5, 6] } }
    case 'telegramTrigger':
      return { type: 'trigger.telegram', parameters: {} }
    case 'chatTrigger':
      return { type: 'trigger.chat', parameters: {} }
    case 'executeWorkflowTrigger':
      return { type: 'trigger.orchestrator', parameters: {} }
    case 'if': {
      const c = conditionsOf(p)
      return { type: 'core.if', parameters: { combine: c.combine, conditions: c.conditions } }
    }
    case 'filter': {
      const c = conditionsOf(p)
      return { type: 'core.filter', parameters: { combine: c.combine, conditions: c.conditions } }
    }
    case 'switch': {
      const rules = list(obj(p.rules).values ?? obj(p.rules).rules).map((r) => {
        const c = conditionsOf(r)
        return c.conditions[0] ?? { left: '', op: 'contains', right: '' }
      })
      return { type: 'core.switch', parameters: { rules: rules.length ? rules : [{ left: '{{ $json.title }}', op: 'contains', right: '' }] } }
    }
    case 'set': {
      const fields = assignmentsOf(p)
      return { type: 'core.set', parameters: { keepOthers: p.includeOtherFields === true || p.keepOnlySet === false, fields: fields.length ? fields : [{ name: 'field', value: '{{ $json.title }}' }] } }
    }
    case 'merge':
      return { type: 'core.merge', parameters: {} }
    case 'splitInBatches':
      return { type: 'core.loop', parameters: { batchSize: Math.max(1, Number(p.batchSize ?? 1) || 1) } }
    case 'splitOut':
      return { type: 'core.split_out', parameters: { field: str(p.fieldToSplitOut, 'items') } }
    case 'aggregate':
      return { type: 'core.aggregate', parameters: { field: str(obj(list(obj(p.fieldsToAggregate).fieldToAggregate)[0]).fieldToAggregate, 'title') } }
    case 'limit':
      return { type: 'core.limit', parameters: { max: Math.max(1, Number(p.maxItems ?? 1) || 1) } }
    case 'sort': {
      const f = list(obj(p.sortFieldsUi).sortField)[0]
      return { type: 'core.sort', parameters: { field: str(f?.fieldName, 'title'), order: str(f?.order) === 'descending' ? 'desc' : 'asc' } }
    }
    case 'wait': {
      const unit = str(p.unit, 'hours')
      const amount = Number(p.amount ?? 1) || 1
      return { type: 'core.wait', parameters: { amount, unit: unit.startsWith('min') ? 'minutes' : 'seconds' } }
    }
    case 'noOp':
      return { type: 'core.noop', parameters: {} }
    case 'stopAndError':
      return { type: 'core.stop', parameters: { message: expr(p.errorMessage) || 'Stopped.' } }
    case 'stickyNote':
      return { type: 'core.note', parameters: { text: str(p.content, name) } }
    case 'telegram':
      return { type: 'msg.telegram', parameters: { credential: '', chat: '', text: expr(p.text) || '{{ $json.text }}', once: true } }
    case 'agent':
      return { type: 'ai.agent', parameters: { prompt: expr(p.text) || '{{ $json.asked }}', ...(str(obj(p.options).systemMessage) ? { system: expr(obj(p.options).systemMessage) } : {}), history: false } }
    default:
      return undefined
  }
}

/** Language-model and tool nodes hang off an AI agent in n8n; here the agent has its own model slot, so these are noted rather than kept. */
const SUB = /(lmChat|embeddings|memory|tool|vectorStore|outputParser|retriever|textSplitter|documentLoader)/i

/** What n8n keeps beside a node (retry, what to do on an error, run once, always output, its notes), in this app's settings. */
function settingsOf(r: Raw): NodeSettings {
  const s: NodeSettings = {}
  if (r.retryOnFail === true) Object.assign(s, { retryOnFail: true, maxTries: Math.min(5, Math.max(2, Number(r.maxTries ?? 3) || 3)), waitBetween: Math.min(10_000, Math.max(0, Number(r.waitBetweenTries ?? 1000) || 1000)) })
  if (str(r.onError).startsWith('continue')) s.onError = 'continue'
  if (r.executeOnce === true) s.executeOnce = true
  if (r.alwaysOutputData === true) s.alwaysOutput = true
  if (str(r.notes).trim()) s.notes = str(r.notes).slice(0, 2000)
  return s
}

export function fromN8n(v: unknown): { nodes: FlowNode[]; connections: FlowConnections; warnings: string[] } {
  const raw = list(obj(v).nodes)
  const warnings: string[] = []
  const byName: Record<string, string> = {}
  const taken = new Set<string>()
  const swapped = new Set<string>() // Loop over items: n8n's first output is "done" and its second is "loop"; here it is the other way round
  const nodes: FlowNode[] = []
  const dropped: string[] = []
  raw.forEach((r, i) => {
    const type = str(r.type)
    const name = str(r.name, type)
    const made = convert(type, obj(r.parameters), name)
    const base = (made?.type ?? 'note').split('.')[1] ?? 'node'
    let k = i + 1
    while (taken.has(`${base}${k}`)) k++
    const id = `${base}${k}`
    taken.add(id)
    byName[name] = id
    const pos = Array.isArray(r.position) && r.position.length === 2 ? ([Number(r.position[0]) || 0, Number(r.position[1]) || 0] as [number, number]) : ([i * 200, 0] as [number, number])
    if (!made) {
      const sub = SUB.test(type)
      dropped.push(`${name} (${type.replace(/^.*\./, '')})`)
      nodes.push({ id, type: 'core.note', name: 'Not imported', position: pos, parameters: { text: `${sub ? 'Attached to an AI agent in n8n; set the agent’s model in its own settings.' : 'No counterpart in this app.'}\n${name} · ${type.replace(/^.*\./, '')}` } })
      return
    }
    if (made.type === 'core.loop') swapped.add(id)
    const settings = settingsOf(r)
    nodes.push({ id, type: made.type, name: made.type === 'core.note' ? 'Note' : name, position: pos, parameters: made.parameters, ...(r.disabled ? { disabled: true } : {}), ...(Object.keys(settings).length ? { settings } : {}) })
  })
  if (dropped.length) warnings.push(`Not imported (kept as notes): ${dropped.join(', ')}.`)
  if (nodes.some((n) => n.type === 'msg.telegram')) warnings.push('Telegram nodes need a bot: choose a credential in each one.')
  if (nodes.some((n) => n.type === 'trigger.schedule')) warnings.push('Schedule times were read as a daily time in Asia/Kolkata: check them.')

  const connections: FlowConnections = {}
  const notes = new Set(nodes.filter((n) => n.type === 'core.note').map((n) => n.id))
  for (const [srcName, v2] of Object.entries(obj(obj(v).connections))) {
    const src = byName[srcName]
    const main = obj(v2).main
    if (!src || !Array.isArray(main) || notes.has(src)) continue
    const lanes = (main as unknown[]).map((lane) => list(lane).filter((t) => byName[str(t.node)] && !notes.has(byName[str(t.node)]!)).map((t) => ({ node: byName[str(t.node)]!, index: Number(t.index) || 0 })))
    if (swapped.has(src) && lanes.length >= 2) [lanes[0], lanes[1]] = [lanes[1]!, lanes[0]!]
    connections[src] = { main: lanes }
  }
  return { nodes, connections, warnings }
}
