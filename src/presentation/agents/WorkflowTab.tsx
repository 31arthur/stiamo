import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ChevronRight, Cpu, FileText, MessageSquare, Shield, Wrench, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { AgentGraph, GraphNode, ToolOverride } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { Link } from '@/presentation/routing'
import { ModelPicker } from './ModelPicker'
import { PromptEditor } from './PromptEditor'
import { WorkspaceChips } from './WorkspaceChips'
import { ago, formatMs, triggerLabel } from './format'
import { useAgentAction, useAgentDetail, useAgentSummary } from './useAgent'
import { traceOf } from './workflowTrace'
import type { NodeTrace } from './workflowTrace'

const ICON = { trigger: Zap, scope: Shield, prompt: FileText, model: Cpu, tool: Wrench, output: MessageSquare } as const
const DOT = { ok: 'bg-success', error: 'bg-destructive', skipped: 'bg-muted-foreground/30' } as const

/**
 * An agent as the nodes it is made of, the way a workflow editor shows it. The graph is the agent's real configuration, so editing a node edits
 * how the agent runs. Pick an execution and every node shows what it did in that run, with the data that went through it.
 */
export function WorkflowTab() {
  const { agentId } = useParams()
  const { agent } = useServices()
  const userId = useUserId()
  const [selected, setSelected] = useState<string>('prompt')
  const [runId, setRunId] = useState<string | null>(null)

  const graph = useQuery({ queryKey: ['agent', 'graph', userId, agentId], queryFn: () => agent.agentGraph(agentId!), enabled: !!agentId, retry: false })
  const runs = useQuery({ queryKey: ['agent', 'runs', userId, agentId, 'recent'], queryFn: () => agent.runs(agentId!), enabled: !!agentId, retry: false, refetchInterval: 15_000 })
  const run = useQuery({ queryKey: ['agent', 'run', userId, runId], queryFn: () => agent.run(runId!), enabled: !!runId, retry: false })

  if (graph.isLoading) return <Spinner label="Loading the workflow" />
  if (!graph.data) return <p role="alert" className="text-sm text-destructive">{graph.error instanceof Error ? graph.error.message : 'Couldn’t load the workflow.'}</p>
  const g = graph.data
  const trace = run.data ? traceOf(g, run.data) : null
  const node = g.nodes.find((n) => n.id === selected) ?? g.nodes[0]!
  const tools = g.nodes.filter((n) => n.type === 'tool')
  const chain = g.nodes.filter((n) => n.type !== 'tool')

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-4">
        <Section title="Workflow" description={trace ? 'This is one execution: every node shows what it did, and opens to the data that went through it.' : 'The nodes this agent runs through. Open one to edit it; the change applies the next time the agent runs.'}>
          <div className="grid gap-4">
            <ol className="flex flex-wrap items-stretch gap-y-2" aria-label="Workflow">
              {chain.map((n, i) => (
                <li key={n.id} className="flex items-center">
                  <NodeCard node={n} active={selected === n.id} trace={trace?.[n.id]} onOpen={() => setSelected(n.id)} />
                  {i < chain.length - 1 && <ChevronRight aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground/60" />}
                </li>
              ))}
            </ol>
            <div className="rounded-xl border border-dashed p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                <Wrench className="size-3.5" /> Tools the model can call · {tools.filter((t) => t.config.enabled !== false).length} of {tools.length} on
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {tools.map((n) => (
                  <li key={n.id}>
                    <NodeCard node={n} compact active={selected === n.id} trace={trace?.[n.id]} onOpen={() => setSelected(n.id)} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
        <Inspector graph={g} node={node} trace={trace?.[node.id]} />
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
          <Link to={`/agents/${g.agentId}/history`} className="mt-2 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Full history
          </Link>
        </Section>
      </aside>
    </div>
  )
}

function NodeCard({ node: n, active, trace, onOpen, compact }: { node: GraphNode; active: boolean; trace?: NodeTrace; onOpen: () => void; compact?: boolean }) {
  const Icon = ICON[n.type]
  const off = n.type === 'tool' && n.config.enabled === false
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      className={cn(
        'relative flex min-w-0 items-center gap-2 rounded-xl border bg-card text-left transition-colors',
        compact ? 'px-2 py-1 text-xs' : 'w-36 flex-col items-start px-3 py-2.5 text-sm sm:w-40',
        active ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40',
        (off || trace?.state === 'skipped') && 'opacity-50',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className={cn('shrink-0', compact ? 'size-3' : 'size-4 text-muted-foreground')} />
        <span className={cn('truncate font-medium', n.type === 'tool' && 'font-mono text-[11px]')}>{n.type === 'tool' ? n.label : n.label}</span>
      </span>
      {!compact && <span className="line-clamp-2 text-[11px] text-muted-foreground">{trace ? trace.summary : describe(n)}</span>}
      {trace && <span aria-label={trace.state} className={cn('absolute top-1.5 right-1.5 size-2 rounded-full', DOT[trace.state])} />}
      {compact && trace && trace.state !== 'skipped' && <span className="text-[10px] text-muted-foreground">{trace.summary}</span>}
      {off && <span className="text-[10px] text-muted-foreground">off</span>}
    </button>
  )
}

/** One line for a node with no execution picked. */
function describe(n: GraphNode): string {
  const c = n.config
  if (n.type === 'trigger') return (c.triggers as string[] | undefined)?.join(' · ') ?? ''
  if (n.type === 'scope') return ((c.workspaces as string[] | undefined) ?? []).join(', ') || 'No workspace'
  if (n.type === 'prompt') return `${String(c.system ?? '').length.toLocaleString()} characters of instructions`
  if (n.type === 'model') return (c.selection as { modelId?: string } | null)?.modelId ?? 'No model chosen yet'
  return 'The answer, cards and proposals'
}

function Inspector({ graph, node, trace }: { graph: AgentGraph; node: GraphNode; trace?: NodeTrace }) {
  const Icon = ICON[node.type]
  return (
    <Section title={node.type === 'tool' ? node.label : node.label} description={undefined} actions={<Icon className="size-4 text-muted-foreground" aria-hidden />}>
      <div className="grid gap-4">
        {trace && (
          <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <span className={cn('size-2 rounded-full', DOT[trace.state])} /> In this execution: {trace.state === 'skipped' ? 'not used' : trace.state === 'error' ? 'it failed' : 'it ran'} · {trace.summary}
            </p>
            {trace.data.map((d) => (
              <div key={d.label} className="grid gap-1">
                <h4 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{d.label}</h4>
                <pre className="max-h-56 overflow-auto rounded-lg border bg-background p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{d.text || '—'}</pre>
              </div>
            ))}
          </div>
        )}
        <NodeEditor graph={graph} node={node} />
      </div>
    </Section>
  )
}

function NodeEditor({ graph, node }: { graph: AgentGraph; node: GraphNode }) {
  const def = useAgentSummary(graph.agentId)
  const setWorkspaces = useAgentAction((a, w: string[]) => a.setWorkspaces(graph.agentId, w))
  if (!def) return null
  switch (node.type) {
    case 'trigger':
      return (
        <div className="grid gap-1.5 text-sm">
          <p className="text-muted-foreground">This agent starts when:</p>
          <ul className="grid gap-1">
            {(node.config.triggers as string[]).map((t) => (
              <li key={t} className="rounded-lg border px-2.5 py-1.5">
                {t}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Telegram and WhatsApp reach it through the master bot (<Link to="/assistant?phone=1" className="underline">On your phone</Link>), which picks the agent. {graph.agentId === 'daily-planner' && <>The evening schedule is set under <Link to={`/agents/${graph.agentId}`} className="underline">Overview</Link>.</>}
          </p>
        </div>
      )
    case 'scope':
      return (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">The workspaces this agent can be asked about. Whichever one a message is about, the run is limited to it: {String(node.config.rule)}</p>
          <WorkspaceChips value={def.workspaces} onChange={(w) => void setWorkspaces.run(w)} disabled={setWorkspaces.pending} />
        </div>
      )
    case 'prompt':
      return <PromptEditor agentId={graph.agentId} />
    case 'model':
      return (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">The provider, model and how hard it thinks. It may call up to {String(node.config.maxSteps)} tools per answer.</p>
          <ModelPicker def={def} />
        </div>
      )
    case 'tool':
      return <ToolEditor agentId={graph.agentId} node={node} />
    default:
      return (
        <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
          {(node.config.delivers as string[]).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )
  }
}

/** Switch a tool off, or change what the model is told it does. Stored as that agent's prompt settings, the same place the prompt editor uses. */
function ToolEditor({ agentId, node }: { agentId: string; node: GraphNode }) {
  const detail = useAgentDetail(agentId)
  const save = useAgentAction((a, v: { tools: Record<string, ToolOverride> }) => a.setPrompt(agentId, { ...detail.data!.prompt, tools: v.tools }), { success: 'Saved. It applies the next time the agent runs.' })
  const current = detail.data?.prompt.tools[node.label]
  const [text, setText] = useState<string | null>(null)
  if (!detail.data) return <Spinner label="Loading" />
  const enabled = current?.enabled ?? true
  const description = text ?? current?.description ?? String(node.config.default ?? '')
  const write = (next: ToolOverride) => {
    const tools = { ...detail.data!.prompt.tools, [node.label]: next }
    const kept = Object.fromEntries(Object.entries(tools).filter(([, t]) => !t.enabled || !!t.description?.trim()))
    return save.run({ tools: kept })
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        A tool from the <span className="font-mono">{node.pack}</span> pack. Switched off, the model isn’t told it exists.
      </p>
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={enabled} disabled={save.pending} onChange={(e) => void write({ enabled: e.target.checked, description: current?.description ?? null })} />
        On
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        What the model is told it does
        <textarea rows={4} value={description} onChange={(e) => setText(e.target.value)} className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={save.pending || text === null || text.trim() === String(node.config.default)} onClick={() => void write({ enabled, description: text?.trim() || null }).then(() => setText(null))}>
          Save description
        </Button>
        <Button size="sm" variant="ghost" disabled={save.pending || (current?.description == null && text === null)} onClick={() => void write({ enabled, description: null }).then(() => setText(null))}>
          Use the default
        </Button>
      </div>
    </div>
  )
}
