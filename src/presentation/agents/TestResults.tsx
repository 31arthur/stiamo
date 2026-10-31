import { cn } from '@/lib/utils'
import type { DecisionItem, WorkflowRun } from '@/domain/ai/AgentApi'
import { compact, formatMs } from './format'

const STATUS: Record<DecisionItem['status'], { text: string; tone: string }> = {
  proposed: { text: 'Proposed', tone: 'bg-success/12 text-success' },
  needs_review: { text: 'Needs review', tone: 'bg-warning/15 text-warning' },
  failed: { text: 'Failed', tone: 'bg-destructive/10 text-destructive' },
  kept: { text: 'Kept', tone: 'bg-muted text-muted-foreground' },
  applied: { text: 'Moved to Trash', tone: 'bg-success/12 text-success' },
}

/** What a test or a run did, item by item: the label it chose, how sure it was, and why. */
export function TestResults({ run }: { run: WorkflowRun }) {
  const { counts } = run
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          <b className="tabular-nums">{counts.items}</b> item{counts.items === 1 ? '' : 's'}
        </span>
        <span className="text-success">
          <b className="tabular-nums">{counts.proposed}</b> proposed
        </span>
        <span className={counts.needsReview ? 'text-warning' : 'text-muted-foreground'}>
          <b className="tabular-nums">{counts.needsReview}</b> to review
        </span>
        {!!counts.kept && (
          <span className="text-muted-foreground">
            <b className="tabular-nums">{counts.kept}</b> kept
          </span>
        )}
        {!!counts.applied && (
          <span className="text-success">
            <b className="tabular-nums">{counts.applied}</b> moved to Trash
          </span>
        )}
        {!!counts.protected && (
          <span className="text-muted-foreground" title="Mail the rules always keep: it is not judged.">
            <b className="tabular-nums">{counts.protected}</b> protected
          </span>
        )}
        {counts.failed > 0 && (
          <span className="text-destructive">
            <b className="tabular-nums">{counts.failed}</b> failed
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatMs(run.durationMs)}
          {(run.usage.inputTokens || run.usage.outputTokens) > 0 && ` · ${compact(run.usage.inputTokens)} in, ${compact(run.usage.outputTokens)} out`}
        </span>
      </div>

      {run.matched > counts.items && (
        <p className="text-xs text-muted-foreground">
          {run.matched} matched the filters; the first {counts.items} were looked at.
        </p>
      )}
      {counts.items === 0 && <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">Nothing new to look at: every matching item was decided before, or none matched the filters.</p>}

      <ul className="grid gap-1.5">
        {run.items.map((it) => (
          <li key={it.id}>
            <details className="group rounded-xl border bg-card/80">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{it.error ?? it.reason ?? it.excerpt}</span>
                </span>
                {it.label && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">{it.label}</span>}
                {it.status !== 'failed' && (
                  <span className="hidden w-16 shrink-0 sm:block" title={`${Math.round(it.confidence * 100)}% sure`}>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.round(it.confidence * 100)}%` }} />
                    </span>
                    <span className="block text-right text-[10px] text-muted-foreground tabular-nums">{Math.round(it.confidence * 100)}%</span>
                  </span>
                )}
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[it.status].tone)}>{it.action === 'trash' && it.status === 'proposed' ? (run.mode === 'test' ? 'Would move to Trash' : 'Waits for approval') : STATUS[it.status].text}</span>
              </summary>
              <div className="grid gap-2 border-t px-3 py-2.5 text-xs">
                {it.reason && (
                  <p>
                    <span className="font-semibold tracking-widest text-muted-foreground uppercase">Why </span>
                    {it.reason}
                  </p>
                )}
                {it.error && <p className="text-destructive">{it.error}</p>}
                <pre className="max-h-40 overflow-auto rounded-lg bg-muted/60 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">{it.excerpt}</pre>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}
