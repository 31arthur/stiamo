import { useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useParams, useSearchParams } from 'react-router-dom'
import { Brain, ChevronRight, History, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { RunDetail, RunSummary } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { Segmented } from '@/presentation/components/form'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { ago, compact, formatMs, triggerLabel } from './format'

const dayLabel = (iso: string) => format(parseISO(iso), 'EEEE d MMM')

/** Every time the agent was asked: from the web, a channel, a test or a schedule. Open one for the whole story. */
export function HistoryTab() {
  const { agentId } = useParams()
  const { agent } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<'all' | 'error'>('all')
  const [confirming, setConfirming] = useState(false)

  const runs = useInfiniteQuery({
    queryKey: ['agent', 'runs', userId, agentId],
    queryFn: ({ pageParam }) => agent.runs(agentId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    retry: false,
  })
  const all = runs.data?.pages.flatMap((p) => p.items) ?? []
  const shown = filter === 'error' ? all.filter((r) => r.status === 'error') : all
  const openId = params.get('run')
  const open = (id: string | null) => setParams(id ? { run: id } : {}, { replace: true })

  const groups: { day: string; items: RunSummary[] }[] = []
  for (const r of shown) {
    const day = dayLabel(r.startedAt)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(r)
    else groups.push({ day, items: [r] })
  }

  async function clear() {
    try {
      await agent.clearRuns(agentId!)
      toast.success('History cleared')
      setConfirming(false)
      void client.invalidateQueries({ queryKey: ['agent', 'runs'] })
      void client.invalidateQueries({ queryKey: ['agent', 'stats'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t clear the history')
    }
  }

  if (runs.isLoading) return <Spinner label="Loading history" />
  if (runs.error) {
    return (
      <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
        {runs.error instanceof Error ? runs.error.message : 'Couldn’t load the history.'}
      </p>
    )
  }
  if (all.length === 0) {
    return (
      <Section>
        <EmptyState title="Nothing yet">Each time this agent is asked, here or from a channel, the question, the prompt, what it did and its answer are kept here.</EmptyState>
      </Section>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Show"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All runs' },
            { value: 'error', label: 'Failed' },
          ]}
        />
        <div className="ml-auto flex items-center gap-1">
          {confirming ? (
            <>
              <span className="text-xs text-muted-foreground">Delete this agent’s whole history?</span>
              <Button variant="destructive" size="sm" onClick={() => void clear()}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 /> Clear history
            </Button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No failed runs among these. </p>
      ) : (
        groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <h2 className="mb-1.5 px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{g.day}</h2>
            <ul className="grid gap-1.5">
              {g.items.map((r) => (
                <RunRow key={r.id} run={r} onOpen={() => open(r.id)} />
              ))}
            </ul>
          </section>
        ))
      )}

      {runs.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void runs.fetchNextPage()} disabled={runs.isFetchingNextPage}>
            {runs.isFetchingNextPage && <Spinner size="xs" tone="current" decorative />} Show older runs
          </Button>
        </div>
      )}

      <RunSheet runId={openId} onClose={() => open(null)} />
    </div>
  )
}

function RunRow({ run, onOpen }: { run: RunSummary; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-xl border bg-card/80 px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-float">
        <span className={cn('size-2 shrink-0 rounded-full', run.status === 'ok' ? 'bg-success' : 'bg-destructive')} aria-label={run.status === 'ok' ? 'Succeeded' : 'Failed'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{run.input}</span>
          <span className={cn('block truncate text-xs', run.error ? 'text-destructive' : 'text-muted-foreground')}>{run.error ?? (run.output || 'No answer')}</span>
        </span>
        <span className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
          <span className="block">{format(parseISO(run.startedAt), 'HH:mm')} · {triggerLabel(run.trigger)}</span>
          <span className="block">{formatMs(run.durationMs)} · {run.model}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}

/** One run in full, in the order a person wants it: what was asked, the answer, what the agent did, then what the model was given. */
function RunSheet({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const { agent } = useServices()
  const userId = useUserId()
  const run = useQuery<RunDetail>({ queryKey: ['agent', 'run', userId, runId], queryFn: () => agent.run(runId!), enabled: !!runId, retry: false })
  const r = run.data
  return (
    <Sheet open={!!runId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> {r ? `${triggerLabel(r.trigger)} · ${format(parseISO(r.startedAt), 'd MMM, HH:mm:ss')}` : 'Run'}
          </SheetTitle>
          <SheetDescription>{r ? `${ago(r.startedAt)}` : 'Loading…'}</SheetDescription>
        </SheetHeader>
        {run.isLoading && <Spinner label="Loading the run" />}
        {run.error && <p className="p-5 text-sm text-destructive">{run.error instanceof Error ? run.error.message : 'Couldn’t load the run.'}</p>}
        {r && (
          <div className="grid gap-5 p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <Fact label="Result" value={r.status === 'ok' ? 'Succeeded' : 'Failed'} tone={r.status === 'ok' ? 'ok' : 'bad'} />
              <Fact label="Took" value={formatMs(r.durationMs)} />
              <Fact label="Model" value={r.model} />
              <Fact label="Tokens in · out" value={r.usage.inputTokens || r.usage.outputTokens ? `${compact(r.usage.inputTokens ?? 0)} · ${compact(r.usage.outputTokens ?? 0)}` : '—'} />
            </dl>
            {r.thinking !== 'off' && (
              <p className="-mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Brain className="size-3.5" /> Thinking: {r.thinking}
              </p>
            )}

            <Block title="Asked">
              <p className="text-sm whitespace-pre-wrap">{r.input}</p>
            </Block>

            {r.error ? (
              <Block title="What went wrong">
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">{r.error}</p>
              </Block>
            ) : (
              <Block title="Answer">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.output || 'No answer.'}</p>
              </Block>
            )}

            {r.stepLog.length > 0 && (
              <Block title={`What it did · ${r.stepLog.length} step${r.stepLog.length === 1 ? '' : 's'}`}>
                <ol className="grid gap-2">
                  {r.stepLog.map((s, i) => (
                    <li key={i}>
                      <details className="group rounded-lg border">
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
                          <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{s.label}</span>
                          <span className={cn('shrink-0 text-xs', s.error ? 'text-destructive' : 'text-muted-foreground')}>{s.error ? 'failed' : `${s.found} found`} · {formatMs(s.ms)}</span>
                        </summary>
                        <div className="grid gap-2 border-t px-3 py-2 text-xs">
                          <Code title={`${s.tool} arguments`} body={JSON.stringify(s.args, null, 2)} />
                          <Code title={s.error ? 'Error' : 'It gave back'} body={s.error ?? s.result} />
                        </div>
                      </details>
                    </li>
                  ))}
                </ol>
              </Block>
            )}

            <details className="rounded-lg border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">What the model was given</summary>
              <div className="grid gap-3 border-t p-3 text-xs">
                <Code title="Message" body={r.userMessage} />
                <Code title="System prompt" body={r.systemPrompt} />
                <div>
                  <div className="mb-1 font-semibold tracking-widest text-muted-foreground uppercase">Tools offered</div>
                  <p className="font-mono">{r.tools.join(', ') || 'none'}</p>
                </div>
              </div>
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-medium', tone === 'ok' && 'text-success', tone === 'bad' && 'text-destructive')}>{value}</dd>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Code({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-1 font-semibold tracking-widest text-muted-foreground uppercase">{title}</div>
      <pre className="max-h-64 overflow-auto rounded-lg bg-muted/60 p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">{body}</pre>
    </div>
  )
}
