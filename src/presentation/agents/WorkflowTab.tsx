import '@xyflow/react/dist/style.css'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, applyEdgeChanges, applyNodeChanges, useReactFlow } from '@xyflow/react'
import type { Connection, Edge, EdgeChange, Node, NodeChange, NodeProps } from '@xyflow/react'
import { AlertTriangle, Bot, Clock, Database, GitBranch, MessageSquare, Pin, PinOff, Play, Save, Send, Sparkles, StickyNote, Trash2, Undo2, X, Zap } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { AgentFlow, FlowNode, FlowTrace } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { Link, useNavigate } from '@/presentation/routing'
import { FlowNodeForm } from './FlowNodeForm'
import { fromEdges, handleIn, handleOut, inputsOf, newNode, outputsOf, toEdges, traceByNode } from './flowModel'
import { ago, formatMs, triggerLabel } from './format'

type Ran = FlowTrace & { runs: number }
type CanvasNode = Node<{ node: FlowNode; ran?: Ran }, 'flow'>

const ICONS: Record<string, typeof Zap> = { trigger: Zap, core: GitBranch, data: Database, msg: Send, ai: Sparkles, respond: MessageSquare }
const iconOf = (type: string) => (type === 'trigger.schedule' ? Clock : type === 'core.note' ? StickyNote : (ICONS[type.split('.')[0]!] ?? Bot))
const DOT = { ok: 'bg-success', error: 'bg-destructive' } as const

/** One node on the canvas: its inputs on the left, its outputs on the right, and (when an execution is picked) what it did. */
function FlowCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const { node, ran } = data
  const Icon = iconOf(node.type)
  const outs = outputsOf(node)
  const ins = inputsOf(node.type)
  const note = node.type === 'core.note'
  const spread = (i: number, n: number) => `${((i + 1) / (n + 1)) * 100}%`
  return (
    <div className={cn('relative min-w-40 rounded-xl border bg-card px-3 py-2 text-sm shadow-xs', selected ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40', node.disabled && 'opacity-50', note && 'border-dashed bg-warning/10', ran?.state === 'error' && 'border-destructive')}>
      {Array.from({ length: ins }, (_, i) => (
        <Handle key={i} id={handleIn(i)} type="target" position={Position.Left} style={{ top: spread(i, ins) }} className="!size-2.5 !border-background !bg-muted-foreground" />
      ))}
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{node.name}</span>
        {node.pinData && <Pin aria-label="Pinned data" className="ml-auto size-3 shrink-0 text-warning" />}
        {ran && <span aria-label={ran.state} className={cn(!node.pinData && 'ml-auto', 'size-2 shrink-0 rounded-full', DOT[ran.state])} />}
      </div>
      {note ? (
        <p className="mt-1 max-w-48 text-[11px] text-muted-foreground">{String(node.parameters.text ?? '')}</p>
      ) : ran ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
          {ran.itemsIn} in{ran.outputs?.length ? ` · ${ran.outputs.join(' / ')} out` : ''} · {ran.ms} ms{ran.runs > 1 ? ` · ×${ran.runs}` : ''}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{node.type}</p>
      )}
      {outs.map((label, i) => (
        <Handle key={i} id={handleOut(i)} type="source" position={Position.Right} style={{ top: spread(i, outs.length) }} className="!size-2.5 !border-background !bg-foreground">
          {label && <span className="pointer-events-none absolute right-3 -translate-y-1/2 text-[10px] whitespace-nowrap text-muted-foreground">{label}</span>}
        </Handle>
      ))}
    </div>
  )
}
const nodeTypes = { flow: FlowCanvasNode }

const round = (n: number) => Math.round(n)
const docOf = (nodes: CanvasNode[], edges: Edge[]) => ({
  nodes: nodes.map((n) => ({ ...n.data.node, position: [round(n.position.x), round(n.position.y)] as [number, number] })),
  connections: fromEdges(
    nodes.map((n) => n.data.node),
    edges.map((e) => ({ source: e.source, sourceHandle: e.sourceHandle ?? handleOut(0), target: e.target, targetHandle: e.targetHandle ?? handleIn(0) })),
  ),
})
const canvasOf = (flow: Pick<AgentFlow, 'nodes' | 'connections'>): { nodes: CanvasNode[]; edges: Edge[] } => ({
  nodes: flow.nodes.map((node) => ({ id: node.id, type: 'flow', position: { x: node.position[0], y: node.position[1] }, data: { node } })),
  edges: toEdges(flow.connections),
})
const edgeId = (c: { source: string; sourceHandle: string; target: string; targetHandle: string }) => `${c.source}:${c.sourceHandle.split('-')[1]}:${c.target}:${c.targetHandle.split('-')[1]}`

/**
 * An agent's workflow as a canvas, the way n8n draws one: drag nodes, join an output to an input, open a node to set it. Saving keeps only a
 * workflow that can run. Run it, then pick the execution to see every node's items.
 */
export function WorkflowTab() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  )
}

function Editor() {
  const { agentId } = useParams()
  const { agent } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const navigate = useNavigate()
  const rf = useReactFlow()
  const box = useRef<HTMLDivElement>(null)
  const flow = useQuery({ queryKey: ['agent', 'flow', userId, agentId], queryFn: () => agent.agentFlow(agentId!), enabled: !!agentId, retry: false })
  const runs = useQuery({ queryKey: ['agent', 'runs', userId, agentId, 'recent'], queryFn: () => agent.runs(agentId!), enabled: !!agentId, retry: false, refetchInterval: 15_000 })
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<'save' | 'run' | 'node' | null>(null)
  const [tried, setTried] = useState<Record<string, { outputs: Record<string, unknown>[][]; itemsIn: number; ms: number; error?: string }>>({})
  const [confirmSend, setConfirmSend] = useState(false)
  const run = useQuery({ queryKey: ['agent', 'run', userId, runId], queryFn: () => agent.run(runId!), enabled: !!runId, retry: false })

  const f = flow.data
  const key = f ? JSON.stringify([f.nodes, f.connections]) : ''
  useEffect(() => {
    if (!f) return
    const c = canvasOf(f)
    setNodes(c.nodes)
    setEdges(c.edges)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const doc = useMemo(() => docOf(nodes, edges), [nodes, edges])
  const dirty = !!f && JSON.stringify([f.nodes.map((n) => ({ ...n, position: [round(n.position[0]), round(n.position[1])] })), f.connections]) !== JSON.stringify([doc.nodes, doc.connections])
  const deferred = useDeferredValue(doc)
  const check = useQuery({ queryKey: ['agent', 'flow-check', userId, agentId, JSON.stringify(deferred)], queryFn: () => agent.checkAgentFlow(agentId!, deferred), enabled: !!f && dirty, retry: false })
  const problems: string[] = dirty ? (check.data ?? []) : (f?.problems ?? [])

  const ran = useMemo(() => traceByNode(run.data?.trace as unknown[] | undefined), [run.data])
  const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, ran: runId ? ran[n.id] : undefined } })), [nodes, ran, runId])
  const current = nodes.find((n) => n.id === selected)?.data.node

  const onNodesChange = useCallback((c: NodeChange<CanvasNode>[]) => setNodes((ns) => applyNodeChanges(c, ns)), [])
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((es) => applyEdgeChanges(c, es)), [])
  const onConnect = useCallback((c: Connection) => {
    const e = { source: c.source, sourceHandle: c.sourceHandle ?? handleOut(0), target: c.target, targetHandle: c.targetHandle ?? handleIn(0) }
    setEdges((es) => (es.some((x) => x.id === edgeId(e)) ? es : [...es, { ...e, id: edgeId(e) }]))
  }, [])

  const patch = (id: string, change: Partial<FlowNode>) => {
    const next = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, node: { ...n.data.node, ...change } } } : n))
    const lanes = Math.max(outputsOf(next.find((n) => n.id === id)!.data.node).length, 1)
    setNodes(next)
    setEdges((es) => es.filter((e) => e.source !== id || Number((e.sourceHandle ?? '').split('-')[1] ?? 0) < lanes)) // a rule that was removed takes its connection with it
  }
  const setParams = (values: Record<string, unknown>) => {
    if (!current) return
    const parameters = { ...current.parameters, ...values }
    for (const k of Object.keys(parameters)) if (parameters[k] === undefined) delete parameters[k]
    patch(current.id, { parameters })
  }
  const add = (type: string, label: string) => {
    const b = box.current?.getBoundingClientRect()
    const at = b ? rf.screenToFlowPosition({ x: b.x + b.width / 2 + (nodes.length % 4) * 24, y: b.y + b.height / 2 + (nodes.length % 4) * 24 }) : { x: 40, y: 40 }
    const node = newNode(type, label, nodes.map((n) => n.id), [round(at.x), round(at.y)])
    setNodes((ns) => [...ns, { id: node.id, type: 'flow', position: { x: node.position[0], y: node.position[1] }, data: { node } }])
    setSelected(node.id)
  }
  const remove = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setSelected(null)
  }

  async function save() {
    setBusy('save')
    try {
      await agent.saveAgentFlow(agentId!, doc)
      await client.invalidateQueries({ queryKey: ['agent', 'flow'] })
      toast.success('Saved. The agent uses this workflow from its next run.')
    } catch (e) {
      toast.error('Couldn’t save it', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(null)
    }
  }
  async function reset() {
    try {
      await agent.resetAgentFlow(agentId!)
      await client.invalidateQueries({ queryKey: ['agent', 'flow'] })
      toast.success('Back to the default workflow')
    } catch (e) {
      toast.error('Couldn’t reset it', { description: e instanceof Error ? e.message : undefined })
    }
  }
  async function runNow(scheduled: boolean) {
    setBusy('run')
    try {
      const r = await agent.runAgentFlow(agentId!, message, scheduled)
      await client.invalidateQueries({ queryKey: ['agent', 'runs'] })
      if (r.runId) setRunId(r.runId)
      toast.success('It ran', { description: r.answer ? r.answer.slice(0, 140) : 'No answer was given: it ended without an Answer node.' })
    } catch (e) {
      toast.error('The run failed', { description: e instanceof Error ? e.message : undefined })
      await client.invalidateQueries({ queryKey: ['agent', 'runs'] })
    } finally {
      setBusy(null)
    }
  }
  async function runOne(id: string) {
    setBusy('node')
    try {
      setTried((t) => ({ ...t, [id]: undefined as never }))
      const r = await agent.runFlowNode(agentId!, id, undefined, confirmSend)
      setTried((t) => ({ ...t, [id]: r }))
    } catch (e) {
      toast.error('Couldn’t run that node', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(null)
    }
  }
  async function deleteAgent() {
    if (!window.confirm(`Delete “${f?.name}”? Its workflow and history go with it.`)) return
    try {
      await agent.deleteAgent(agentId!)
      await client.invalidateQueries({ queryKey: ['agent'] })
      toast.success('Agent deleted')
      navigate('/agents')
    } catch (e) {
      toast.error('Couldn’t delete it', { description: e instanceof Error ? e.message : undefined })
    }
  }

  if (flow.isLoading) return <Spinner label="Loading the workflow" />
  if (!f) return <p role="alert" className="text-sm text-destructive">{flow.error instanceof Error ? flow.error.message : 'Couldn’t load the workflow.'}</p>
  const groups = [...new Set(f.catalog.map((c) => c.group))]
  const hasSchedule = nodes.some((n) => n.data.node.type === 'trigger.schedule')
  const traceOfCurrent = current && runId ? ran[current.id] : undefined

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-4">
        <Section
          title="Workflow"
          description={runId ? 'One execution: each node shows the items that went through it. Open a node to see them.' : f.custom || f.created ? 'Drag nodes, join an output to an input, open a node to set it.' : 'The default workflow. Add nodes from the palette and join them to change how this agent works.'}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" onClick={() => void save()} disabled={!dirty || busy !== null || problems.length > 0}>
                {busy === 'save' ? <Spinner size="xs" tone="current" decorative /> : <Save />} Save
              </Button>
              {dirty && (
                <Button size="sm" variant="ghost" onClick={() => { const c = canvasOf(f); setNodes(c.nodes); setEdges(c.edges) }}>
                  <Undo2 /> Discard
                </Button>
              )}
              {f.custom && !dirty && (
                <Button size="sm" variant="ghost" onClick={() => void reset()}>
                  Back to default
                </Button>
              )}
              {f.created && (
                <Button size="sm" variant="ghost" onClick={() => void deleteAgent()}>
                  <Trash2 /> Delete agent
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Add a node">
              {groups.map((g) => (
                <select key={g} aria-label={g} value="" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" onChange={(e) => { const c = f.catalog.find((x) => x.type === e.target.value); if (c) add(c.type, c.label) }}>
                  <option value="">+ {g}…</option>
                  {f.catalog.filter((c) => c.group === g).map((c) => (
                    <option key={c.type} value={c.type} title={c.description}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            {problems.length > 0 && (
              <ul role="alert" className="grid gap-1 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                {problems.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" /> {p}
                  </li>
                ))}
              </ul>
            )}
            <div ref={box} className="h-[26rem] overflow-hidden rounded-xl border bg-muted/20" data-testid="flow-canvas">
              <ReactFlow
                nodes={shown}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, n) => setSelected(n.id)}
                onPaneClick={() => setSelected(null)}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                minZoom={0.3}
                deleteKeyCode={['Backspace', 'Delete']}
                colorMode="system"
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={18} />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable className="!hidden sm:!block" />
              </ReactFlow>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="A message to run it with" placeholder="A message to try it with…" value={message} onChange={(e) => setMessage(e.target.value)} className="h-8 max-w-sm" />
              <Button size="sm" variant="outline" disabled={busy !== null || dirty} onClick={() => void runNow(false)} title={dirty ? 'Save first: it runs the saved workflow.' : undefined}>
                {busy === 'run' ? <Spinner size="xs" tone="current" decorative /> : <Play />} Run
              </Button>
              {hasSchedule && (
                <Button size="sm" variant="ghost" disabled={busy !== null || dirty} onClick={() => void runNow(true)}>
                  <Clock /> Run from the schedule
                </Button>
              )}
            </div>
          </div>
        </Section>

        {current && (
          <Section title={current.name} description={current.type} actions={<Button variant="ghost" size="xs" onClick={() => remove(current.id)}><Trash2 /> Delete node</Button>}>
            <div className="grid gap-4">
              {traceOfCurrent && <Items trace={traceOfCurrent} />}
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Name
                  <Input value={current.name} onChange={(e) => patch(current.id, { name: e.target.value })} className="h-8 w-64" />
                </label>
                <label className="flex items-center gap-2 pb-1.5 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={!!current.disabled} onChange={(e) => patch(current.id, { disabled: e.target.checked || undefined })} />
                  Off (pass items through)
                </label>
                <label className="flex items-center gap-2 pb-1.5 text-sm" title="Run even when nothing arrives, so “found nobody” can still be answered">
                  <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={!!current.parameters.runWhenEmpty} onChange={(e) => setParams({ runWhenEmpty: e.target.checked || undefined })} />
                  Run when nothing arrives
                </label>
              </div>
              <NodeTry
                node={current}
                result={tried[current.id]}
                busy={busy === 'node'}
                disabled={dirty || busy !== null}
                confirm={confirmSend}
                onConfirm={setConfirmSend}
                onRun={() => void runOne(current.id)}
                onPin={(items) => patch(current.id, { pinData: items })}
              />
              <FlowNodeForm node={current} flow={f} set={setParams} />
            </div>
          </Section>
        )}
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
            <p className="text-sm text-muted-foreground">It hasn’t run yet. Press Run, and it appears here.</p>
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
                    <span className="text-muted-foreground tabular-nums">{formatMs(r.durationMs)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {run.data && Object.keys(ran).length === 0 && <p className="mt-2 text-xs text-muted-foreground">This run is from an older engine, so it has no node-by-node items.</p>}
          <Link to={`/agents/${f.agentId}/history`} className="mt-2 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Full history
          </Link>
        </Section>
      </aside>
    </div>
  )
}

/** The items that went into a node and came out in the execution picked. */
function Items({ trace }: { trace: Ran }) {
  const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2))
  return (
    <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <span className={cn('size-2 rounded-full', DOT[trace.state])} /> In this execution: {trace.state === 'error' ? 'it failed' : 'it ran'} · {trace.itemsIn} item{trace.itemsIn === 1 ? '' : 's'} in{trace.outputs?.length ? ` · ${trace.outputs.join(' / ')} out` : ''} · {trace.ms} ms{trace.runs > 1 ? ` · ${trace.runs} times (the last is shown)` : ''}
      </p>
      {trace.error && <p role="alert" className="text-xs text-destructive">{trace.error}</p>}
      {([['Items in', trace.in], ['Items out (per output)', trace.out]] as const).map(([label, v]) => v !== undefined && (
        <div key={label}>
          <h4 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</h4>
          <pre className="max-h-52 overflow-auto rounded-lg border bg-background p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{show(v)}</pre>
        </div>
      ))}
    </div>
  )
}

const SENDS = ['msg.send', 'msg.ask', 'msg.mail']

/** Try one node on its own, and pin what it gave so the rest of the workflow can be tried with that data when it is run by hand. */
function NodeTry({ node, result, busy, disabled, confirm, onConfirm, onRun, onPin }: { node: FlowNode; result?: { outputs: Record<string, unknown>[][]; itemsIn: number; ms: number; error?: string }; busy: boolean; disabled: boolean; confirm: boolean; onConfirm: (v: boolean) => void; onRun: () => void; onPin: (items: Record<string, unknown>[] | undefined) => void }) {
  const first = result?.outputs[0] ?? []
  const sends = SENDS.includes(node.type)
  return (
    <div className="grid gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={disabled || (sends && !confirm)} onClick={onRun} title={disabled ? 'Save first: it runs the saved workflow.' : undefined}>
          {busy ? <Spinner size="xs" tone="current" decorative /> : <Play />} Run this node
        </Button>
        {sends && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" className="size-3.5 accent-[var(--foreground)]" checked={confirm} onChange={(e) => onConfirm(e.target.checked)} />
            It sends or drafts something: I mean it
          </label>
        )}
        {node.pinData ? (
          <>
            <span className="flex items-center gap-1 text-xs text-warning">
              <Pin className="size-3.5" /> Pinned · {node.pinData.length} item{node.pinData.length === 1 ? '' : 's'}: used when you run by hand
            </span>
            <Button size="xs" variant="ghost" onClick={() => onPin(undefined)}>
              <PinOff /> Unpin
            </Button>
          </>
        ) : (
          first.length > 0 && (
            <Button size="xs" variant="ghost" onClick={() => onPin(first)}>
              <Pin /> Pin this output
            </Button>
          )
        )}
      </div>
      {result?.error && (
        <p role="alert" className="text-xs text-destructive">
          {result.error}
        </p>
      )}
      {result && !result.error && (
        <div>
          <h4 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Gave {result.outputs.map((o) => o.length).join(' / ')} item{result.outputs.flat().length === 1 ? '' : 's'} from {result.itemsIn} in · {result.ms} ms
          </h4>
          <pre className="max-h-48 overflow-auto rounded-lg border bg-background p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(result.outputs.length === 1 ? result.outputs[0] : result.outputs, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
