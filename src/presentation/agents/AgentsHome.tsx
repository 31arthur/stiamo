import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, ChevronRight, Plus, Workflow } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { PageHeader } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { ago, compact } from './format'
import { useAgentStats, useScopedAgents } from './useAgent'

/** The agents of the workspace you are in (all of them under "All workspaces"): what each is for, and how it has been doing. */
export function AgentsHome() {
  const { scope, agents, all, loading } = useScopedAgents()
  const here = scope === 'all' ? null : WORKSPACES[scope]
  const elsewhere = here ? all.filter((a) => !a.workspaces.includes(scope)) : []
  const [adding, setAdding] = useState(false)

  return (
    <>
      <PageHeader
        eyebrow={here ? here.name : 'All workspaces'}
        title="Agents"
        description={here ? `The agents that work in ${here.short}. Add one you already have, or build a new one for it.` : 'Every agent you have. Each has its own model, prompt, channels and history; open one to see how it has been doing.'}
        actions={
          <Button nativeButton={false} render={<Link to="/agents/new" />}>
            <Plus /> New agent
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Loading" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <li key={a.id}>
              <AgentCard agent={a} />
            </li>
          ))}
          {here && elsewhere.length > 0 && (
            <li>
              <button type="button" onClick={() => setAdding(true)} className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-4 text-center text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                <Plus className="size-5" />
                <span className="text-sm font-medium">Add an agent you have</span>
                <span className="text-xs">
                  {elsewhere.length} not in {here.short} yet
                </span>
              </button>
            </li>
          )}
          {agents.length === 0 && (!here || elsewhere.length === 0) && (
            <li className="md:col-span-2 xl:col-span-3">
              <div className="rounded-2xl border-2 border-dashed px-6 py-10 text-center">
                <p className="font-display text-2xl italic">{here ? `No agents in ${here.short} yet` : 'No agents yet'}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Build one that sorts your tasks, cases or messages, and see its decisions here.</p>
              </div>
            </li>
          )}
        </ul>
      )}
      {here && <AddExisting open={adding} onOpenChange={setAdding} scope={scope as WorkspaceId} agents={elsewhere} />}
    </>
  )
}

function AgentCard({ agent }: { agent: AgentSummary }) {
  const stats = useAgentStats(agent.id)
  const s = stats.data
  const last = s?.lastRun
  return (
    <Link to={`/agents/${agent.id}`} className="group flex h-full flex-col gap-3 rounded-2xl border bg-card/80 p-4 transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-float">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">{agent.kind === 'workflow' ? <Workflow className="size-5" /> : <Bot className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{agent.name}</h2>
          <p className="line-clamp-2 text-sm text-muted-foreground">{agent.description}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Last called</dt>
          <dd className="font-medium">{last ? ago(last.startedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Runs, 30 days</dt>
          <dd className="font-medium tabular-nums">{s ? compact(s.runs) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Model</dt>
          <dd className={cn('truncate font-medium', !agent.selection && 'text-warning')}>{agent.selection?.modelId || 'Not chosen'}</dd>
        </div>
      </dl>
    </Link>
  )
}

/** Put agents you already have into this workspace. */
function AddExisting({ open, onOpenChange, scope, agents }: { open: boolean; onOpenChange: (o: boolean) => void; scope: WorkspaceId; agents: AgentSummary[] }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  async function add(a: AgentSummary) {
    setBusy(a.id)
    try {
      await agent.setWorkspaces(a.id, [...a.workspaces, scope])
      await client.invalidateQueries({ queryKey: ['agent'] })
      toast.success(`${a.name} added to ${WORKSPACES[scope].short}`)
      if (agents.length <= 1) onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t add it')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Add to {WORKSPACES[scope].short}</DialogTitle>
          <DialogDescription>An agent can work in several workspaces. It stays wherever it already is.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1.5">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">{a.kind === 'workflow' ? <Workflow className="size-4" /> : <Bot className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="truncate text-xs text-muted-foreground">{a.workspaces.length ? `In ${a.workspaces.map((w) => WORKSPACES[w as WorkspaceId]?.short ?? w).join(', ')}` : 'In no workspace yet'}</div>
              </div>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void add(a)}>
                {busy === a.id ? <Spinner size="xs" tone="current" decorative /> : <Plus />} Add
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
