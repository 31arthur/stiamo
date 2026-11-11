import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AgentFlow, FlowNode } from '@/domain/ai/AgentApi'
import type { AiSelection } from '@/domain/ai/types'
import { ModelChoice } from './ModelPicker'
import { CredentialModal } from './studio/CredentialModal'
import { useChannels } from './useAgent'
import { useState } from 'react'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const OPS: [string, string][] = [
  ['contains', 'contains'],
  ['not_contains', 'doesn’t contain'],
  ['equals', 'is'],
  ['not_equals', 'is not'],
  ['starts_with', 'starts with'],
  ['matches', 'matches (pattern)'],
  ['empty', 'is empty'],
  ['not_empty', 'isn’t empty'],
  ['gt', 'is more than'],
  ['lt', 'is less than'],
]

interface Cond {
  left?: string
  op?: string
  right?: string
}
interface Field {
  name?: string
  value?: string
}

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
    {label}
    {children}
    {hint && <span className="text-[11px] font-normal">{hint}</span>}
  </label>
)

const Check = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={on} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
)

/** One condition: a value (an expression), how to compare it, and what to compare it with. */
function CondRow({ c, onChange, onRemove }: { c: Cond; onChange: (c: Cond) => void; onRemove?: () => void }) {
  const noRight = c.op === 'empty' || c.op === 'not_empty'
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
      <Input aria-label="Value" value={c.left ?? ''} onChange={(e) => onChange({ ...c, left: e.target.value })} className="h-8 w-44 font-mono text-xs" placeholder="{{ $json.title }}" />
      <select aria-label="Comparison" className={SELECT} value={c.op ?? 'contains'} onChange={(e) => onChange({ ...c, op: e.target.value })}>
        {OPS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {!noRight && <Input aria-label="Compared with" value={c.right ?? ''} onChange={(e) => onChange({ ...c, right: e.target.value })} className="h-8 w-36" />}
      {onRemove && (
        <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={onRemove}>
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

function Conditions({ list, onChange, min = 1 }: { list: Cond[]; onChange: (l: Cond[]) => void; min?: number }) {
  return (
    <div className="grid gap-1.5">
      {list.map((c, i) => (
        <CondRow key={i} c={c} onChange={(x) => onChange(list.map((y, j) => (j === i ? x : y)))} onRemove={list.length > min ? () => onChange(list.filter((_, j) => j !== i)) : undefined} />
      ))}
      <Button variant="outline" size="xs" className="w-fit" onClick={() => onChange([...list, { left: '{{ $json.title }}', op: 'contains', right: '' }])}>
        <Plus /> Add
      </Button>
    </div>
  )
}

/** The settings of one node, by its type. `set` merges a change into the node's parameters. */
export function FlowNodeForm({ node, flow, set }: { node: FlowNode; flow: AgentFlow; set: (patch: Record<string, unknown>) => void }) {
  const p = node.parameters
  const text = (key: string, label: string, hint?: string, placeholder?: string) => (
    <Row label={label} hint={hint}>
      <Input value={String(p[key] ?? '')} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} className="font-mono text-xs" />
    </Row>
  )
  const num = (key: string, label: string, min = 1, max = 500) => (
    <Row label={label}>
      <Input type="number" min={min} max={max} className="w-28" value={String(p[key] ?? '')} onChange={(e) => set({ [key]: e.target.value ? Number(e.target.value) : undefined })} />
    </Row>
  )
  const status = (opts: [string, string][]) => (
    <Row label="Which">
      <select className={`${SELECT} w-fit`} value={String(p.status ?? opts[0]![0])} onChange={(e) => set({ status: e.target.value })}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Row>
  )
  const OPEN: [string, string][] = [['open', 'Open ones'], ['all', 'All of them']]

  switch (node.type) {
    case 'trigger.chat':
      return <p className="text-sm text-muted-foreground">Starts the workflow when a message comes in: from the app’s chat, Telegram or WhatsApp. Its item has <code>message</code>, <code>asked</code> (with the conversation so far) and <code>workspace</code>.</p>
    case 'trigger.telegram':
      return <p className="text-sm text-muted-foreground">Starts the workflow when a message arrives on a Telegram bot linked to this agent. Its item has <code>message</code>, <code>asked</code>, <code>workspace</code> and <code>source</code>. A workflow without this trigger answers Telegram from its “When a message comes in” trigger.</p>
    case 'trigger.orchestrator':
      return <p className="text-sm text-muted-foreground">Starts the workflow when the master assistant hands it a message: it chose this agent for the job. Its item has <code>message</code>, <code>asked</code> (with what the conversation has established), <code>workspace</code> and <code>source</code> (“orchestrator”). A workflow without this trigger answers from its “When a message comes in” trigger.</p>
    case 'trigger.manual':
      return <p className="text-sm text-muted-foreground">Starts the workflow when you press Run.</p>
    case 'trigger.schedule':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Starts the workflow at this time every day. Its item has <code>day</code> (tomorrow).</p>
          <Row label="At">
            <Input type="time" className="w-36" value={String(p.time ?? '07:30')} onChange={(e) => set({ time: e.target.value })} />
          </Row>
          <Row label="Time zone">
            <Input className="w-56" value={String(p.timezone ?? 'Asia/Kolkata')} onChange={(e) => set({ timezone: e.target.value })} />
          </Row>
          <div className="grid gap-1.5" role="group" aria-label="Days">
            <span className="text-xs font-medium text-muted-foreground">On these days{Array.isArray(p.days) && p.days.length === 0 ? ' · none ticked: it never runs' : ''}</span>
            <div className="flex flex-wrap gap-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
                const days = (Array.isArray(p.days) ? (p.days as number[]) : [0, 1, 2, 3, 4, 5, 6])
                const on = days.includes(i)
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => set({ days: on ? days.filter((x) => x !== i) : [...days, i].sort() })} className={`rounded-lg border px-2.5 py-1 text-xs ${on ? 'border-foreground bg-muted font-medium' : 'text-muted-foreground'}`}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )
    case 'core.if':
    case 'core.filter':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{node.type === 'core.if' ? 'Each item goes out of “true” or “false”.' : 'Only the items that match go on.'}</p>
          <Row label="Match">
            <select className={`${SELECT} w-fit`} value={String(p.combine ?? 'all')} onChange={(e) => set({ combine: e.target.value })}>
              <option value="all">all of these</option>
              <option value="any">any of these</option>
            </select>
          </Row>
          <Conditions list={(p.conditions as Cond[] | undefined) ?? []} onChange={(conditions) => set({ conditions })} />
        </div>
      )
    case 'core.switch':
      return (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Each item goes out of the first rule it matches, else the fallback. Each rule is an output on the node.</p>
          <Conditions list={(p.rules as Cond[] | undefined) ?? []} onChange={(rules) => set({ rules })} />
        </div>
      )
    case 'core.set': {
      const fields = (p.fields as Field[] | undefined) ?? []
      return (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Sets fields on each item. Values can use expressions.</p>
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input aria-label="Name" className="h-8 w-32" value={f.name ?? ''} onChange={(e) => set({ fields: fields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <span className="text-muted-foreground">=</span>
              <Input aria-label="Value" className="h-8 min-w-0 flex-1 font-mono text-xs" value={f.value ?? ''} onChange={(e) => set({ fields: fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => set({ fields: fields.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="xs" className="w-fit" onClick={() => set({ fields: [...fields, { name: 'field', value: '' }] })}>
            <Plus /> Add a field
          </Button>
          <Check label="Keep the item’s other fields" on={p.keepOthers !== false} onChange={(v) => set({ keepOthers: v })} />
          <Check label="Also store each as a variable ({{ $vars.name }})" on={!!p.asVariable} onChange={(v) => set({ asVariable: v || undefined })} />
        </div>
      )
    }
    case 'core.sort':
      return (
        <div className="grid gap-3">
          {text('field', 'Field to sort by')}
          <Row label="Order">
            <select className={`${SELECT} w-fit`} value={String(p.order ?? 'asc')} onChange={(e) => set({ order: e.target.value })}>
              <option value="asc">A to Z, oldest first</option>
              <option value="desc">Z to A, newest first</option>
            </select>
          </Row>
        </div>
      )
    case 'core.limit':
      return num('max', 'Keep the first', 1, 200)
    case 'core.loop':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Works through the items in batches. Connect “loop” to what happens to each batch and bring that back into this node; “done” gives everything at the end.</p>
          {num('batchSize', 'Items per batch', 1, 50)}
        </div>
      )
    case 'core.split_out':
      return text('field', 'Field holding the list', 'One item is made for each entry in it.')
    case 'core.aggregate':
      return text('field', 'Field to collect', 'Leave empty to collect whole items. The result has the list and a count.')
    case 'core.stop':
      return text('message', 'Error message')
    case 'core.note':
      return (
        <Row label="Note">
          <textarea rows={4} className={AREA} value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} />
        </Row>
      )
    case 'core.merge':
      return <p className="text-sm text-muted-foreground">Waits until both inputs have items, then passes them all on together.</p>
    case 'core.noop':
      return <p className="text-sm text-muted-foreground">Passes items on unchanged.</p>
    case 'data.mail':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Recent messages from this workspace’s mailboxes. Each item has <code>subject</code>, <code>from</code>, <code>fromAddress</code>, <code>date</code>, <code>snippet</code>.</p>
          {num('days', 'Days back', 1, 60)}
          {num('limit', 'Most messages', 1, 100)}
          {text('query', 'Only those containing', 'A word in the subject, sender or start of the message.')}
        </div>
      )
    case 'data.mail_body':
      return <p className="text-sm text-muted-foreground">Adds the full <code>text</code> of each message (up to ten) to its item. Put it after Read mail.</p>
    case 'data.contacts':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">People from this workspace’s Google contacts: <code>name</code>, <code>phone</code>, <code>email</code>, <code>organisation</code>.</p>
          {text('query', 'Name contains')}
          {num('limit', 'Most people', 1, 100)}
        </div>
      )
    case 'data.tasks':
    case 'data.follow_ups':
      return (
        <div className="grid gap-3">
          {status(OPEN)}
          <Check label="Only overdue ones" on={!!p.overdue} onChange={(v) => set({ overdue: v })} />
          {text('dueOn', 'Due on', 'A day, like {{ $json.day }} or 2026-11-12. Empty: any day.')}
          {num('limit', 'Most items', 1, 200)}
        </div>
      )
    case 'data.meetings':
    case 'data.hearings':
      return (
        <div className="grid gap-3">
          {status(OPEN)}
          {text('on', 'On', 'A day. Empty: any day.')}
          {num('limit', 'Most items', 1, 200)}
        </div>
      )
    case 'data.cases':
      return (
        <div className="grid gap-3">
          {status([['active', 'Active'], ['all', 'All']])}
          {num('limit', 'Most items', 1, 200)}
        </div>
      )
    case 'data.calendar':
      return (
        <div className="grid gap-3">
          {text('from', 'From day', 'Empty: today.')}
          {text('to', 'To day', 'Empty: the day after.')}
          {num('limit', 'Most events', 1, 200)}
        </div>
      )
    case 'data.drive':
      return (
        <div className="grid gap-3">
          {text('query', 'Search for')}
          {num('limit', 'Most documents', 1, 50)}
        </div>
      )
    case 'msg.send':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Sends text to your phone: the master bot on Telegram (or that workspace’s own bot).</p>
          <Row label="Text">
            <textarea rows={3} className={AREA} value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} />
          </Row>
          <Check label="Send one message, however many items come in" on={p.once !== false} onChange={(v) => set({ once: v })} />
        </div>
      )
    case 'msg.telegram':
      return <TelegramFields p={p} set={set} />
    case 'ai.classify':
      return <ClassifyFields p={p} set={set} />
    case 'core.safe_senders': {
      const lines = (key: string, label: string, hint: string, placeholder: string) => (
        <Row label={label} hint={hint}>
          <textarea rows={3} className={AREA} placeholder={placeholder} value={((p[key] as string[] | undefined) ?? []).join('\n')} onChange={(e) => set({ [key]: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
        </Row>
      )
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Keeps mail from people you trust out of the judging. The first output carries on with the rest; the second is what was kept, with <code>kept</code> saying why.</p>
          <Check label="Keep mail from anyone I have written to (the addresses in the Sent folder)" on={p.correspondents !== false} onChange={(v) => set({ correspondents: v })} />
          {lines('domains', 'Domains', 'One a line. A domain and its subdomains.', 'court.gov.in')}
          {lines('addresses', 'Addresses', 'One a line.', 'someone@example.com')}
          {lines('phrases', 'Words or phrases', 'One a line. Whole words, in the sender, subject or start of the text.', 'hearing')}
        </div>
      )
    }
    case 'ai.read':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Opens each email in full (up to 10) and adds <code>summary</code>, <code>priority</code>, <code>action</code>, <code>due</code> and, for events, <code>event</code>.</p>
          <Row label="What matters" hint="Tells it what to look for, in your words.">
            <textarea rows={3} className={AREA} value={String(p.prompt ?? '')} onChange={(e) => set({ prompt: e.target.value })} />
          </Row>
          <Row label="What for">
            <select aria-label="What for" className={SELECT} value={String(p.route ?? 'attention')} onChange={(e) => set({ route: e.target.value })}>
              <option value="attention">Something I should look at</option>
              <option value="event">Find an event to put in the calendar</option>
              <option value="alert">Something to alert me about (with replies to choose from)</option>
            </select>
          </Row>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Model</span>
            <ModelChoice value={(p.model as AiSelection | null | undefined) ?? null} onChange={(s) => set({ model: s })} />
            <div>
              <Button variant="ghost" size="xs" disabled={!p.model} onClick={() => set({ model: undefined })}>
                Use the agent’s own model
              </Button>
            </div>
          </div>
        </div>
      )
    case 'msg.trash':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Moves the emails that arrive here to Trash. They are never deleted. By default it <b>asks first</b>: one card for all of them, to approve in Needs me or with YES.</p>
          {text('folder', 'Folder they are in', undefined, 'INBOX')}
          <Check label="Move at once, without asking (only when the workflow runs by itself; run by hand it still asks)" on={!!p.auto} onChange={(v) => set({ auto: v })} />
          <Check label="Tell me on my phone when there is something to approve" on={p.tell !== false} onChange={(v) => set({ tell: v })} />
        </div>
      )
    case 'core.only_new':
      return <p className="text-sm text-muted-foreground">Lets through only the emails this agent has not handled in an earlier run, so each is judged once. It remembers them when the whole run has gone well, so a run that fails leaves them to try again. <b>Run by hand</b>, everything goes through and nothing is remembered: trying a workflow never uses mail up. Put it right after <b>Mail</b>.</p>
    case 'msg.attention':
      return <p className="text-sm text-muted-foreground">Puts each email in your <b>Attention</b> queue with its summary, priority and what to do (an email that names an event shows it, to approve). One already there, or already dealt with, is left alone. It needs the output of <b>Read and summarise</b>.</p>
    case 'msg.alert':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Pings your phone about each email (up to five) with its summary and a few replies to choose from. An email is only ever raised once. It needs the output of <b>Read and summarise</b>.</p>
          <Check label="Also ring me on Telegram" on={!!p.call} onChange={(v) => set({ call: v })} />
        </div>
      )
    case 'msg.event':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Puts the event an email names (found by <b>Read and summarise</b> set to find events) in front of you to approve. Nothing reaches the calendar until you do.</p>
          {text('workspace', 'Workspace of the event', 'Empty: the workspace this runs in.', 'sb')}
          <Check label="Tell me on my phone when there is something to approve" on={p.tell !== false} onChange={(v) => set({ tell: v })} />
        </div>
      )
    case 'msg.mail':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Writes an email and keeps it for you to approve. <b>Nothing is sent</b> until you approve it (in Needs me, or YES on your phone). It is sent from this workspace’s mailbox.</p>
          {text('to', 'To', 'An address, or an expression like {{ $json.email }}. Several: separate with commas.')}
          {text('subject', 'Subject')}
          <Row label="Text" hint="An expression, so it can use what the earlier nodes found.">
            <textarea rows={5} className={AREA} value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} />
          </Row>
          <Check label="Tell me on my phone when a draft is ready" on={p.tell !== false} onChange={(v) => set({ tell: v })} />
        </div>
      )
    case 'msg.ask': {
      const options = (p.options as string[] | undefined) ?? []
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Asks you on your phone and waits. The workflow stops here, and the button you press carries on from that answer’s output (the answer is <code>{'{{ $json.answer }}'}</code>). A question is good for two days.</p>
          <Row label="Question" hint="An expression, so it can use what the earlier nodes found.">
            <textarea rows={3} className={AREA} value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} />
          </Row>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Buttons (two to four). Each is an output you can connect.</span>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input aria-label={`Button ${i + 1}`} className="h-8 w-48" value={o} onChange={(e) => set({ options: options.map((x, j) => (j === i ? e.target.value : x)) })} />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon-xs" aria-label="Remove this button" onClick={() => set({ options: options.filter((_, j) => j !== i) })}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <Button variant="outline" size="xs" className="w-fit" onClick={() => set({ options: [...options, `Answer ${options.length + 1}`] })}>
                <Plus /> Add a button
              </Button>
            )}
          </div>
        </div>
      )
    }
    case 'ai.agent': {
      const tools = p.tools as string[] | undefined
      const on = (name: string) => (tools ? tools.includes(name) : flow.tools.find((t) => t.name === name)?.enabled !== false)
      const flip = (name: string) => {
        const base = tools ?? flow.tools.filter((t) => t.enabled).map((t) => t.name)
        set({ tools: base.includes(name) ? base.filter((x) => x !== name) : [...base, name] })
      }
      return (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">A model that reads, calls the tools you give it, and answers. Its answer is <code>text</code> in the item it gives.</p>
          <div className="grid gap-2 rounded-xl border p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5 text-violet-600" /> Chat model
            </span>
            <p className="text-[11px] text-muted-foreground">{p.model ? 'This node thinks with its own model, so one workflow can use a quick one here and a careful one elsewhere.' : 'Following the agent’s model (Settings). Choose one here to give just this node its own.'}</p>
            <ModelChoice value={(p.model as AiSelection | null | undefined) ?? null} onChange={(s) => set({ model: s })} />
            <div>
              <Button variant="ghost" size="xs" disabled={!p.model} onClick={() => set({ model: undefined })}>
                Use the agent’s own model
              </Button>
            </div>
          </div>
          <Row label="What it is asked" hint="An expression: {{ $json.asked }} is the message with the conversation so far; {{ $json.text }} the previous AI node’s answer.">
            <textarea rows={3} className={AREA} value={String(p.prompt ?? '{{ $json.asked }}')} onChange={(e) => set({ prompt: e.target.value })} />
          </Row>
          <Row label="Instructions" hint="Empty: the agent’s saved prompt (Settings).">
            <textarea rows={4} className={AREA} value={String(p.system ?? '')} placeholder={flow.defaults.system.slice(0, 140) + '…'} onChange={(e) => set({ system: e.target.value || undefined })} />
          </Row>
          {num('maxSteps', 'Most tool calls', 1, 20)}
          <Check label="Knows the conversation so far" on={p.history !== false} onChange={(v) => set({ history: v ? undefined : false })} />
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tools it may call{tools ? ` · ${tools.length} of ${flow.tools.length}` : ' · all that are on'}</span>
            <ul className="flex flex-wrap gap-1.5">
              {flow.tools.map((t) => (
                <li key={t.name}>
                  <button type="button" aria-pressed={on(t.name)} title={t.description} onClick={() => flip(t.name)} className={`rounded-lg border px-2 py-1 font-mono text-[11px] ${on(t.name) ? 'border-foreground bg-muted' : 'text-muted-foreground line-through'}`}>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" onClick={() => set({ tools: [] })}>
                No tools
              </Button>
              {tools && (
                <Button variant="ghost" size="xs" onClick={() => set({ tools: undefined })}>
                  All that are on
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }
    case 'respond':
      return (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Ends the run with this as the answer.</p>
          <Row label="Answer" hint="An expression. Leave the default to give the AI agent’s text.">
            <textarea rows={3} className={AREA} value={String(p.text ?? '{{ $json.text }}')} onChange={(e) => set({ text: e.target.value })} />
          </Row>
        </div>
      )
    default:
      return null
  }
}


const NEW = '__new__'

/** The Telegram node: which bot to send with (its credential, made right here if there is none yet), to which chat, and what to say. */
function TelegramFields({ p, set }: { p: Record<string, unknown>; set: (patch: Record<string, unknown>) => void }) {
  const { channels } = useChannels()
  const [making, setMaking] = useState(false)
  const bots = channels.filter((c) => c.kind === 'telegram')
  const bot = bots.find((c) => c.id === p.credential)
  const chats = bot?.paired ?? []
  const label = (c: (typeof bots)[number]) => `@${c.username ?? 'bot'} · ${c.workspace ? `${c.workspace} only` : 'all workspaces'}${c.paired?.length ? '' : ' (no chat linked yet)'}`
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Sends a message with one of your Telegram bots. A bot limited to a workspace is only used by that workspace’s workflows.</p>
      <Row label="Credential to connect with" hint={p.credential && !bot ? 'That bot is no longer connected. Choose another.' : undefined}>
        <select
          aria-label="Credential to connect with"
          className={SELECT}
          value={bot ? bot.id : ''}
          onChange={(e) => (e.target.value === NEW ? setMaking(true) : set({ credential: e.target.value, chat: '' }))}
        >
          <option value="">Select a credential…</option>
          {bots.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c)}
            </option>
          ))}
          <option value={NEW}>+ Create new credential</option>
        </select>
      </Row>
      <Row label="Chat" hint="Left on all, it goes to every chat linked to the bot (that is just you, unless you linked more).">
        <select aria-label="Chat" className={SELECT} value={String(p.chat ?? '')} disabled={!bot} onChange={(e) => set({ chat: e.target.value })}>
          <option value="">All linked chats</option>
          {chats.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.name || `Chat ${c.id}`}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Text" hint="An expression, so it can use what the earlier nodes found.">
        <textarea rows={4} className={AREA} value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} />
      </Row>
      <Check label="Send one message, however many items come in" on={p.once !== false} onChange={(v) => set({ once: v })} />
      <CredentialModal open={making} onOpenChange={setMaking} kind="telegram" onCreated={(id) => set({ credential: id, chat: '' })} />
    </div>
  )
}


interface LabelRow {
  name?: string
  description?: string
  threshold?: number | ''
}

/** Sort into labels: what the sorting is for, the labels (what each means is what the model reads), how sure it must be, and which model decides. */
function ClassifyFields({ p, set }: { p: Record<string, unknown>; set: (patch: Record<string, unknown>) => void }) {
  const labels = (p.labels as LabelRow[] | undefined) ?? []
  const change = (i: number, v: Partial<LabelRow>) => set({ labels: labels.map((l, j) => (j === i ? { ...l, ...v } : l)) })
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '').slice(0, 40)
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Reads each item (up to 50) and gives it one label, with <code>confidence</code> and <code>reason</code>. There is one output for each label, and the last is for what it isn’t sure about.</p>
      <Row label="What the sorting is for" hint="Tells the model the purpose, in your words.">
        <textarea rows={3} className={AREA} value={String(p.prompt ?? '')} onChange={(e) => set({ prompt: e.target.value })} />
      </Row>
      <div className="grid gap-2">
        <span className="text-xs font-medium text-muted-foreground">Labels · what each one means is what the model reads to choose</span>
        {labels.map((l, i) => (
          <div key={i} className="grid gap-1.5 rounded-lg border p-2">
            <div className="flex items-center gap-1.5">
              <Input aria-label="Label name" value={l.name ?? ''} onChange={(e) => change(i, { name: slug(e.target.value) })} className="h-8 w-40 font-mono text-xs" placeholder="spam" />
              <Input aria-label="Sure enough at" type="number" min={0} max={1} step={0.05} value={l.threshold ?? ''} onChange={(e) => change(i, { threshold: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8 w-24 text-xs" placeholder={`≥ ${String(p.threshold ?? 0.7)}`} title="How sure it must be to use this label; under it, the item goes to “not sure”" />
              {labels.length > 2 && (
                <Button variant="ghost" size="icon-xs" aria-label="Remove this label" className="ml-auto" onClick={() => set({ labels: labels.filter((_, j) => j !== i) })}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <textarea aria-label="What it means" rows={2} className={AREA} value={l.description ?? ''} onChange={(e) => change(i, { description: e.target.value })} placeholder="What a mail with this label is like, in things anyone could see." />
          </div>
        ))}
        {labels.length < 12 && (
          <Button variant="outline" size="xs" className="w-fit" onClick={() => set({ labels: [...labels, { name: '', description: '' }] })}>
            <Plus /> Add a label
          </Button>
        )}
      </div>
      <Row label="Sure enough at" hint="The least confidence a label needs. Under it, the item goes to “not sure” so you can look.">
        <Input type="number" min={0} max={1} step={0.05} value={String(p.threshold ?? 0.7)} onChange={(e) => set({ threshold: Number(e.target.value) })} className="h-8 w-24" />
      </Row>
      <Row label="Who decides">
        <select aria-label="Who decides" className={SELECT} value={String(p.decider ?? 'model')} onChange={(e) => set({ decider: e.target.value })}>
          <option value="model">A chat model (the one below, or the agent’s)</option>
          <option value="jev">The decision model (Jev, through OpenRouter)</option>
        </select>
      </Row>
      {p.decider !== 'jev' && (
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Model</span>
          <ModelChoice value={(p.model as AiSelection | null | undefined) ?? null} onChange={(s) => set({ model: s })} />
          <div>
            <Button variant="ghost" size="xs" disabled={!p.model} onClick={() => set({ model: undefined })}>
              Use the agent’s own model
            </Button>
          </div>
        </div>
      )}
      <Row label="Items to ask about at once" hint="More at once costs less; 1 asks about each on its own.">
        <Input type="number" min={1} max={50} value={String(p.batchSize ?? 1)} onChange={(e) => set({ batchSize: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} className="h-8 w-24" />
      </Row>
    </div>
  )
}
