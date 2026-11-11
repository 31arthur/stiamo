import { Check, ChevronRight, CircleAlert } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import type { AgentSummary, RunSummary } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { Section, Stat } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { useMailAccounts } from '@/presentation/mail/useMail'
import { ago, compact, formatMs, money, triggerLabel } from './format'
import { PlannerPanel } from './PlannerPanel'
import { TryTab } from './TryTab'
import { useAgentDetail, useAgentStats, useAgentSummary, useChannels, useWorkflow } from './useAgent'
import { TABLE_LABELS } from './workflowTemplates'

/** How the agent has been doing, when it was last called, and what is still to set up. */
export function OverviewTab() {
  const { agentId } = useParams()
  const agent = useAgentSummary(agentId)!
  const { data: s, isLoading } = useAgentStats(agentId)
  if (isLoading || !s) return <Spinner label="Loading" />
  const rate = s.runs ? Math.round((s.ok / s.runs) * 100) : null

  return (
    <div className="grid gap-4">
      {agent.kind !== 'workflow' && (
        <Section title="Try it" description="Ask it something here, with the model it is set to. Every question is kept under Runs.">
          <TryTab />
        </Section>
      )}
      {agent.id === 'daily-planner' && <PlannerPanel />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Runs, last ${s.windowDays} days`} value={s.runs} />
        <Stat label="Succeeded" value={rate === null ? '—' : `${rate}%`} tone={rate === null ? 'default' : rate >= 95 ? 'success' : rate >= 80 ? 'warning' : 'danger'} />
        <Stat label="Average time" value={s.avgDurationMs ? formatMs(s.avgDurationMs) : '—'} />
        <Stat label={`Tokens in · out, ${s.windowDays} days`} value={s.inputTokens || s.outputTokens ? `${compact(s.inputTokens)} · ${compact(s.outputTokens)}` : '—'} />
      </div>

      <Section
        title="Used so far"
        description="Everything this agent has used since it began, whatever happened to its history. Cost is shown where the provider reports it."
        actions={
          <Link to={`/agents/usage?agent=${agent.id}&days=all`} className="text-sm font-medium hover:underline">
            Every run
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Tokens in · out" value={s.allTime.inputTokens || s.allTime.outputTokens ? `${compact(s.allTime.inputTokens)} · ${compact(s.allTime.outputTokens)}` : '—'} />
          <Stat label="Cost" value={money(s.allTime.cost)} />
          <Stat label="Runs" value={s.allTime.runs} />
          {agent.kind === 'workflow' ? <Stat label="Emails judged" value={s.allTime.items ? compact(s.allTime.items) : '—'} /> : <Stat label="Failed" value={s.allTime.errors} tone={s.allTime.errors ? 'danger' : 'default'} />}
        </div>
        {s.allTime.runs > 0 && s.allTime.cost === null && <p className="mt-3 text-xs text-muted-foreground">This agent’s provider doesn’t report what it charged, so only tokens are counted. Models through OpenRouter, and Jev, do.</p>}
      </Section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-4">
          <Section title="Last 14 days" description={s.totalRuns ? `${s.totalRuns} runs in all` : undefined}>
            <Bars daily={s.daily} />
            {Object.keys(s.byTrigger).length > 0 && (
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(s.byTrigger).map(([t, n]) => (
                  <span key={t}>
                    {triggerLabel(t)} <span className="font-medium text-foreground tabular-nums">{n}</span>
                  </span>
                ))}
              </p>
            )}
          </Section>

          <Section title="Last called">
            {s.lastRun ? <LastRun run={s.lastRun} agentId={agent.id} /> : <p className="text-sm text-muted-foreground">Not called yet. Try it, or connect a channel.</p>}
          </Section>
        </div>

        {agent.kind === 'workflow' ? <WorkflowSetup agent={agent} /> : <Setup agent={agent} />}
      </div>
    </div>
  )
}

function Bars({ daily }: { daily: { date: string; runs: number; errors: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.runs))
  return (
    <div role="img" aria-label="Runs per day over the last 14 days" className="flex h-24 items-end gap-1.5">
      {daily.map((d) => (
        <div key={d.date} title={`${d.date}: ${d.runs} run${d.runs === 1 ? '' : 's'}${d.errors ? `, ${d.errors} failed` : ''}`} className="flex h-full flex-1 flex-col justify-end">
          <div className="flex min-h-px flex-col overflow-hidden rounded-t-sm" style={{ height: `${(d.runs / max) * 100}%` }}>
            {d.errors > 0 && <span className="bg-destructive/70" style={{ flex: d.errors }} />}
            <span className="bg-foreground/80" style={{ flex: Math.max(0, d.runs - d.errors) }} />
          </div>
          {d.runs === 0 && <span className="h-px bg-border" />}
        </div>
      ))}
    </div>
  )
}

function LastRun({ run, agentId }: { run: RunSummary; agentId: string }) {
  return (
    <Link to={`/agents/${agentId}/history?run=${run.id}`} className="grid gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/40">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('size-2 rounded-full', run.status === 'ok' ? 'bg-success' : 'bg-destructive')} aria-label={run.status === 'ok' ? 'Succeeded' : 'Failed'} />
        <span className="font-medium text-foreground">{ago(run.startedAt)}</span>
        <span className="rounded-full bg-muted px-1.5 py-px">{triggerLabel(run.trigger)}</span>
        <span>{formatMs(run.durationMs)}</span>
        <ChevronRight className="ml-auto size-4" />
      </div>
      <p className="line-clamp-2 text-sm">
        <span className="text-muted-foreground">Asked </span>
        {run.input}
      </p>
      {run.error ? <p className="line-clamp-2 text-sm text-destructive">{run.error}</p> : <p className="line-clamp-2 text-sm text-muted-foreground">{run.output || 'No answer.'}</p>}
    </Link>
  )
}

/** What is left to do, as a short checklist with a way in to each. */
function Setup({ agent }: { agent: AgentSummary }) {
  const detail = useAgentDetail(agent.id)
  const { channels } = useChannels()
  const mine = channels.filter((c) => c.agent === agent.id)
  const rows = [
    { done: !!agent.selection, label: 'Model', value: agent.selection ? `${agent.selection.modelId} · ${agent.selection.providerId}${agent.selectionInherited ? ' (the last one you chose)' : ''}` : 'Not chosen yet', to: 'settings' },
    { done: true, label: 'Prompt', value: agent.customPrompt ? 'Your own' : 'The default', to: 'settings' },
    { done: mine.length > 0, label: 'Channels', value: mine.length ? mine.map((c) => (c.kind === 'telegram' ? `@${c.username}` : 'WhatsApp')).join(', ') : 'None connected', to: 'channels', optional: true },
  ]
  return (
    <Section title="Setup">
      <ul className="grid gap-1">
        {rows.map((r) => (
          <li key={r.label}>
            <Link to={`/agents/${agent.id}/${r.to}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
              <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', r.done ? 'bg-success/15 text-success' : r.optional ? 'bg-muted text-muted-foreground' : 'bg-warning/15 text-warning')}>
                {r.done ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.value}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {detail.data && (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Can use: {detail.data.packs.join(', ')}.
        </p>
      )}
    </Section>
  )
}

/** The checklist for an agent someone built: what it reads, how it decides, and what is waiting for them. */
function WorkflowSetup({ agent }: { agent: AgentSummary }) {
  const { data: w } = useWorkflow(agent.id)
  const { accounts } = useMailAccounts()
  if (!w) return <Section title="Setup"><Spinner label="Loading" /></Section>
  const c = w.config
  const rows = [
    { done: true, label: 'Reads', value: readsOf(c, accounts), to: 'settings' },
    { done: true, label: 'Sorts into', value: c.labels.map((l) => l.name).join(', '), to: 'settings' },
    c.decider === 'jev'
      ? { done: true, label: 'Decides with', value: 'Jev, the decision model', to: 'settings' }
      : { done: !!agent.selection, label: 'Decides with', value: agent.selection ? `${agent.selection.modelId} · ${agent.selection.providerId}` : 'No model chosen yet', to: 'settings' },
    { done: w.pending === 0, label: 'Review', value: w.pending ? `${w.pending} waiting for you` : 'Nothing waiting', to: 'review', optional: w.pending === 0 },
  ]
  return (
    <Section title="Setup" description={`Version ${w.version}`}>
      <ul className="grid gap-1">
        {rows.map((r) => (
          <li key={r.label}>
            <Link to={`/agents/${agent.id}/${r.to}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
              <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', r.done ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>{r.done ? <Check className="size-3" /> : <CircleAlert className="size-3" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.value}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** What an agent reads, in words: the pasted text, a collection, or the mailboxes and the stretch of mail. */
function readsOf(c: NonNullable<ReturnType<typeof useWorkflow>['data']>['config'], accounts: { id: string; label: string }[]): string {
  if (c.source.kind === 'manual') return 'Text you paste'
  const range = c.filters.after || c.filters.before ? `, ${c.filters.after ?? 'the start'} to ${c.filters.before ?? 'now'}` : c.filters.sinceDays ? `, last ${c.filters.sinceDays} days` : ', all of it'
  if (c.source.kind === 'mail') {
    const names = (c.source.accountIds ?? []).map((id) => accounts.find((a) => a.id === id)?.label ?? 'a mailbox')
    return `${names.length ? names.join(', ') : 'No mailbox chosen'}${range}`
  }
  return `${TABLE_LABELS[c.source.table ?? ''] ?? c.source.table}${c.filters.sinceDays ? `, last ${c.filters.sinceDays} days` : ''}`
}
