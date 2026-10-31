import { Bot, ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { ago, compact } from './format'
import { useAgentSettings, useAgentStats } from './useAgent'

/** Every agent at a glance: what it is for, whether it has a model, and how it has been doing. */
export function AgentsHome() {
  const { settings } = useAgentSettings()
  return (
    <>
      <PageHeader eyebrow="All workspaces" title="Agents" description="Each agent has its own model, prompt, channels and history. Open one to see how it has been doing and to change how it works." />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settings?.agents.map((a) => (
          <li key={a.id}>
            <AgentCard agent={a} />
          </li>
        )) ?? <Spinner label="Loading" />}
      </ul>
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Bot className="size-5" />
        </span>
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
