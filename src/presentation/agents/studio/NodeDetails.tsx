import { useEffect, useState } from 'react'
import { toast } from '@/presentation/notifications/toast'
import { AlertTriangle, ArrowLeftToLine, ArrowRightToLine, Pin, PinOff, Play, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { AgentFlow, FlowNode } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { FlowNodeForm } from '../FlowNodeForm'
import { iconOf, toneOf } from './StudioCanvas'
import type { Ran } from './StudioCanvas'

export interface Tried {
  outputs: Record<string, unknown>[][]
  itemsIn: number
  ms: number
  error?: string
}

const SENDS = ['msg.send', 'msg.ask', 'msg.mail']

/** A list of items as JSON, with how many there are: what n8n shows in its Input and Output panes. */
function DataPane({ title, icon, count, empty, error, children }: { title: string; icon: React.ReactNode; count?: number; empty: string; error?: string; children?: React.ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20">
      <h3 className="flex items-center gap-2 border-b bg-background px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {icon} {title}
        {count !== undefined && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] tracking-normal normal-case tabular-nums">{count} item{count === 1 ? '' : 's'}</span>}
      </h3>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {error && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {error}
          </p>
        )}
        {children ?? <p className="px-2 py-8 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
    </section>
  )
}

const Raw = ({ v }: { v: unknown }) => <pre className="rounded-lg border bg-background p-2.5 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre>

type View = 'schema' | 'table' | 'json'
const typeOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
const short = (v: unknown) => (typeof v === 'string' ? (v.length > 90 ? `${v.slice(0, 90)}…` : v) : JSON.stringify(v)?.slice(0, 90))

/** The shape of one item: each field with its type and an example, going into objects and lists a few levels. */
function Schema({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || typeof value !== 'object' || depth > 3) return <span className="font-mono text-[11px] break-all text-muted-foreground">{short(value)}</span>
  const entries = Array.isArray(value) ? value.slice(0, 3).map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>)
  return (
    <ul className={cn('grid gap-1', depth > 0 && 'mt-1 ml-3 border-l pl-3')}>
      {entries.map(([k, v]) => (
        <li key={k} className="text-xs">
          <span className="font-medium">{k}</span> <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{typeOf(v)}{Array.isArray(v) ? ` · ${v.length}` : ''}</span> {typeof v !== 'object' || v === null ? <Schema value={v} depth={depth + 1} /> : <Schema value={v} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

function Table({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 10)
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-2 py-1.5 font-medium text-muted-foreground">#</th>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1.5 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="px-2 py-1 text-muted-foreground tabular-nums">{i}</td>
              {cols.map((c) => (
                <td key={c} className="max-w-48 truncate px-2 py-1 font-mono" title={short(r[c])}>{short(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A list of items shown the way you choose: its shape (Schema), a Table, or the raw JSON, as n8n offers. */
function Items({ list }: { list: unknown }) {
  const [view, setView] = useState<View>('json')
  const rows = Array.isArray(list) && list.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x)) ? (list as Record<string, unknown>[]) : null
  return (
    <div className="grid gap-1.5">
      <div role="tablist" aria-label="How to show the items" className="flex w-fit gap-0.5 rounded-lg bg-muted p-0.5">
        {(['schema', 'table', 'json'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded-md px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors', view === v ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
            {v === 'json' ? 'JSON' : v}
          </button>
        ))}
      </div>
      {view === 'json' || !rows ? <Raw v={list} /> : view === 'table' ? <Table rows={rows} /> : rows.length === 0 ? <p className="text-xs text-muted-foreground">No items.</p> : <Schema value={rows[0]} />}
    </div>
  )
}

/** Mock data: items you type in as this node's output, so the rest of the workflow can be tried without running it (it is pinned). */
function MockData({ onSave }: { onSave: (items: Record<string, unknown>[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('[\n  { "title": "An example", "email": "someone@example.com" }\n]')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-orange-600 underline-offset-2 hover:underline">
        or set mock data
      </button>
    )
  }
  const save = () => {
    try {
      const v = JSON.parse(text) as unknown
      const list = Array.isArray(v) ? v : [v]
      if (list.length === 0 || list.length > 50 || list.some((x) => x === null || typeof x !== 'object' || Array.isArray(x))) throw new Error('A list of up to 50 objects.')
      onSave(list as Record<string, unknown>[])
      setOpen(false)
    } catch (e) {
      toast.error('That isn’t usable mock data', { description: e instanceof Error ? e.message : 'It must be JSON: an object, or a list of objects.' })
    }
  }
  return (
    <div className="grid w-full gap-2 text-left">
      <textarea aria-label="Mock data (JSON)" rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="w-full resize-y rounded-lg border border-input bg-background p-2 font-mono text-[11px] outline-none focus-visible:border-ring" />
      <div className="flex gap-2">
        <Button size="xs" onClick={save}>
          <Pin /> Save as pinned output
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

const lanesOf = (v: unknown): unknown[][] | null => (Array.isArray(v) && v.every(Array.isArray) ? (v as unknown[][]) : null)

/**
 * A node opened full screen, as in n8n: what goes in on the left, how it is set up in the middle, what comes out on the right. Run just this node
 * to see its output, pin that output to build the rest of the workflow with fixed data.
 */
export function NodeDetails({ node, flow, ran, feeding, tried, busy, canRun, confirm, readOnly, onConfirm, onChange, onParams, onRun, onExecutePrevious, onDelete, onClose }: { node: FlowNode; flow: AgentFlow; ran?: Ran; feeding: FlowNode[]; tried?: Tried; busy: boolean; canRun: boolean; confirm: boolean; readOnly?: boolean; onConfirm: (v: boolean) => void; onChange: (c: Partial<FlowNode>) => void; onParams: (v: Record<string, unknown>) => void; onRun: () => void; onExecutePrevious: () => void; onDelete: () => void; onClose: () => void }) {
  const Icon = iconOf(node.type)
  const sends = SENDS.includes(node.type)
  const [tab, setTab] = useState<'params' | 'settings'>('params')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLInputElement && e.target.value) && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // What goes in: this execution's items, else what the nodes before it have pinned.
  const pinnedIn = feeding.flatMap((f) => f.pinData ?? [])
  const inData: unknown = ran?.in ?? (pinnedIn.length ? pinnedIn : undefined)
  const inLanes = lanesOf(inData)
  const inCount = inLanes ? inLanes.flat().length : Array.isArray(inData) ? inData.length : inData === undefined ? undefined : 1

  // What comes out: this node on its own, else this execution.
  const outData: unknown = tried && !tried.error ? (tried.outputs.length === 1 ? tried.outputs[0] : tried.outputs) : (node.pinData ?? ran?.out)
  const outLanes = lanesOf(outData)
  const outCount = tried && !tried.error ? tried.outputs.flat().length : node.pinData ? node.pinData.length : ran?.outputs ? ran.outputs.reduce((a, b) => a + b, 0) : undefined
  const first = tried?.outputs[0] ?? []

  return (
    <div role="dialog" aria-modal="true" aria-label={`${node.name} details`} className="absolute inset-0 z-30 flex flex-col bg-background/80 p-0 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-hidden border bg-background shadow-2xl sm:rounded-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
            <Icon className={cn('size-5', toneOf(node.type))} strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            {readOnly ? <h2 className="truncate text-base font-semibold">{node.name}</h2> : <Input aria-label="Node name" value={node.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8 max-w-xs border-transparent px-1 text-base font-semibold shadow-none hover:border-input focus-visible:border-ring" />}
            <p className="truncate px-1 text-xs text-muted-foreground">{flow.catalog.find((c) => c.type === node.type)?.label ?? node.type} · {node.type}</p>
          </div>
          {!readOnly && (
            <>
              {sends && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" className="size-3.5 accent-[var(--foreground)]" checked={confirm} onChange={(e) => onConfirm(e.target.checked)} />
                  It sends or drafts something: I mean it
                </label>
              )}
              <Button size="sm" disabled={!canRun || busy || (sends && !confirm)} onClick={onRun} title={canRun ? undefined : 'Save first: it runs the saved workflow.'}>
                {busy ? <Spinner size="xs" tone="current" decorative /> : <Play />} Execute step
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete this node" onClick={onDelete}>
                <Trash2 />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto lg:flex-row lg:divide-x lg:divide-y-0 lg:overflow-hidden">
          <div className="flex min-h-48 flex-1 flex-col lg:max-w-[30%]">
            <DataPane title="Input" icon={<ArrowLeftToLine className="size-3.5" />} count={inCount} empty={node.type.startsWith('trigger.') ? 'A trigger has nothing coming in: it starts the workflow.' : 'Nothing yet. Execute the workflow, or pin the output of the node before this one.'}>
              {inData === undefined ? (node.type.startsWith('trigger.') || readOnly ? undefined : (
                <div className="grid justify-items-center gap-3 px-2 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No input data yet.</p>
                  <Button size="sm" variant="outline" disabled={!canRun || busy} onClick={onExecutePrevious}>
                    <Play /> Execute previous nodes
                  </Button>
                  <p className="text-xs text-muted-foreground">to see what arrives here. This runs the whole saved workflow once.</p>
                </div>
              )) : inLanes ? inLanes.map((l, i) => <div key={i} className="mb-2"><p className="mb-1 text-[11px] text-muted-foreground">Input {i + 1}</p><Items list={l} /></div>) : <Items list={Array.isArray(inData) ? inData : [inData]} />}
            </DataPane>
          </div>

          <section className="flex min-h-72 min-w-0 flex-[1.4] flex-col bg-background">
            <div role="tablist" className="flex gap-1 border-b px-3">
              {(['params', 'settings'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors', tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  {t === 'params' ? 'Parameters' : 'Settings'}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {tab === 'params' ? (
                readOnly ? (
                  <pre className="rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(node.parameters, null, 2)}</pre>
                ) : (
                  <FlowNodeForm node={node} flow={flow} set={onParams} />
                )
              ) : (
                <div className="grid gap-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" disabled={readOnly} className="mt-1 size-4 accent-[var(--foreground)]" checked={!!node.disabled} onChange={(e) => onChange({ disabled: e.target.checked || undefined })} />
                    <span>
                      Deactivate
                      <span className="block text-xs text-muted-foreground">The node is skipped and its items pass straight through.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" disabled={readOnly} className="mt-1 size-4 accent-[var(--foreground)]" checked={!!node.parameters.runWhenEmpty} onChange={(e) => onParams({ runWhenEmpty: e.target.checked || undefined })} />
                    <span>
                      Run when nothing arrives
                      <span className="block text-xs text-muted-foreground">Run even with no items, so “found nobody” can still be answered.</span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </section>

          <div className="flex min-h-48 flex-1 flex-col lg:max-w-[30%]">
            <DataPane
              title="Output"
              icon={<ArrowRightToLine className="size-3.5" />}
              count={outCount}
              error={tried?.error ?? ran?.error}
              empty={readOnly ? 'This node did not run in this execution.' : 'Press “Execute step” to run just this node and see what it gives.'}
            >
              {outData === undefined ? (readOnly ? undefined : (
                <div className="grid justify-items-center gap-3 px-2 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No output data yet.</p>
                  <Button size="sm" variant="outline" disabled={!canRun || busy || (sends && !confirm)} onClick={onRun}>
                    <Play /> Execute step
                  </Button>
                  <MockData onSave={(items) => onChange({ pinData: items })} />
                </div>
              )) : (
                <>
                  {!readOnly && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {node.pinData ? (
                        <>
                          <span className="flex items-center gap-1 text-xs text-warning">
                            <Pin className="size-3.5" /> Pinned: used when you execute by hand
                          </span>
                          <Button size="xs" variant="ghost" onClick={() => onChange({ pinData: undefined })}>
                            <PinOff /> Unpin
                          </Button>
                        </>
                      ) : (
                        first.length > 0 && (
                          <Button size="xs" variant="outline" onClick={() => onChange({ pinData: first })}>
                            <Pin /> Pin output
                          </Button>
                        )
                      )}
                    </div>
                  )}
                  {outLanes ? outLanes.map((l, i) => <div key={i} className="mb-2"><p className="mb-1 text-[11px] text-muted-foreground">Output {i + 1}{lanesLabel(node, i)}</p><Items list={l} /></div>) : <Items list={Array.isArray(outData) ? outData : [outData]} />}
                </>
              )}
            </DataPane>
          </div>
        </div>
      </div>
    </div>
  )
}

const lanesLabel = (node: FlowNode, i: number) => (node.type === 'core.if' ? ` (${i === 0 ? 'true' : 'false'})` : '')
