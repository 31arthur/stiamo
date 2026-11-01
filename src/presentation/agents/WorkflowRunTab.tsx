import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ArrowRight, KeyRound, ListChecks, Play, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { WorkflowRun } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { useMailAccounts } from '@/presentation/mail/useMail'
import { useConfirm } from '@/presentation/components/useConfirm'
import { announce, announceFailure } from './announce'
import { ago } from './format'
import { SweepPanel } from './SweepPanel'
import { TestResults } from './TestResults'
import { useListen, useSweep, useWorkflow } from './useAgent'
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
  const { confirm, dialog } = useConfirm()
  const sweeping = useSweep(agentId).data?.state === 'running'
  const listen = useListen(agentId).data

  if (isLoading || !w) return <Spinner label="Loading" />
  const cfg = w.config
  const pasted = cfg.source.kind === 'manual'

  /** Starts the run through the whole inbox on the server. It carries on without this page. */
  async function sweepAll() {
    const auto = cfg.action?.auto && cfg.action.trashLabel
    const yes = await confirm({
      title: 'Run through the whole inbox?',
      description: `It runs again and again, ${cfg.filters.limit} emails at a time, until everything in range has been judged. These are real runs: each decision is recorded${auto ? `, and emails labelled ${cfg.action?.trashLabel} are moved to Trash as it goes` : cfg.action?.trashLabel ? ', and the emails to move wait for your approval in Review' : ''}. It keeps going on the server, so you can close this page, and you can stop it at any time.`,
      confirmLabel: 'Start',
      tone: auto ? 'danger' : 'default',
    })
    if (!yes) return
    try {
      await agent.startSweep(w!.id)
      await client.invalidateQueries({ queryKey: ['agent', 'sweep'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It didn’t start.')
      announceFailure(w!.name, 'run', e)
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
            <Button onClick={() => void go('run')} disabled={busy !== null || sweeping || (pasted && !manual.trim())}>
              {busy === 'run' ? <Spinner size="xs" tone="current" decorative /> : <Zap />} Run now
            </Button>
            {cfg.source.kind === 'mail' && (
              <Button variant="outline" onClick={() => void sweepAll()} disabled={busy !== null || sweeping}>
                <ListChecks /> Run through the whole inbox
              </Button>
            )}
            <span className="text-xs text-muted-foreground">A test looks at up to 20 items and keeps nothing. Running keeps each decision in Review.</span>
          </div>
          {listen?.listening && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-success/5 px-3.5 py-2.5 text-sm" role="status">
              <span className={listen.state === 'listening' ? 'size-2 animate-pulse rounded-full bg-success' : 'size-2 rounded-full bg-warning'} />
              {listen.state === 'listening' ? 'Listening to the mailbox' : listen.state === 'reconnecting' ? 'Reconnecting to the mailbox…' : 'Connecting to the mailbox…'}
              <span className="text-xs text-muted-foreground">
                {listen.lastRunAt ? `Last run ${ago(listen.lastRunAt)}.` : 'No run yet.'} It runs by itself when new mail arrives.
                {listen.error ? ` ${listen.error}` : ''}
              </span>
            </p>
          )}
          <SweepPanel agentId={w.id} />
        </div>
      </Section>

      {dialog}
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
        <Section title={run.mode === 'test' ? 'Test result' : 'Run result'} actions={run.mode === 'run' && run.runId ? <ExecutionLink id={w.id} runId={run.runId} /> : undefined}>
          <TestResults run={run} />
        </Section>
      )}
    </div>
  )
}

function ExecutionLink({ id, runId }: { id: string; runId: string }) {
  return (
    <Link to={`/agents/${id}/executions/${runId}`} className="flex items-center gap-1 text-sm font-medium hover:underline">
      Open this execution <ArrowRight className="size-3.5" />
    </Link>
  )
}
