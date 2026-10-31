import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Sweep } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { ago } from './format'
import { useSweep } from './useAgent'

const n = (v: number) => v.toLocaleString()

/**
 * How a run through the whole inbox is going. It runs on the server, so this only shows it: leaving the page, refreshing or closing
 * the browser doesn't stop it, and coming back shows where it has got to.
 */
export function SweepPanel({ agentId, compact = false }: { agentId: string; compact?: boolean }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const { data: sweep } = useSweep(agentId)
  if (!sweep) return null

  const running = sweep.state === 'running'
  const total = sweep.judged + (sweep.remaining ?? 0)
  const percent = total > 0 ? Math.round((sweep.judged / total) * 100) : running ? 0 : 100
  // A finished one is only worth a line, and not for ever.
  if (!running && compact) return null

  async function stop() {
    try {
      await agent.stopSweep(agentId)
      await client.invalidateQueries({ queryKey: ['agent', 'sweep'] })
    } catch (e) {
      toast.error('Couldn’t stop it', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="grid gap-2 rounded-xl border px-3.5 py-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {running && <Spinner size="xs" tone="current" decorative />}
        <span className="min-w-0 flex-1">
          {running ? (
            sweep.stopRequested ? (
              <>Stopping after this batch… <b className="tabular-nums">{n(sweep.judged)}</b> judged so far</>
            ) : (
              <>
                Running through the whole inbox: <b className="tabular-nums">{n(sweep.judged)}</b> judged, <b className="tabular-nums">{n(sweep.remaining ?? 0)}</b> to go
              </>
            )
          ) : (
            <Finished sweep={sweep} />
          )}
        </span>
        {running ? (
          <Button size="sm" variant="outline" onClick={() => void stop()} disabled={sweep.stopRequested}>
            <Square /> Stop
          </Button>
        ) : (
          <Link to={`/agents/${agentId}/executions`} className="flex items-center gap-1 text-sm font-medium hover:underline">
            See the runs <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {running && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full bg-foreground/70 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Batch {sweep.runs + 1}
            {sweep.moved > 0 && <> · {n(sweep.moved)} moved to Trash</>}
            {sweep.toReview > 0 && <> · {n(sweep.toReview)} to review</>}
            {sweep.protected > 0 && <> · {n(sweep.protected)} protected</>}. It keeps going on the server: you can leave this page.
          </p>
        </>
      )}
    </div>
  )
}

function Finished({ sweep }: { sweep: Sweep }) {
  const what = `${n(sweep.judged)} email${sweep.judged === 1 ? '' : 's'} judged in ${sweep.runs} run${sweep.runs === 1 ? '' : 's'}${sweep.moved ? `, ${n(sweep.moved)} moved to Trash` : ''}${sweep.toReview ? `, ${n(sweep.toReview)} to review` : ''}`
  if (sweep.state === 'failed') return <span className="text-destructive">Stopped by a problem{sweep.finishedAt ? ` ${ago(sweep.finishedAt)}` : ''}: {sweep.error}. {what}.</span>
  const rest = sweep.remaining ? `, ${n(sweep.remaining)} still to go` : ''
  return (
    <span>
      {sweep.state === 'stopped' ? 'Stopped' : 'Finished'}
      {sweep.finishedAt ? ` ${ago(sweep.finishedAt)}` : ''}: {what}
      {rest}.
    </span>
  )
}

/**
 * Says when a background run ends, and keeps the lists on the page up to date while it goes. It sits in the agent's layout, so it
 * works from whichever tab you are on.
 */
export function SweepWatcher({ agentId, name }: { agentId: string; name: string }) {
  const client = useQueryClient()
  const { data: sweep } = useSweep(agentId)
  const seen = useRef<{ id: string; state: string } | null>(null)

  useEffect(() => {
    if (!sweep) return
    const before = seen.current
    seen.current = { id: sweep.id, state: sweep.state }
    // Each batch that finishes adds an execution, changes the counts and the review queue.
    if (sweep.state === 'running' || before?.state === 'running') {
      for (const key of ['executions', 'execution', 'review', 'workflow', 'usage', 'usage-runs', 'stats']) void client.invalidateQueries({ queryKey: ['agent', key] })
    }
    // Only a change that happened while this page was watching is announced: not one that ended long ago.
    if (before?.id === sweep.id && before.state === 'running' && sweep.state !== 'running') {
      const what = `${n(sweep.judged)} email${sweep.judged === 1 ? '' : 's'} judged in ${sweep.runs} run${sweep.runs === 1 ? '' : 's'}${sweep.moved ? `, ${n(sweep.moved)} moved to Trash` : ''}${sweep.toReview ? `, ${n(sweep.toReview)} to review` : ''}.`
      if (sweep.state === 'failed') toast.error(`${name} stopped: ${sweep.error ?? 'something went wrong'}`, { description: what })
      else toast.success(`${name} ${sweep.state === 'stopped' ? 'stopped' : 'finished the whole inbox'}`, { description: what })
    }
  }, [sweep, client, name])

  return null
}
