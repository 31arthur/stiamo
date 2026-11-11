import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { Panel, ReactFlowProvider, applyEdgeChanges, applyNodeChanges, useReactFlow } from '@xyflow/react'
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react'
import { AlertTriangle, ArrowLeft, ClipboardPaste, Clock, Copy, EllipsisVertical, FlaskConical, Plus, Redo2, RotateCcw, Save, StickyNote, Trash2, Undo2, X } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { FlowCatalogNode, FlowNode, FlowProgress } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { useNavigate } from '@/presentation/routing'
import { handleIn, handleOut, newNode, outputsOf, readWorkflowJson, toEdges, traceByNode, workflowJson } from '../flowModel'
import { ago, formatMs, triggerLabel } from '../format'
import { ModelSection, WorkspacesSection } from '../SettingsTab'
import { TryTab } from '../TryTab'
import { PromptEditor } from '../PromptEditor'
import { useAgentSummary } from '../useAgent'
import { NodeDetails } from './NodeDetails'
import type { Tried } from './NodeDetails'
import { NodePicker } from './NodePicker'
import { CANVAS_BUTTON, StudioCanvas, canvasOf, docOf, edgeId, openLanes, round } from './StudioCanvas'
import type { CanvasNode, Ran } from './StudioCanvas'

const TABS = [
  { id: 'editor', label: 'Editor' },
  { id: 'executions', label: 'Executions' },
  { id: 'settings', label: 'Settings' },
  { id: 'try', label: 'Try it' },
] as const
type TabId = (typeof TABS)[number]['id']

/**
 * An agent's workflow, laid out the way n8n does it: the whole screen is the canvas, with Editor, Executions and Settings along the top. It sits over
 * the app (in a portal, so the page's padding and animation can't shrink it) and the back arrow returns to the agent.
 */
export function WorkflowStudio() {
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [])
  return createPortal(
    <div className="fixed inset-y-0 right-0 left-0 z-40 flex flex-col bg-background text-foreground lg:left-64" data-testid="workflow-studio">
      <ReactFlowProvider>
        <Studio />
      </ReactFlowProvider>
    </div>,
    document.body,
  )
}

type TriedMap = Record<string, Tried | undefined>

function Studio() {
  const { agentId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'editor'
  const setTab = (t: TabId) => setParams(t === 'editor' ? {} : { tab: t }, { replace: true })
  const { agent } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const navigate = useNavigate()
  const summary = useAgentSummary(agentId)
  const rf = useReactFlow()
  const box = useRef<HTMLDivElement>(null)

  const flow = useQuery({ queryKey: ['agent', 'flow', userId, agentId], queryFn: () => agent.agentFlow(agentId!), enabled: !!agentId, retry: false })
  const runs = useQuery({ queryKey: ['agent', 'runs', userId, agentId, 'recent'], queryFn: () => agent.runs(agentId!), enabled: !!agentId, retry: false, refetchInterval: 15_000 })

  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [opened, setOpened] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ after?: { id: string; lane: number } } | null>(null)
  const [liveRun, setLiveRun] = useState<string | null>(null)
  const [pickedRun, setPickedRun] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<'save' | 'run' | 'node' | null>(null)
  const [tried, setTried] = useState<TriedMap>({})
  const [confirmSend, setConfirmSend] = useState(false)
  const [importing, setImporting] = useState(false)
  const [manual, setManual] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const viewedRun = tab === 'executions' ? pickedRun : liveRun
  const run = useQuery({ queryKey: ['agent', 'run', userId, viewedRun], queryFn: () => agent.run(viewedRun!), enabled: !!viewedRun, retry: false })

  const f = flow.data
  const key = f ? JSON.stringify([f.nodes, f.connections]) : ''
  useEffect(() => {
    if (!f) return
    const c = canvasOf(f)
    setNodes(c.nodes)
    setEdges(c.edges)
    hist.current = { past: [], future: [], last: '' }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const doc = useMemo(() => docOf(nodes, edges), [nodes, edges])
  const dirty = !!f && JSON.stringify([f.nodes.map((n) => ({ ...n, position: [round(n.position[0]), round(n.position[1])] })), f.connections]) !== JSON.stringify([doc.nodes, doc.connections])
  const deferred = useDeferredValue(doc)
  const check = useQuery({ queryKey: ['agent', 'flow-check', userId, agentId, JSON.stringify(deferred)], queryFn: () => agent.checkAgentFlow(agentId!, deferred), enabled: !!f && dirty, retry: false })
  const problems: string[] = dirty ? (check.data ?? []) : (f?.problems ?? [])

  // --- undo and redo: what the canvas held, kept after each pause in editing --------------------------------------------------------
  const hist = useRef<{ past: string[]; future: string[]; last: string }>({ past: [], future: [], last: '' })
  const [, bump] = useState(0)
  const docKey = JSON.stringify(doc)
  useEffect(() => {
    const h = hist.current
    if (!f || nodes.length === 0) return
    if (h.last === '') {
      h.last = docKey
      return
    }
    if (docKey === h.last) return
    const t = setTimeout(() => {
      h.past.push(h.last)
      if (h.past.length > 100) h.past.shift()
      h.future = []
      h.last = docKey
      bump((n) => n + 1)
    }, 400)
    return () => clearTimeout(t)
  }, [docKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const restore = (s: string) => {
    const c = canvasOf(JSON.parse(s))
    setNodes(c.nodes)
    setEdges(c.edges)
    setOpened(null)
    bump((n) => n + 1)
  }
  const undo = () => {
    const h = hist.current
    if (docKey !== h.last) {
      h.past.push(h.last) // what was changed in the last moments counts as a step
      h.last = docKey
    }
    const s = h.past.pop()
    if (s === undefined) return
    h.future.push(h.last)
    h.last = s
    restore(s)
  }
  const redo = () => {
    const h = hist.current
    const s = h.future.pop()
    if (s === undefined) return
    h.past.push(h.last)
    h.last = s
    restore(s)
  }

  // --- copy, paste and duplicate ----------------------------------------------------------------------------------------------------
  const clip = useRef<{ nodes: FlowNode[]; edges: Edge[]; pastes: number } | null>(null)
  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id)
  const toClipboard = (list: CanvasNode[]) => {
    const json = workflowJson(list.map((n) => ({ ...n.data.node, position: [round(n.position.x), round(n.position.y)] as [number, number] })), edges.map((e) => ({ source: e.source, sourceHandle: e.sourceHandle ?? handleOut(0), target: e.target, targetHandle: e.targetHandle ?? handleIn(0) })))
    navigator.clipboard?.writeText(json).then(
      () => toast.success(`${list.length} node${list.length === 1 ? '' : 's'} copied as JSON`, { description: 'Paste them here, into another workflow, or into a note.' }),
      () => setManual(json), // the browser wouldn't let the page write to the clipboard: the JSON is shown to copy by hand
    )
  }
  /** Brings in pasted workflow JSON: its nodes land on the canvas, joined as they were, with new ids if theirs are taken. Says why when it can't. */
  const importJson = (text: string, quiet = false): boolean => {
    const r = readWorkflowJson(text, f?.catalog.map((c) => c.type) ?? [])
    if (!r.ok) {
      if (!quiet) toast.error('Couldn’t paste that', { description: r.reason })
      return false
    }
    const xs = r.nodes.map((n) => n.position[0]), ys = r.nodes.map((n) => n.position[1])
    const b = box.current?.getBoundingClientRect()
    const centre = b ? rf.screenToFlowPosition({ x: b.x + b.width / 2, y: b.y + b.height / 2 }) : { x: 0, y: 0 }
    place(r.nodes, toEdges(r.connections) as Edge[], centre.x - (Math.min(...xs) + Math.max(...xs)) / 2, centre.y - (Math.min(...ys) + Math.max(...ys)) / 2)
    toast.success(`${r.nodes.length} node${r.nodes.length === 1 ? '' : 's'} pasted`, r.warnings.length ? { description: r.warnings.join(' '), duration: 12000 } : undefined)
    return true
  }
  const copy = () => {
    if (selectedIds.length === 0) return false
    toClipboard(nodes.filter((n) => n.selected))
    clip.current = { nodes: nodes.filter((n) => n.selected).map((n) => ({ ...n.data.node, position: [n.position.x, n.position.y] as [number, number] })), edges: edges.filter((e) => selectedIds.includes(e.source) && selectedIds.includes(e.target)), pastes: 0 }
    return true
  }
  /** Puts copies of nodes (and the joins between them) on the canvas, shifted by (dx, dy), and selects the copies. */
  const place = (src: FlowNode[], joins: Edge[], dx: number, dy: number, select = true) => {
    const taken = nodes.map((n) => n.id)
    const ids: Record<string, string> = {}
    const made = src.map((s) => {
      const fresh = newNode(s.type, s.name, taken, [round(s.position[0] + dx), round(s.position[1] + dy)])
      taken.push(fresh.id)
      ids[s.id] = fresh.id
      return { ...fresh, parameters: structuredClone(s.parameters), disabled: s.disabled, pinData: s.pinData ? structuredClone(s.pinData) : undefined }
    })
    setNodes((ns) => [...(select ? ns.map((n) => ({ ...n, selected: false })) : ns), ...made.map((node): CanvasNode => ({ id: node.id, type: 'flow', position: { x: node.position[0], y: node.position[1] }, selected: select, data: { node, open: [] } }))])
    setEdges((es) => [...es, ...joins.map((e) => { const j = { source: ids[e.source]!, sourceHandle: e.sourceHandle ?? handleOut(0), target: ids[e.target]!, targetHandle: e.targetHandle ?? handleIn(0) }; return { ...j, id: edgeId(j) } })])
  }
  const paste = () => {
    const c = clip.current
    if (!c) return
    c.pastes += 1
    place(c.nodes, c.edges, 40 * c.pastes, 40 * c.pastes)
  }
  const duplicate = () => {
    if (!copy()) return
    clip.current!.pastes = 1
    paste()
  }
  /** Holding Alt (or Ctrl/Cmd) while dragging a node leaves a copy behind where it was. */
  const onDragStart = (e: MouseEvent | TouchEvent, _n: CanvasNode, dragged: CanvasNode[]) => {
    if (!("altKey" in e && (e.altKey || e.ctrlKey || e.metaKey)) || tab !== 'editor') return
    place(dragged.map((d) => ({ ...d.data.node, position: [d.position.x, d.position.y] as [number, number] })), [], 0, 0, false)
  }

  // --- the run, drawn as it goes: the server says which node it is on, and this asks every moment while the run lasts ---------------
  const [progress, setProgress] = useState<FlowProgress | null>(null)
  const running = busy === 'run'
  const lit = (id: string) => running && progress?.nodes[id]?.state === 'running'
  const reached = (id: string): Ran | undefined => {
    const p = running ? progress?.nodes[id] : undefined
    const node = nodes.find((n) => n.id === id)?.data.node
    return p && p.state !== 'running' && node ? { node: id, name: node.name, type: node.type, state: p.state, ms: p.ms ?? 0, itemsIn: 0, outputs: p.outputs, runs: p.runs } : undefined
  }
  const ran = useMemo(() => traceByNode(run.data?.trace as unknown[] | undefined), [run.data])
  const open = useMemo(() => openLanes(nodes, edges), [nodes, edges])
  const onAdd = useCallback((id: string, lane: number) => setPicker({ after: { id, lane } }), [])
  const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, ran: running ? reached(n.id) : viewedRun ? ran[n.id] : undefined, running: lit(n.id), model: n.data.node.type === 'ai.agent' ? modelOf(n.data.node) : undefined, onModel: setOpened, open: tab === 'editor' ? (open[n.id] ?? []) : [], onAdd } })), [nodes, ran, viewedRun, open, tab, onAdd, running, progress, summary?.selection]) // eslint-disable-line react-hooks/exhaustive-deps
  const drawn = useMemo(() => (running ? edges.map((e) => ({ ...e, animated: progress?.nodes[e.target]?.state === 'running' })) : edges), [edges, running, progress])
  function modelOf(node: FlowNode) {
    const own = node.parameters.model as { modelId?: string } | undefined
    const id = own?.modelId || summary?.selection?.modelId
    return { label: id ? id.split('/').pop()! : 'Choose a model', own: !!own?.modelId }
  }
  const current = nodes.find((n) => n.id === opened)?.data.node
  const feeding = current ? edges.filter((e) => e.target === current.id).map((e) => nodes.find((n) => n.id === e.source)?.data.node).filter((n): n is FlowNode => !!n) : []

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
  const setNodeParams = (values: Record<string, unknown>) => {
    if (!current) return
    const parameters = { ...current.parameters, ...values }
    for (const k of Object.keys(parameters)) if (parameters[k] === undefined) delete parameters[k]
    patch(current.id, { parameters })
  }
  const addNode = (c: Pick<FlowCatalogNode, 'type' | 'label'>, after = picker?.after) => {
    const taken = nodes.map((n) => n.id)
    const from = after ? nodes.find((n) => n.id === after.id) : undefined
    const b = box.current?.getBoundingClientRect()
    const centre = b ? rf.screenToFlowPosition({ x: b.x + b.width / 2 - 40, y: b.y + b.height / 2 - 40 }) : { x: 40, y: 40 }
    const at: [number, number] = from ? [round(from.position.x + 190), round(from.position.y + after!.lane * 90)] : [round(centre.x + (nodes.length % 4) * 24), round(centre.y + (nodes.length % 4) * 24)]
    const node = newNode(c.type, c.label, taken, at)
    setNodes((ns) => [...ns, { id: node.id, type: 'flow', position: { x: at[0], y: at[1] }, data: { node, open: [] } }])
    if (after && from && c.type !== 'core.note' && !c.type.startsWith('trigger.')) {
      const e = { source: from.id, sourceHandle: handleOut(after.lane), target: node.id, targetHandle: handleIn(0) }
      setEdges((es) => [...es, { ...e, id: edgeId(e) }])
    }
    setPicker(null)
    if (c.type !== 'core.note') setOpened(node.id)
  }
  const remove = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setOpened(null)
  }

  // "Tab" opens the node panel, as in n8n; Cmd/Ctrl-S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)
      if (e.key === 'Tab' && !typing && tab === 'editor' && !opened && !e.shiftKey) {
        e.preventDefault()
        setPicker({})
      }
      if ((e.metaKey || e.ctrlKey) && tab === 'editor' && !typing && !opened) {
        const k = e.key.toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (k === 'y') {
          e.preventDefault()
          redo()
        } else if (k === 'c') copy()
        else if (k === 'a') {
          e.preventDefault()
          setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))
        } else if (k === 'd') {
          e.preventDefault()
          duplicate()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty && busy === null && problems.length === 0) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // (the handler reads the latest state, so it is re-bound on every render)

  // Pasting: whatever is on the system clipboard (workflow JSON copied here or elsewhere); failing that, what was last copied in this editor.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target
      if (tab !== 'editor' || opened || (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      if (text.trim() && importJson(text, !!clip.current)) return
      paste()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

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
    if (!window.confirm('Go back to the default workflow? Your changes to it are lost.')) return
    try {
      await agent.resetAgentFlow(agentId!)
      await client.invalidateQueries({ queryKey: ['agent', 'flow'] })
      toast.success('Back to the default workflow')
    } catch (e) {
      toast.error('Couldn’t reset it', { description: e instanceof Error ? e.message : undefined })
    }
  }
  async function execute(scheduled: boolean) {
    setBusy('run')
    setProgress(null)
    const pid = crypto.randomUUID().replaceAll('-', '')
    // While the run is on, ask how far it has got and light up the node it is on (a failed ask is skipped: the run itself is what matters).
    const timer = setInterval(() => {
      agent.flowProgress(agentId!, pid).then(setProgress).catch(() => undefined)
    }, 400)
    try {
      const r = await agent.runAgentFlow(agentId!, message, scheduled, pid)
      await client.invalidateQueries({ queryKey: ['agent', 'runs'] })
      if (r.runId) setLiveRun(r.runId)
      toast.success('Workflow executed', { description: r.answer ? r.answer.slice(0, 140) : 'No answer was given: it ended without an Answer node.' })
    } catch (e) {
      toast.error('The execution failed', { description: e instanceof Error ? e.message : undefined })
      await client.invalidateQueries({ queryKey: ['agent', 'runs'] })
    } finally {
      clearInterval(timer)
      setProgress(null)
      setBusy(null)
    }
  }
  async function runOne(id: string) {
    setBusy('node')
    try {
      setTried((t) => ({ ...t, [id]: undefined }))
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
  const leave = () => {
    if (dirty && !window.confirm('You have changes that are not saved. Leave without saving?')) return
    navigate(`/agents/${agentId}`)
  }

  if (flow.isLoading) return <div className="grid flex-1 place-items-center"><Spinner label="Loading the workflow" /></div>
  if (!f) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center">
        <p role="alert" className="text-sm text-destructive">{flow.error instanceof Error ? flow.error.message : 'Couldn’t load the workflow.'}</p>
        <Button variant="outline" onClick={() => navigate(`/agents/${agentId}`)}>
          <ArrowLeft /> Back to the agent
        </Button>
      </div>
    )
  }
  const hasSchedule = nodes.some((n) => n.data.node.type === 'trigger.schedule')
  const hasTrigger = nodes.some((n) => n.data.node.type.startsWith('trigger.'))
  const readOnly = tab === 'executions'

  return (
    <>
      <header className="flex h-14 shrink-0 flex-wrap items-center gap-x-3 border-b bg-background px-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back to the agent" onClick={leave}>
          <ArrowLeft />
        </Button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="hidden text-muted-foreground sm:inline">Developer</span>
          <span className="hidden text-muted-foreground/50 sm:inline">/</span>
          <h1 className="truncate font-semibold">{f.name}</h1>
          {dirty && <span aria-label="Unsaved changes" title="Unsaved changes" className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning max-xl:size-2 max-xl:p-0"><span className="max-xl:hidden">Unsaved</span></span>}
        </nav>

        <div role="tablist" aria-label="Workflow sections" className="order-last mx-auto flex w-full justify-center gap-0.5 rounded-xl bg-muted p-1 sm:order-none sm:w-auto sm:flex-1 sm:justify-center sm:bg-transparent sm:p-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:flex-none">
          <div className="flex gap-0.5 rounded-xl border bg-muted p-1">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('rounded-lg px-3.5 py-1 text-sm font-medium transition-colors', tab === t.id ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {dirty && tab === 'editor' && (
            <Button size="sm" variant="ghost" onClick={() => { const c = canvasOf(f); setNodes(c.nodes); setEdges(c.edges) }}>
              <Undo2 /> <span className="hidden sm:inline">Discard</span>
            </Button>
          )}
          <Button size="sm" onClick={() => void save()} disabled={!dirty || busy !== null || problems.length > 0} title={problems.length ? 'Fix the problems first' : 'Save (Ctrl+S)'}>
            {busy === 'save' ? <Spinner size="xs" tone="current" decorative /> : <Save />} Save
          </Button>
          <ActionMenu
            trigger={<Button variant="ghost" size="icon-sm" aria-label="More" />}
            triggerContent={<EllipsisVertical />}
            contentProps={{ align: 'end', className: 'w-52' }}
            items={[
              ...(f.custom ? [{ key: 'reset', label: 'Back to default workflow', icon: <RotateCcw className="size-4" />, onSelect: () => void reset() }] : []),
              ...(f.created ? [{ key: 'delete', label: 'Delete agent', icon: <Trash2 className="size-4" />, onSelect: () => void deleteAgent() }] : []),
              { key: 'copy', label: 'Copy workflow JSON', icon: <Copy className="size-4" />, onSelect: () => toClipboard(nodes) },
              { key: 'import', label: 'Paste workflow JSON…', icon: <ClipboardPaste className="size-4" />, onSelect: () => setImporting(true) },
              { key: 'leave', label: 'Back to the agent', icon: <ArrowLeft className="size-4" />, onSelect: leave },
            ]}
          />
        </div>
      </header>

      <div ref={box} className="relative min-h-0 flex-1">
        {tab === 'try' ? (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
              <TryTab />
            </div>
          </div>
        ) : tab === 'settings' ? (
          <div className="absolute inset-0 overflow-y-auto">
            <StudioSettings id={f.agentId} summaryName={summary?.name ?? f.name} description={f.description} custom={f.custom} created={f.created} onReset={() => void reset()} onDelete={() => void deleteAgent()} />
          </div>
        ) : (
          <div className={cn('absolute inset-0 flex', tab === 'executions' && 'flex-col md:flex-row')}>
            {tab === 'executions' && (
              <aside aria-label="Executions" className="max-h-56 w-full shrink-0 overflow-y-auto border-b bg-background md:max-h-none md:w-72 md:border-r md:border-b-0">
                <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
                  <h2 className="text-sm font-semibold">Executions</h2>
                  <p className="text-xs text-muted-foreground">Each time this agent ran. Pick one to see it node by node.</p>
                </div>
                {runs.isLoading ? (
                  <div className="p-4"><Spinner label="Loading" /></div>
                ) : !runs.data || runs.data.items.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">It hasn’t run yet. Press “Execute workflow” in the Editor and it appears here.</p>
                ) : (
                  <ul className="grid gap-1 p-2">
                    {runs.data.items.slice(0, 40).map((r) => (
                      <li key={r.id}>
                        <button type="button" aria-pressed={pickedRun === r.id} onClick={() => setPickedRun(pickedRun === r.id ? null : r.id)} className={cn('grid w-full gap-0.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors', pickedRun === r.id ? 'border-foreground bg-muted/60' : 'border-transparent hover:bg-muted/50')}>
                          <span className="flex items-center gap-1.5">
                            <span aria-label={r.status} className={cn('size-2 rounded-full', r.status === 'ok' ? 'bg-success' : 'bg-destructive')} />
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
              </aside>
            )}

            <div className="relative min-h-0 min-w-0 flex-1" data-testid="flow-canvas">
              <StudioCanvas nodes={shown} edges={drawn} onDragStart={onDragStart} readOnly={readOnly} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onOpen={setOpened} onPane={() => setPicker(null)}>
                {tab === 'editor' && (
                  <>
                    <Panel position="top-right" className="flex flex-col gap-2">
                      <button type="button" aria-label="Add a node" title="Add a node (Tab)" className={CANVAS_BUTTON} onClick={() => setPicker({})}>
                        <Plus className="size-4" />
                      </button>
                      <button type="button" aria-label="Add a note" title="Add a note" className={CANVAS_BUTTON} onClick={() => addNode({ type: 'core.note', label: 'Note' }, undefined)}>
                        <StickyNote className="size-4" />
                      </button>
                      <button type="button" aria-label="Duplicate the selected nodes" title="Duplicate selected (Ctrl+D). Hold Alt while dragging a node to copy it." className={CANVAS_BUTTON} disabled={selectedIds.length === 0} onClick={duplicate}>
                        <Copy className="size-4" />
                      </button>
                      <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" className={CANVAS_BUTTON} disabled={hist.current.past.length === 0 && docKey === hist.current.last} onClick={undo}>
                        <Undo2 className="size-4" />
                      </button>
                      <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={CANVAS_BUTTON} disabled={hist.current.future.length === 0} onClick={redo}>
                        <Redo2 className="size-4" />
                      </button>
                    </Panel>
                    <Panel position="bottom-center" className="mb-16 flex flex-wrap items-center justify-center gap-2 sm:mb-3.5">
                      <Input aria-label="A message to execute it with" placeholder="A message to try it with…" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !dirty && busy === null) void execute(false) }} className="h-10 w-56 bg-card sm:w-72" />
                      <Button size="lg" className="h-10 gap-2 bg-orange-500 px-5 text-white hover:bg-orange-600" disabled={busy !== null || dirty} onClick={() => void execute(false)} title={dirty ? 'Save first: it executes the saved workflow.' : undefined}>
                        {busy === 'run' ? <Spinner size="xs" tone="current" decorative /> : <FlaskConical />} Execute workflow
                      </Button>
                      {hasSchedule && (
                        <Button variant="outline" className="h-10 bg-card" disabled={busy !== null || dirty} onClick={() => void execute(true)}>
                          <Clock /> From the schedule
                        </Button>
                      )}
                      {liveRun && (
                        <Button variant="outline" className="h-10 bg-card" onClick={() => setLiveRun(null)}>
                          <X /> Clear execution data
                        </Button>
                      )}
                    </Panel>
                  </>
                )}
                {problems.length > 0 && tab === 'editor' && (
                  <Panel position="top-center">
                    <ul role="alert" className="grid max-w-md gap-1 rounded-xl border border-warning/40 bg-background/95 px-3 py-2 text-xs shadow-md">
                      {problems.map((p) => (
                        <li key={p} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" /> {p}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
                {readOnly && (
                  <Panel position="top-center">
                    <p className="rounded-full border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                      {pickedRun ? (run.data && Object.keys(ran).length === 0 ? 'This run is from an older engine, so it has no node-by-node items.' : 'Double-click or click a node to see the items it got and gave.') : 'Pick an execution on the left.'}
                    </p>
                  </Panel>
                )}
              </StudioCanvas>
            </div>
          </div>
        )}

        {manual !== null && (
          <div role="dialog" aria-modal="true" aria-label="Copy workflow JSON" className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="grid w-full max-w-2xl gap-3 rounded-2xl border bg-background p-4 shadow-2xl">
              <div>
                <h2 className="text-base font-semibold">Copy the workflow JSON</h2>
                <p className="text-xs text-muted-foreground">Your browser didn’t let the page use the clipboard, so here it is: select it all and copy.</p>
              </div>
              <textarea aria-label="Workflow JSON to copy" readOnly autoFocus rows={12} value={manual} onFocus={(e) => e.currentTarget.select()} className="w-full resize-y rounded-lg border border-input bg-transparent p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const el = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Workflow JSON to copy"]')
                    el?.select()
                    const ok = document.execCommand('copy')
                    toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Still blocked: press Ctrl+C on the selected text')
                  }}
                >
                  <Copy /> Copy
                </Button>
                <Button onClick={() => setManual(null)}>Done</Button>
              </div>
            </div>
          </div>
        )}
        {importing && (
          <div role="dialog" aria-modal="true" aria-label="Paste workflow JSON" className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="grid w-full max-w-2xl gap-3 rounded-2xl border bg-background p-4 shadow-2xl">
              <div>
                <h2 className="text-base font-semibold">Paste workflow JSON</h2>
                <p className="text-xs text-muted-foreground">Nodes and their joins, as copied from a workflow here or from n8n (the kinds this app has are converted; the rest are kept as notes). They are added to the canvas; nothing is saved until you press Save.</p>
              </div>
              <textarea aria-label="Workflow JSON" autoFocus rows={12} value={pasted} onChange={(e) => setPasted(e.target.value)} spellCheck={false} placeholder='{ "nodes": [ … ], "connections": { … } }' className="w-full resize-y rounded-lg border border-input bg-transparent p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setImporting(false)}>
                  Cancel
                </Button>
                <Button disabled={!pasted.trim()} onClick={() => { if (importJson(pasted)) { setImporting(false); setPasted('') } }}>
                  <ClipboardPaste /> Add to the canvas
                </Button>
              </div>
            </div>
          </div>
        )}
        {picker && tab === 'editor' && <NodePicker catalog={f.catalog} hasTrigger={hasTrigger} after={picker.after ? nodes.find((n) => n.id === picker.after!.id)?.data.node.name : undefined} onPick={(c) => addNode(c)} onClose={() => setPicker(null)} />}

        {current && tab !== 'settings' && tab !== 'try' && (
          <NodeDetails
            node={current}
            flow={f}
            ran={viewedRun ? ran[current.id] : undefined}
            feeding={feeding}
            tried={tried[current.id]}
            busy={busy === 'node'}
            canRun={!dirty && busy === null}
            confirm={confirmSend}
            readOnly={readOnly}
            onConfirm={setConfirmSend}
            onChange={(c) => patch(current.id, c)}
            onParams={setNodeParams}
            onRun={() => void runOne(current.id)}
            onExecutePrevious={() => void execute(false)}
            onDelete={() => remove(current.id)}
            onClose={() => setOpened(null)}
          />
        )}
      </div>
    </>
  )
}

/** What the agent runs on and where it is listed: its model, workspaces and instructions. */
function StudioSettings({ id, summaryName, description, custom, created, onReset, onDelete }: { id: string; summaryName: string; description: string; custom: boolean; created: boolean; onReset: () => void; onDelete: () => void }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 pb-16">
      <div>
        <h2 className="font-display text-2xl">{summaryName}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <ModelSection id={id} />
      <WorkspacesSection id={id} />
      <PromptEditor agentId={id} />
      <Section title="Workflow" description="Go back to how this agent worked before you changed it, or remove it.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!custom} onClick={onReset}>
            <RotateCcw /> Back to default workflow
          </Button>
          {created && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 /> Delete agent
            </Button>
          )}
        </div>
      </Section>
    </div>
  )
}
