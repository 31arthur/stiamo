import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ArrowRight, KeyRound, Play, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { WorkflowRun } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { Section } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
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

  if (isLoading || !w) return <Spinner label="Loading" />
  const cfg = w.config
  const pasted = cfg.source.kind === 'manual'

  async function go(mode: 'test' | 'run') {
    setBusy(mode)
    setError(null)
    try {
      setRun(await (mode === 'test' ? agent.testWorkflow(w!.id, pasted ? manual : undefined) : agent.runWorkflow(w!.id, pasted ? manual : undefined)))
    } catch (e) {
      setRun(null)
      setError(e instanceof Error ? e.message : 'It didn’t run.')
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
            <span className="text-xs text-muted-foreground">A test looks at up to 20 items and keeps nothing. Running keeps each decision in Review.</span>
          </div>
        </div>
      </Section>

      {error && (
        <div role="alert" className="grid gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
          {/choose a provider|add an openrouter key/i.test(error) && (
            <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<Link to={/openrouter/i.test(error) ? '/agents/providers' : `/agents/${w.id}/settings`} />}>
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
