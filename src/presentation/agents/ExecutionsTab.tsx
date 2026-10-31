import { format, parseISO } from 'date-fns'
import { useParams } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Execution } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { EmptyState, Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { ago, formatMs } from './format'
import { useExecutions } from './useAgent'

/** Every time the agent was run for real: when, how much it read and judged, and what became of it. Open one to see the emails. */
export function ExecutionsTab() {
  const { agentId } = useParams()
  const { data, isLoading, error } = useExecutions(agentId)

  if (isLoading) return <Spinner label="Loading" />
  if (error) return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the executions.'}</p>
  if (!data?.length) {
    return (
      <Section>
        <EmptyState
          title="No executions yet"
          action={
            <Button nativeButton={false} render={<Link to={`/agents/${agentId}/run`} />}>
              <Play /> Go to Run
            </Button>
          }
        >
          Each time you press Run now, the run is kept here with how many emails it read and judged, and every decision it made.
        </EmptyState>
      </Section>
    )
  }

  return (
    <ul className="grid gap-2">
      {data.map((e) => (
        <li key={e.id}>
          <Row execution={e} agentId={agentId!} />
        </li>
      ))}
    </ul>
  )
}

function Row({ execution: e, agentId }: { execution: Execution; agentId: string }) {
  const judged = e.counts.items ?? 0
  const waiting = (e.now.needs_review ?? 0) + (e.now.proposed ?? 0)
  const chips: { label: string; n: number; tone: string }[] = [
    { label: 'to review', n: e.now.needs_review ?? 0, tone: 'bg-warning/15 text-warning' },
    { label: 'waiting to move', n: e.now.proposed ?? 0, tone: 'bg-warning/15 text-warning' },
    { label: 'moved to Trash', n: (e.now.applied ?? 0) + (e.now.approved ?? 0), tone: 'bg-success/12 text-success' },
    { label: 'kept', n: e.now.kept ?? 0, tone: 'bg-muted text-muted-foreground' },
    { label: 'protected', n: e.now.protected ?? 0, tone: 'bg-muted text-muted-foreground' },
    { label: 'dismissed', n: e.now.dismissed ?? 0, tone: 'bg-muted text-muted-foreground' },
    { label: 'failed', n: e.counts.failed ?? 0, tone: 'bg-destructive/10 text-destructive' },
  ].filter((c) => c.n > 0)
  const s = e.stats

  return (
    <Link to={`/agents/${agentId}/executions/${e.id}`} className="group grid gap-2.5 rounded-2xl border bg-card/80 p-4 transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-float">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{format(parseISO(e.startedAt), 'd MMM yyyy, p')}</span>
            <span className="text-xs text-muted-foreground">{ago(e.startedAt)}</span>
            {e.status === 'error' && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Failed</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{judged}</b> email{judged === 1 ? '' : 's'} judged
            {s.scanned != null && <> · {s.scanned} read</>}
            {s.inRange != null && s.inRange > 0 && <> of {s.inRange} in range</>}
            {!!s.remaining && <> · {s.remaining} still to go</>}
          </p>
        </div>
        {waiting > 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">{waiting} to look at</span>}
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {chips.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.label} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', c.tone)}>
              <b className="tabular-nums">{c.n}</b> {c.label}
            </span>
          ))}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {formatMs(e.durationMs)}
        {s.model ? ` · ${s.model}` : ''}
        {s.requests ? ` · ${s.requests} request${s.requests === 1 ? '' : 's'}` : ''}
        {s.cost ? ` · $${s.cost.toFixed(s.cost < 0.01 ? 5 : 3)}` : ''}
      </p>
    </Link>
  )
}
