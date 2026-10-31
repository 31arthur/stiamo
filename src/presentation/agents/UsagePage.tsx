import { format, parseISO } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { Bot, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { UsageTotals } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { PageHeader, Section, Stat } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { ago, compact, formatMs, money, triggerLabel } from './format'
import { useAgentSettings, useUsageSummary, useUsageTransactions } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const tokens = (t: Pick<UsageTotals, 'inputTokens' | 'outputTokens'>) => (t.inputTokens || t.outputTokens ? `${compact(t.inputTokens)} · ${compact(t.outputTokens)}` : '—')

/** What every agent has used: tokens, and the cost where the provider says what it charged. Totals, where it went, and every run. */
export function UsagePage() {
  const [params, setParams] = useSearchParams()
  const period = params.get('days') ?? '30'
  const days = period === 'all' ? null : Number(period)
  const agent = params.get('agent') ?? undefined
  const { settings } = useAgentSettings()
  const { data, isLoading, error } = useUsageSummary(days, agent)
  const set = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (v) next.set(k, v)
        else next.delete(k)
        return next
      },
      { replace: true },
    )

  return (
    <>
      <PageHeader eyebrow="Agents" title="Usage" description="Tokens and cost of every run of every agent, test runs included. Cost shows where the provider says what it charged: the decision model and OpenRouter do; OpenAI and Gemini report tokens only." />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" value={period} onChange={(e) => set('days', e.target.value === '30' ? null : e.target.value)} className={SELECT}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select aria-label="Agent" value={agent ?? ''} onChange={(e) => set('agent', e.target.value || null)} className={cn(SELECT, 'max-w-60')}>
          <option value="">All agents</option>
          {(settings?.agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner label="Loading" />
      ) : error || !data ? (
        <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the usage.'}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Runs" value={data.total.runs} />
            <Stat label="Tokens in" value={data.total.inputTokens ? compact(data.total.inputTokens) : '—'} />
            <Stat label="Tokens out" value={data.total.outputTokens ? compact(data.total.outputTokens) : '—'} />
            <Stat label="Cost" value={money(data.total.cost)} />
            <Stat label="Emails judged" value={data.total.items ? compact(data.total.items) : '—'} />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {data.total.cost !== null && data.total.pricedRuns < data.total.runs
              ? `Cost covers the ${data.total.pricedRuns} of ${data.total.runs} runs whose provider reports it. `
              : data.total.runs > 0 && data.total.cost === null
                ? 'None of these providers report a cost, so only tokens are shown. '
                : ''}
            {data.windowDays !== null && <>All time: {tokens(data.allTime)} tokens{data.allTime.cost !== null ? `, ${money(data.allTime.cost)}` : ''}, {data.allTime.runs} runs.</>}
          </p>

          <Section title="Day by day" description="Tokens used each day. Hover a bar for the day’s cost.">
            <Daily daily={data.daily} />
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="By agent" bodyClassName="p-0">
              {data.byAgent.length === 0 ? <Empty /> : (
                <ul className="divide-y">
                  {data.byAgent.map((a) => (
                    <li key={a.agentId} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">{a.kind === 'workflow' ? <Workflow className="size-4" /> : <Bot className="size-4" />}</span>
                      <Link to={`/agents/usage?agent=${a.agentId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                        {a.name}
                      </Link>
                      <span className="hidden text-xs text-muted-foreground sm:block">{a.runs} runs</span>
                      <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{tokens(a)}</span>
                      <span className="w-16 text-right text-sm font-medium tabular-nums">{money(a.cost)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="By model" bodyClassName="p-0">
              {data.byModel.length === 0 ? <Empty /> : (
                <ul className="divide-y">
                  {data.byModel.map((m) => (
                    <li key={`${m.provider}/${m.model}`} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.model || 'Unknown'}</span>
                        <span className="block text-xs text-muted-foreground">{m.provider || '—'}</span>
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:block">{m.runs} runs</span>
                      <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{tokens(m)}</span>
                      <span className="w-16 text-right text-sm font-medium tabular-nums">{money(m.cost)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}

      <Transactions days={days} agent={agent} />
    </>
  )
}

const Empty = () => <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing used in this period.</p>

function Daily({ daily }: { daily: { date: string; runs: number; inputTokens: number; outputTokens: number; cost: number | null }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.inputTokens + d.outputTokens))
  return (
    <div>
      <div role="img" aria-label="Tokens used per day" className="flex h-28 items-end gap-1">
        {daily.map((d) => {
          const total = d.inputTokens + d.outputTokens
          return (
            <div key={d.date} title={`${format(parseISO(d.date), 'd MMM')}: ${d.runs} run${d.runs === 1 ? '' : 's'}, ${compact(d.inputTokens)} in · ${compact(d.outputTokens)} out${d.cost !== null ? `, ${money(d.cost)}` : ''}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {total > 0 ? <span className="block min-h-0.5 rounded-t-sm bg-foreground/80" style={{ height: `${(total / max) * 100}%` }} /> : d.runs > 0 ? <span className="h-0.5 bg-foreground/40" /> : <span className="h-px bg-border" />}
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{daily[0] && format(parseISO(daily[0].date), 'd MMM')}</span>
        <span>{daily.length > 1 && format(parseISO(daily[daily.length - 1].date), 'd MMM')}</span>
      </div>
    </div>
  )
}

/** Every run, newest first, with what it used. */
function Transactions({ days, agent }: { days: number | null; agent: string | undefined }) {
  const q = useUsageTransactions(days, agent)
  const rows = q.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <Section title="Every run" description="What each run used, newest first." bodyClassName="p-0">
      {q.isLoading ? (
        <div className="p-6">
          <Spinner label="Loading" />
        </div>
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                  <th scope="col" className="px-2 py-2.5 font-medium">Agent</th>
                  <th scope="col" className="px-2 py-2.5 font-medium">Model</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-medium">Tokens in · out</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-medium">Emails</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-medium">Cost</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap" title={format(parseISO(t.at), 'd MMM yyyy, p')}>
                      <span className="flex items-center gap-2">
                        <span className={cn('size-2 shrink-0 rounded-full', t.status === 'ok' ? 'bg-success' : 'bg-destructive')} aria-label={t.status === 'ok' ? 'Succeeded' : 'Failed'} />
                        {ago(t.at)}
                      </span>
                    </td>
                    <td className="max-w-56 px-2 py-2.5">
                      <Link to={t.kind === 'workflow' && t.trigger === 'manual' ? `/agents/${t.agentId}/executions/${t.id}` : `/agents/${t.agentId}/history?run=${t.id}`} className="block truncate font-medium hover:underline">
                        {t.agentName}
                      </Link>
                      <span className="text-xs text-muted-foreground">{triggerLabel(t.trigger)}</span>
                    </td>
                    <td className="max-w-48 px-2 py-2.5">
                      <span className="block truncate">{t.model || '—'}</span>
                      <span className="text-xs text-muted-foreground">{t.provider}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{tokens(t)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{t.items || '—'}</td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums">{money(t.cost)}</td>
                    <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatMs(t.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.hasNextPage && (
            <div className="border-t p-3 text-center">
              <Button variant="ghost" size="sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {q.isFetchingNextPage && <Spinner size="xs" tone="current" decorative />} Older runs
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  )
}
