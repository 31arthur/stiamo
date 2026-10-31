import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ArrowRight, KeyRound, ListChecks, Play, Square, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { WorkflowRun } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { useMailAccounts } from '@/presentation/mail/useMail'
import { toast } from '@/presentation/notifications/toast'
import { announce, announceFailure } from './announce'
import { TestResults } from './TestResults'
import { useWorkflow } from './useAgent'
import { TABLE_LABELS } from './workflowTemplates'

const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** Try the agent on a sample, or run it for real and send what it decided to the review queue. */
export function WorkflowRunTab() {
  const { agentId } = useParams()
  const { agent } = useServices()
  const client = useQueryClient()
  const { data: w, isLoading } = useWorkflow(agentId)
  const [manual, setManual] = useState('')
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'test' | 'run' | null>(null)
  const { accounts } = useMailAccounts()
  const stop = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const [sweep, setSweep] = useState<{ runs: number; judged: number; remaining: number } | null>(null)

  if (isLoading || !w) return <Spinner label="Loading" />
  const cfg = w.config
  const pasted = cfg.source.kind === 'manual'

  /** Runs again and again, a batch each time, until nothing is left in the range, you stop it, or something goes wrong. */
  async function sweepAll() {
    setConfirming(false)
    stop.current = false
    setBusy('run')
    setError(null)
    let runs = 0
    let judged = 0
    let moved = 0
    let protectedCount = 0
    try {
      for (; runs < 200 && !stop.current; ) {
        const result = await agent.runWorkflow(w!.id, undefined)
        runs++
        judged += result.counts.items
        moved += result.counts.applied ?? 0
        protectedCount += result.counts.protected ?? 0
        setRun(result)
        announce(w!.name, 'test', result) // only its warnings: the sweep reports once, at the end
        setSweep({ runs, judged, remaining: result.stats?.remaining ?? 0 })
        if (!result.stats?.remaining || result.counts.items === 0 || result.counts.failed === result.counts.items) break
      }
      toast.success(`${w!.name} ${stop.current ? 'stopped' : 'finished'}`, { description: `${judged} email${judged === 1 ? '' : 's'} judged in ${runs} run${runs === 1 ? '' : 's'}${moved ? `, ${moved} moved to Trash` : ''}${protectedCount ? `, ${protectedCount} kept by your rules` : ''}.` })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It didn’t run.')
      announceFailure(w!.name, 'run', e)
    } finally {
      setBusy(null)
      setSweep(null)
      for (const key of ['stats', 'runs', 'review', 'workflow']) void client.invalidateQueries({ queryKey: ['agent', key] })
    }
  }

  async function go(mode: 'test' | 'run') {
    setBusy(mode)
    setError(null)
    try {
      const result = await (mode === 'test' ? agent.testWorkflow(w!.id, pasted ? manual : undefined) : agent.runWorkflow(w!.id, pasted ? manual : undefined))
      setRun(result)
      announce(w!.name, mode, result)
    } catch (e) {
      setRun(null)
      setError(e instanceof Error ? e.message : 'It didn’t run.')
      announceFailure(w!.name, mode, e)
    } finally {
      setBusy(null)
      // Both leave a line in the history; a run also fills the review queue.
      for (const key of ['stats', 'runs', 'review', 'workflow']) void client.invalidateQueries({ queryKey: ['agent', key] })
    }
  }

  return (
    <div className="grid gap-4">
      <Section
        title="Reads"
        description={
          pasted
            ? 'Text you paste here each time. Separate items with a line of ---.'
            : cfg.source.kind === 'mail'
              ? `${(cfg.source.accountIds ?? []).map((id) => accounts.find((a) => a.id === id)?.label ?? 'a mailbox').join(', ')}: the inbox, newest first${cfg.filters.sinceDays ? `, from the last ${cfg.filters.sinceDays} days` : ''}${cfg.filters.newOnly ? ', skipping mail it has judged before' : ''}. Up to ${cfg.filters.limit} new messages per run. It runs only when you press Run now, never on its own.`
              : `${TABLE_LABELS[cfg.source.table ?? ''] ?? cfg.source.table}${cfg.filters.sinceDays ? `, created or changed in the last ${cfg.filters.sinceDays} days` : ''}${cfg.filters.contains ? `, containing “${cfg.filters.contains}”` : ''}${cfg.filters.newOnly ? ', skipping items it has decided before' : ''}. Up to ${cfg.filters.limit}.`
        }
      >
        <div className="grid gap-3">
          {pasted && <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={7} placeholder={'Paste the items to sort.\nSeparate them with a line of ---'} aria-label="Items" className={AREA} />}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void go('test')} disabled={busy !== null || (pasted && !manual.trim())}>
              {busy === 'test' ? <Spinner size="xs" tone="current" decorative /> : <Play />} Test run
            </Button>
            <Button onClick={() => void go('run')} disabled={busy !== null || (pasted && !manual.trim())}>
              {busy === 'run' ? <Spinner size="xs" tone="current" decorative /> : <Zap />} Run now
            </Button>
            {cfg.source.kind === 'mail' && (
              <Button variant="outline" onClick={() => setConfirming(true)} disabled={busy !== null || confirming}>
                <ListChecks /> Run through the whole inbox
              </Button>
            )}
            <span className="text-xs text-muted-foreground">A test looks at up to 20 items and keeps nothing. Running keeps each decision in Review.</span>
          </div>
          {confirming && (
            <div role="alert" className="grid gap-2 rounded-xl border bg-muted/40 px-3.5 py-3 text-sm">
              <p>
                This runs again and again, {cfg.filters.limit} emails at a time, until everything in range has been judged. Run it for real: it records each decision
                {cfg.action?.auto && cfg.action.trashLabel ? `, and moves emails labelled ${cfg.action.trashLabel} to Trash as it goes` : cfg.action?.trashLabel ? ', and leaves the emails to move for your approval in Review' : ''}. You can stop it at any time.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void sweepAll()}>
                  <Zap /> Start
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {sweep && (
            <div className="grid gap-1.5 rounded-xl border px-3.5 py-3" aria-live="polite">
              <div className="flex items-center gap-2 text-sm">
                <Spinner size="xs" tone="current" decorative />
                <span className="flex-1">
                  Run {sweep.runs}: <b className="tabular-nums">{sweep.judged}</b> judged so far, <b className="tabular-nums">{sweep.remaining}</b> to go
                </span>
                <Button size="sm" variant="outline" onClick={() => (stop.current = true)}>
                  <Square /> Stop
                </Button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70 transition-all" style={{ width: `${Math.round((sweep.judged / Math.max(1, sweep.judged + sweep.remaining)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </Section>

      {error && (
        <div role="alert" className="grid gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
          {/choose a provider|add an openrouter key/i.test(error) && (
            <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<Link to={/openrouter/i.test(error) ? '/agents/settings' : `/agents/${w.id}/settings`} />}>
              <KeyRound /> {/openrouter/i.test(error) ? 'Providers' : 'Settings'}
            </Button>
          )}
        </div>
      )}

      {run && (
        <Section title={run.mode === 'test' ? 'Test result' : 'Run result'} actions={run.mode === 'run' && run.counts.proposed + run.counts.needsReview > 0 ? <ReviewLink id={w.id} /> : undefined}>
          <TestResults run={run} />
        </Section>
      )}
    </div>
  )
}

function ReviewLink({ id }: { id: string }) {
  return (
    <Link to={`/agents/${id}/review`} className="flex items-center gap-1 text-sm font-medium hover:underline">
      Review them <ArrowRight className="size-3.5" />
    </Link>
  )
}
