import '@xyflow/react/dist/style.css'
import { Background, BackgroundVariant, Handle, MiniMap, Panel, Position, ReactFlow, useReactFlow } from '@xyflow/react'
import type { Connection, Edge, EdgeChange, Node, NodeChange, NodeProps } from '@xyflow/react'
import { AlertTriangle, BellRing, Bot, Inbox, Sparkle, CalendarPlus, Check, ScanText, ShieldCheck, Tags, Trash2, Clock, Database, GitBranch, Maximize, MessageSquare, Pin, Plus, Send, Sparkles, StickyNote, Zap, ZoomIn, ZoomOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AgentFlow, FlowNode, FlowTrace } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { fromEdges, handleIn, handleOut, inputsOf, outputsOf, toEdges } from '../flowModel'

export type Ran = FlowTrace & { runs: number }
export type CanvasNode = Node<{ node: FlowNode; ran?: Ran; running?: boolean; open: number[]; onAdd?: (id: string, lane: number) => void; /** The model an AI node thinks with (its own, or the agent's), and what to do when its slot is pressed. */ model?: { label: string; own: boolean }; onModel?: (id: string) => void }, 'flow'>

const GROUP_ICON: Record<string, LucideIcon> = { trigger: Zap, core: GitBranch, data: Database, msg: Send, ai: Sparkles, respond: MessageSquare }
export const iconOf = (type: string): LucideIcon => (type === 'trigger.schedule' ? Clock : type === 'msg.trash' ? Trash2 : type === 'core.safe_senders' ? ShieldCheck : type === 'msg.alert' ? BellRing : type === 'msg.attention' ? Inbox : type === 'core.only_new' ? Sparkle : type === 'msg.event' ? CalendarPlus : type === 'ai.classify' ? Tags : type === 'ai.read' ? ScanText : type === 'trigger.telegram' || type === 'msg.telegram' ? Send : type === 'trigger.orchestrator' ? Bot : type === 'core.note' ? StickyNote : (GROUP_ICON[type.split('.')[0]!] ?? Bot))

/** The colour of a node's tile, by what kind of node it is (as n8n does it). */
export const TONE: Record<string, string> = {
  trigger: 'text-orange-500',
  core: 'text-teal-600 dark:text-teal-400',
  data: 'text-blue-600 dark:text-blue-400',
  msg: 'text-green-600 dark:text-green-400',
  ai: 'text-violet-600 dark:text-violet-400',
  respond: 'text-pink-600 dark:text-pink-400',
}
export const toneOf = (type: string) => (type === 'msg.telegram' || type === 'trigger.telegram' ? 'text-sky-500' : (TONE[type.split('.')[0]!] ?? 'text-foreground'))

const sum = (ran?: Ran) => (ran?.outputs ?? []).reduce((a, b) => a + b, 0)

/** One node, drawn as n8n draws it: a tile with its icon, the name under it, inputs on the left and outputs on the right. */
function StudioNode({ data, selected }: NodeProps<CanvasNode>) {
  const { node, ran, running, open, onAdd, model, onModel } = data
  const Icon = iconOf(node.type)
  const outs = outputsOf(node)
  const ins = inputsOf(node.type)
  const lanes = Math.max(outs.length, ins, 1)
  const height = Math.max(64, lanes * 26 + 12)
  const spread = (i: number, n: number) => `${((i + 1) / (n + 1)) * 100}%`
  const trigger = node.type.startsWith('trigger.')

  if (node.type === 'core.note') {
    return (
      <div className={cn('w-56 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-xs whitespace-pre-wrap shadow-xs', selected && 'ring-2 ring-foreground/60')}>
        <p className="mb-0.5 flex items-center gap-1 font-semibold">
          <StickyNote className="size-3" /> {node.name}
        </p>
        {String(node.parameters.text ?? '')}
      </div>
    )
  }

  return (
    <div className="group relative flex w-24 flex-col items-center">
      <div
        style={{ height }}
        className={cn(
          'relative flex w-16 items-center justify-center border bg-card shadow-xs transition-shadow',
          trigger ? 'rounded-l-[2rem] rounded-r-xl' : 'rounded-xl',
          selected ? 'border-foreground ring-2 ring-foreground/30' : 'group-hover:border-foreground/40 group-hover:shadow-md',
          node.disabled && 'opacity-45',
          running && 'animate-pulse border-orange-500 ring-4 ring-orange-500/30',
          ran?.state === 'error' ? 'border-destructive ring-2 ring-destructive/30' : ran?.state === 'ok' && !selected && 'border-success',
        )}
      >
        {trigger && <Zap aria-hidden className="absolute -top-2 -left-2 size-4 fill-orange-400 text-orange-500" />}
        <Icon className={cn('size-7', toneOf(node.type), node.disabled && 'grayscale')} strokeWidth={1.6} />
        {node.pinData && <Pin aria-label="Pinned data" className="absolute -top-2 -right-2 size-4 rotate-45 fill-warning text-warning" />}
        {ran && (
          <span aria-label={ran.state} className={cn('absolute -right-2 -bottom-2 flex size-5 items-center justify-center rounded-full text-white', ran.state === 'ok' ? 'bg-success' : 'bg-destructive')}>
            {ran.state === 'ok' ? <Check className="size-3" strokeWidth={3} /> : <AlertTriangle className="size-3" />}
          </span>
        )}
        {Array.from({ length: ins }, (_, i) => (
          <Handle key={i} id={handleIn(i)} type="target" position={Position.Left} style={{ top: spread(i, ins) }} className="!size-2.5 !border-2 !border-card !bg-muted-foreground" />
        ))}
        {outs.map((label, i) => (
          <Handle key={i} id={handleOut(i)} type="source" position={Position.Right} style={{ top: spread(i, outs.length) }} className="!size-2.5 !border-2 !border-card !bg-foreground">
            {label && <span className="pointer-events-none absolute left-3 -translate-y-1/2 text-[10px] whitespace-nowrap text-muted-foreground">{label}</span>}
            {open.includes(i) && onAdd && (
              <span className="nodrag nopan absolute left-full flex -translate-y-1/2 items-center" style={{ marginLeft: label ? Math.min(label.length * 5.5 + 12, 70) : 0 }}>
                <span className="h-px w-5 bg-muted-foreground/60" />
                <button type="button" aria-label={`Add a node after ${node.name}${outs.length > 1 ? ` (${label || i + 1})` : ''}`} onClick={(e) => { e.stopPropagation(); onAdd(node.id, i) }} className="flex size-6 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-xs transition-colors hover:border-foreground hover:text-foreground">
                  <Plus className="size-3.5" />
                </button>
              </span>
            )}
          </Handle>
        ))}
      </div>
      <p className="mt-1.5 max-w-full text-center text-[11px] leading-tight font-medium break-words">{node.name}</p>
      <p className="max-w-full text-center text-[10px] leading-tight text-muted-foreground">{ran ? `${sum(ran)} item${sum(ran) === 1 ? '' : 's'} · ${ran.ms} ms${ran.runs > 1 ? ` · ×${ran.runs}` : ''}` : node.type.split('.')[1]}</p>
      {node.type === 'ai.agent' && model && (
        <div className="nodrag nopan mt-1 flex flex-col items-center">
          <span className="h-5 border-l border-dashed border-muted-foreground/60" />
          <span className="-mt-px size-2 rotate-45 border border-muted-foreground/60 bg-card" />
          <span className="text-[9px] leading-none text-muted-foreground">Chat model</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onModel?.(node.id) }} aria-label={`Chat model of ${node.name}: ${model.label}. Change`} title="Change the model" className={cn('mt-1 flex size-11 items-center justify-center rounded-full border bg-card shadow-xs transition-colors hover:border-foreground', model.own ? 'border-violet-400' : 'border-dashed')}>
            <Sparkles className="size-4 text-violet-600 dark:text-violet-400" strokeWidth={1.7} />
          </button>
          <span className="mt-1 max-w-24 truncate text-center text-[10px] leading-tight text-muted-foreground" title={model.label}>{model.label}</span>
        </div>
      )}
    </div>
  )
}
const nodeTypes = { flow: StudioNode }

export const round = (n: number) => Math.round(n)
export const docOf = (nodes: CanvasNode[], edges: Edge[]) => ({
  nodes: nodes.map((n) => ({ ...n.data.node, position: [round(n.position.x), round(n.position.y)] as [number, number] })),
  connections: fromEdges(
    nodes.map((n) => n.data.node),
    edges.map((e) => ({ source: e.source, sourceHandle: e.sourceHandle ?? handleOut(0), target: e.target, targetHandle: e.targetHandle ?? handleIn(0) })),
  ),
})
export const canvasOf = (flow: Pick<AgentFlow, 'nodes' | 'connections'>): { nodes: CanvasNode[]; edges: Edge[] } => ({
  nodes: flow.nodes.map((node) => ({ id: node.id, type: 'flow', position: { x: node.position[0], y: node.position[1] }, data: { node, open: [] } })),
  edges: toEdges(flow.connections),
})
export const edgeId = (c: { source: string; sourceHandle: string; target: string; targetHandle: string }) => `${c.source}:${c.sourceHandle.split('-')[1]}:${c.target}:${c.targetHandle.split('-')[1]}`

/** The output lanes of each node that lead nowhere yet: they get a "+" to add the next step. */
export function openLanes(nodes: CanvasNode[], edges: Edge[]): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const n of nodes) {
    const lanes = outputsOf(n.data.node).length
    out[n.id] = Array.from({ length: lanes }, (_, i) => i).filter((i) => !edges.some((e) => e.source === n.id && (e.sourceHandle ?? handleOut(0)) === handleOut(i)))
  }
  return out
}

const BTN = 'flex size-9 items-center justify-center rounded-lg border bg-card text-foreground shadow-xs transition-colors hover:bg-muted disabled:opacity-50'

/** The canvas that takes the screen: the grid, the zoom buttons bottom left, a map on a computer, and whatever else is put on it. */
export function StudioCanvas({ nodes, edges, readOnly, onNodesChange, onEdgesChange, onConnect, onOpen, onPane, onDragStart, children }: { nodes: CanvasNode[]; edges: Edge[]; readOnly?: boolean; onNodesChange?: (c: NodeChange<CanvasNode>[]) => void; onEdgesChange?: (c: EdgeChange[]) => void; onConnect?: (c: Connection) => void; onOpen: (id: string) => void; onPane?: () => void; onDragStart?: (e: MouseEvent | TouchEvent, n: CanvasNode, all: CanvasNode[]) => void; children?: ReactNode }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDoubleClick={(_, n) => onOpen(n.id)}
      onNodeClick={(_, n) => { if (readOnly) onOpen(n.id) }}
      onPaneClick={onPane}
      onNodeDragStart={onDragStart}
      multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
      selectionOnDrag={false}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable
      fitView
      fitViewOptions={{ padding: 0.35, maxZoom: 1.1 }}
      minZoom={0.2}
      maxZoom={2}
      deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
      defaultEdgeOptions={{ style: { strokeWidth: 1.6 } }}
      colorMode="system"
      proOptions={{ hideAttribution: true }}
      className="!bg-muted/30 [&_.react-flow\_\_pane]:!cursor-default [&_.react-flow\_\_pane.dragging]:!cursor-grabbing [&_.react-flow\_\_node]:!cursor-pointer"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
      <MiniMap pannable zoomable className="!hidden md:!block" />
      <ZoomBar />
      {children}
    </ReactFlow>
  )
}

function ZoomBar() {
  const rf = useReactFlow()
  return (
    <Panel position="bottom-left" className="flex gap-2">
      <button type="button" aria-label="Fit the workflow to the screen" title="Fit to screen" className={BTN} onClick={() => void rf.fitView({ padding: 0.35, maxZoom: 1.1, duration: 200 })}>
        <Maximize className="size-4" />
      </button>
      <button type="button" aria-label="Zoom in" title="Zoom in" className={BTN} onClick={() => void rf.zoomIn({ duration: 150 })}>
        <ZoomIn className="size-4" />
      </button>
      <button type="button" aria-label="Zoom out" title="Zoom out" className={BTN} onClick={() => void rf.zoomOut({ duration: 150 })}>
        <ZoomOut className="size-4" />
      </button>
    </Panel>
  )
}

export { BTN as CANVAS_BUTTON }
