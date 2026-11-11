import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Cpu, FileText, GitBranch, MessageSquare, Plus, Repeat, Save, Shield, Tag, Trash2, Undo2, X, Zap } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { GraphEdge, GraphNode, NodeType } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { Link } from '@/presentation/routing'
import { NodeForm } from './NodeForms'
import { ago, formatMs, triggerLabel } from './format'
import { NODE_H, NODE_W, TYPE_LABEL, edgePath, fresh, labelsFor, layout } from './workflowLayout'
import { traceOf } from './workflowTrace'
import type { NodeTrace } from './workflowTrace'

const ICON: Record<NodeType, typeof Zap> = { trigger: Zap, scope: Shield, prompt: FileText, agent: Cpu, branch: GitBranch, set: Tag, loop: Repeat, output: MessageSquare }
const DOT = { ok: 'bg-success', error: 'bg-destructive', skipped: 'bg-muted-foreground/30' } as const
const NONE: GraphNode[] = []
const ADDABLE: NodeType[] = ['scope', 'prompt', 'agent', 'branch', 'set', 'loop', 'output']

interface Draft {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * An agent as a workflow you can edit: nodes on a canvas joined by edges, a form for each node, and every execution laid over it node by node.
 * Saving keeps only a workflow that can run; the agent uses it from its next run on.
 */
export function WorkflowTab() {
  const { agentId } = useParams()
  const { agent } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const graph = useQuery({ queryKey: ['agent', 'graph', userId, agentId], queryFn: () => agent.agentGraph(agentId!), enabled: !!agentId, retry: false })
  const runs = useQuery({ queryKey: ['agent', 'runs', userId, agentId, 'recent'], queryFn: () => agent.runs(agentId!), enabled: !!agentId, retry: false, refetchInterval: 15_000 })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selected, setSelected] = useState('agent')
  const [runId, setRunId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const run = useQuery({ queryKey: ['agent', 'run', userId, runId], queryFn: () => agent.run(runId!), enabled: !!runId, retry: false })

  // The draft starts from what is saved, and starts again whenever what is saved changes (after a save or a reset).
  const key = graph.data ? JSON.stringify([graph.data.nodes, graph.data.edges]) : ''
  useEffect(() => {
    if (graph.data) setDraft({ nodes: graph.data.nodes, edges: graph.data.edges })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!draft && key !== JSON.stringify([draft.nodes, draft.edges])
  const deferred = useDeferredValue(draft)
  const check = useQuery({ queryKey: ['agent', 'graph-check', userId, agentId, JSON.stringify(deferred)], queryFn: () => agent.checkAgentGraph(agentId!, deferred!), enabled: !!deferred && dirty, retry: false })
  const problems = dirty ? (check.data ?? []) : (graph.data?.problems ?? [])

  const nodes = draft?.nodes ?? NONE
  const trace = useMemo(() => (run.data ? traceOf(nodes.map((n) => n.id), run.data.trace) : null), [run.data, nodes])
  const { placed, width, height } = useMemo(() => layout(nodes, draft?.edges ?? []), [nodes, draft?.edges])

  if (graph.isLoading || !draft) return graph.isLoading ? <Spinner label="Loading the workflow" /> : <p role="alert" className="text-sm text-destructive">{graph.error instanceof Error ? graph.error.message : 'Couldn’t load the workflow.'}</p>
  const g = graph.data!
  const node = nodes.find((n) => n.id === selected) ?? nodes[0]!
  const at = new Map(placed.map((p) => [p.node.id, p]))
  const update = (next: Draft) => setDraft(next)
  const patchNode = (id: string, change: Partial<GraphNode> | { config: Record<string, unknown> }) => update({ ...draft, nodes: nodes.map((n) => (n.id === id ? { ...n, ...change } : n)) })
  const setConfig = (patch: Record<string, unknown>) => {
    const config = { ...node.config, ...patch }
    for (const k of Object.keys(config)) if (config[k] === undefined) delete config[k]
    patchNode(node.id, { config })
  }
  const add = (type: NodeType) => {
    const n = fresh(type, nodes.map((x) => x.id))
    update({ ...draft, nodes: [...nodes, n] })
    setSelected(n.id)
  }
  const remove = (id: string) => {
    update({ nodes: nodes.filter((n) => n.id !== id), edges: draft.edges.filter((e) => e.from !== id && e.to !== id) })
    setSelected('agent')
  }

  async function save() {
    setSaving(true)
    try {
      await agent.saveAgentGraph(agentId!, draft!)
      await client.invalidateQueries({ queryKey: ['agent', 'graph'] })
      toast.success('Saved. The agent uses this workflow from its next run.')
    } catch (e) {
      toast.error('Couldn’t save it', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }
  async function reset() {
    setSaving(true)
    try {
      await agent.resetAgentGraph(agentId!)
      await client.invalidateQueries({ queryKey: ['agent', 'graph'] })
      toast.success('Back to the default workflow')
    } catch (e) {
      toast.error('Couldn’t reset it', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-4">
        <Section
          title="Workflow"
          description={trace ? 'This is one execution: each node shows what it did. Open a node to see what went through it.' : g.custom ? 'This agent runs a workflow you changed.' : 'The default workflow. Add nodes and connect them to change how this agent works.'}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <select aria-label="Add a node" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" value="" onChange={(e) => e.target.value && add(e.target.value as NodeType)}>
                <option value="">+ Add a node…</option>
                {ADDABLE.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => void save()} disabled={!dirty || saving || problems.length > 0}>
                {saving ? <Spinner size="xs" tone="current" decorative /> : <Save />} Save
              </Button>
              {dirty && (
                <Button size="sm" variant="ghost" onClick={() => setDraft({ nodes: g.nodes, edges: g.edges })}>
                  <Undo2 /> Discard
                </Button>
              )}
              {g.custom && !dirty && (
                <Button size="sm" variant="ghost" onClick={() => void reset()} disabled={saving}>
                  Back to default
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-3">
            {problems.length > 0 && (
              <ul role="alert" className="grid gap-1 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                {problems.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" /> {p}
                  </li>
                ))}
              </ul>
            )}
            <div className="overflow-x-auto rounded-xl border bg-muted/20 p-4">
              <div className="relative" style={{ width: width + 8, height: height + 40, marginTop: 24 }}>
                <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width + 8} height={height + 40} aria-hidden>
                  <defs>
                    <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground/70" />
                    </marker>
                  </defs>
                  {draft.edges.map((e, i) => {
                    const a = at.get(e.from)
                    const b = at.get(e.to)
                    if (!a || !b) return null
                    const p = edgePath(a, b)
                    return (
                      <g key={`${e.from}-${e.to}-${e.label}-${i}`}>
                        <path d={p.d} fill="none" className="stroke-muted-foreground/60" strokeWidth={1.5} markerEnd="url(#arrow)" />
                        {e.label !== 'next' && (
                          <text x={p.lx} y={p.ly} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                            {e.label}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
                {placed.map((p) => (
                  <NodeCard key={p.node.id} node={p.node} style={{ left: p.x, top: p.y }} active={selected === p.node.id} trace={trace?.[p.node.id]} onOpen={() => setSelected(p.node.id)} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title={node.label || TYPE_LABEL[node.type]}
          description={TYPE_LABEL[node.type]}
          actions={
            node.type !== 'trigger' && (
              <Button variant="ghost" size="xs" onClick={() => remove(node.id)}>
                <Trash2 /> Delete node
              </Button>
            )
          }
        >
          <div className="grid gap-4">
            {trace?.[node.id] && <VisitList trace={trace[node.id]!} />}
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Name
              <input value={node.label} onChange={(e) => patchNode(node.id, { label: e.target.value })} className="h-8 w-64 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            </label>
            <NodeForm node={node} graph={g} set={setConfig} />
            {node.type !== 'output' && <Edges node={node} draft={draft} onChange={(edges) => update({ ...draft, edges })} />}
          </div>
        </Section>
      </div>

      <aside aria-label="Executions" className="grid content-start gap-2">
        <Section title="Executions" description="Every time this agent ran. Pick one to see it node by node.">
          {runId && (
            <Button variant="ghost" size="xs" className="-mt-1 mb-2 w-fit" onClick={() => setRunId(null)}>
              <X /> Back to the design
            </Button>
          )}
          {runs.isLoading ? (
            <Spinner label="Loading" />
          ) : !runs.data || runs.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">It hasn’t run yet. Ask it something under Try it, and it appears here.</p>
          ) : (
            <ul className="grid gap-1">
              {runs.data.items.slice(0, 15).map((r) => (
                <li key={r.id}>
                  <button type="button" aria-pressed={runId === r.id} onClick={() => setRunId(runId === r.id ? null : r.id)} className={cn('grid w-full gap-0.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors', runId === r.id ? 'border-foreground bg-muted/60' : 'hover:bg-muted/40')}>
                    <span className="flex items-center gap-1.5">
                      <span aria-label={r.status} className={cn('size-2 rounded-full', r.status === 'ok' ? DOT.ok : DOT.error)} />
                      <span className="font-medium">{triggerLabel(r.trigger)}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums">{ago(r.startedAt)}</span>
                    </span>
                    <span className="truncate text-muted-foreground">{r.input}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatMs(r.durationMs)} · {r.steps} tool call{r.steps === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {run.data && !run.data.trace?.length && <p className="mt-2 text-xs text-muted-foreground">This run is from before workflows, so it has no node trace.</p>}
          <Link to={`/agents/${g.agentId}/history`} className="mt-2 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Full history
          </Link>
        </Section>
      </aside>
    </div>
  )
}

function NodeCard({ node, style, active, trace, onOpen }: { node: GraphNode; style: React.CSSProperties; active: boolean; trace?: NodeTrace; onOpen: () => void }) {
  const Icon = ICON[node.type]
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      style={{ ...style, width: NODE_W, height: NODE_H }}
      className={cn('absolute flex flex-col items-start gap-0.5 overflow-hidden rounded-xl border bg-card px-2.5 py-2 text-left text-sm transition-colors', active ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40', trace?.state === 'skipped' && 'opacity-45')}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{node.label || TYPE_LABEL[node.type]}</span>
      </span>
      <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{trace ? trace.summary : TYPE_LABEL[node.type]}</span>
      {trace && <span aria-label={trace.state} className={cn('absolute top-2 right-2 size-2 rounded-full', DOT[trace.state])} />}
    </button>
  )
}

/** What a node did in the execution picked: each visit with what went in and what came out. */
function VisitList({ trace }: { trace: NodeTrace }) {
  return (
    <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <span className={cn('size-2 rounded-full', DOT[trace.state])} /> In this execution: {trace.state === 'skipped' ? 'not reached' : trace.state === 'error' ? 'it failed' : 'it ran'}
      </p>
      {trace.visits.map((v, i) => (
        <div key={i} className="grid gap-1">
          {trace.visits.length > 1 && <h4 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Time {i + 1}</h4>}
          {([['In', v.in], ['Out', v.out]] as const).map(([label, text]) => text && (
            <div key={label}>
              <h4 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</h4>
              <pre className="max-h-44 overflow-auto rounded-lg border bg-background p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{text}</pre>
            </div>
          ))}
          {v.calls && v.calls.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {v.calls.map((c, j) => (
                <li key={j} className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[10px]', c.error && 'border-destructive/40 text-destructive')}>
                  {c.tool} · {c.ms} ms{c.found ? ` · ${c.found} card${c.found === 1 ? '' : 's'}` : ''}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground tabular-nums">{v.ms} ms</p>
        </div>
      ))}
    </div>
  )
}

/** Where a node leads: each edge with its label and target, and a way to add or remove one. */
function Edges({ node, draft, onChange }: { node: GraphNode; draft: Draft; onChange: (edges: GraphEdge[]) => void }) {
  const mine = draft.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === node.id)
  const labels = labelsFor(node)
  const unused = labels.find((l) => !mine.some(({ e }) => e.label === l))
  const targets = draft.nodes.filter((n) => n.id !== node.id && n.type !== 'trigger')
  const set = (i: number, patch: Partial<GraphEdge>) => onChange(draft.edges.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm'
  return (
    <div className="grid gap-1.5">
      <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Leads to</h3>
      {mine.length === 0 && <p className="text-xs text-warning">Nothing yet: connect it to the next node.</p>}
      {mine.map(({ e, i }) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          {labels.length > 1 && (
            <select aria-label="When" className={SELECT} value={e.label} onChange={(ev) => set(i, { label: ev.target.value })}>
              {[...new Set([...labels, e.label])].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-muted-foreground">→</span>
          <select aria-label="Goes to" className={SELECT} value={e.to} onChange={(ev) => set(i, { to: ev.target.value })}>
            {targets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label || n.id}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="icon-xs" aria-label="Remove this connection" onClick={() => onChange(draft.edges.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      {unused && targets.length > 0 && (
        <Button variant="outline" size="xs" className="w-fit" onClick={() => onChange([...draft.edges, { from: node.id, to: (targets.find((n) => n.type === 'output') ?? targets[0]!).id, label: unused }])}>
          <Plus /> Connect{labels.length > 1 ? ` “${unused}”` : ''}
        </Button>
      )}
    </div>
  )
}
