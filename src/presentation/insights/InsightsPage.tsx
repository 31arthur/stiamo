import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ExternalLink, Link2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { InsightDigest, Insights } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { ago } from '@/presentation/agents/format'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { useServices } from '@/presentation/app/services'
import { PageHeader, Section, Stat } from '@/presentation/components/layout'
import { Segmented } from '@/presentation/components/form'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { useInsights } from './useInsights'

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

/** What your mail, the news and your own work add up to, side by side: counted from what the agents already keep, with a written reading on request. */
export function InsightsPage() {
  const { scope } = useWorkspaceFilter()
  const [days, setDays] = useState(7)
  const { data, isLoading, error } = useInsights(scope, days)
  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Insights"
        description="Your mail, the news and your own work, read together: what needs you, what is changing, and where they touch."
        actions={<Segmented size="sm" label="Period" value={String(days)} onChange={(v) => setDays(Number(v))} options={RANGES} />}
      />
      {isLoading ? (
        <Spinner label="Reading your mail, news and work" />
      ) : error || !data ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error instanceof Error ? error.message : 'The insights couldn’t be read. The agent service needs to be deployed.'}
        </p>
      ) : (
        <div className="grid gap-5">
          <Digest scope={scope} days={days} />
          <Tiles data={data} />
          <div className="grid gap-5 xl:grid-cols-2">
            <MailCard data={data} />
            <NewsCard data={data} />
          </div>
          <WorkCard data={data} />
          {data.connections.length > 0 && <Connections data={data} />}
        </div>
      )}
    </>
  )
}

// --- the written reading --------------------------------------------------------------------------------------

function Digest({ scope, days }: { scope: string; days: number }) {
  const { agent } = useServices()
  const [digest, setDigest] = useState<InsightDigest | null>(null)
  const [busy, setBusy] = useState(false)

  async function write(force: boolean) {
    setBusy(true)
    try {
      setDigest(await agent.insightsDigest(scope, days, force))
    } catch (e) {
      toast.error('Couldn’t write the digest', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="In short"
      description="A reading of the figures below by your own model: what stands out, and what to do about it."
      actions={
        <Button variant={digest ? 'ghost' : 'default'} size="sm" onClick={() => void write(!!digest)} disabled={busy}>
          {busy ? <Spinner size="xs" tone="current" decorative /> : digest ? <RefreshCw /> : <Sparkles />} {digest ? 'Write again' : 'Write my digest'}
        </Button>
      }
    >
      {digest ? (
        <div className="grid gap-3">
          <p className="text-sm leading-relaxed">{digest.summary}</p>
          {digest.highlights.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {digest.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" /> {h}
                </li>
              ))}
            </ul>
          )}
          {digest.suggestions.length > 0 && (
            <div className="rounded-xl bg-muted/50 p-3">
              <h3 className="mb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Do next</h3>
              <ol className="grid list-decimal gap-1 pl-5 text-sm marker:text-foreground">
                {digest.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Written {ago(digest.generatedAt)}{digest.cached ? ' · kept from earlier today' : ''}.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The figures are always up to date. Press the button for a short written reading of them. It uses the model you chose for your agents, and is kept for the day.</p>
      )}
    </Section>
  )
}

// --- the numbers ----------------------------------------------------------------------------------------------

function Tiles({ data }: { data: Insights }) {
  const overdue = data.work.tasks.overdue + data.work.followUps.overdue
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Mail that needs you" value={data.mail.needsYou} tone={data.mail.needsYou ? 'warning' : 'default'} />
      <Stat label="Urgent mail" value={data.mail.urgent} tone={data.mail.urgent ? 'danger' : 'default'} />
      <Stat label="Overdue tasks and follow-ups" value={overdue} tone={overdue ? 'danger' : 'success'} />
      <Stat label="News that matters" value={data.news.total} />
    </div>
  )
}

/** One bar per day, split into what is urgent, what needs you, and the rest. */
function DayBars({ days }: { days: Insights['mail']['perDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.urgent + d.attention + d.other))
  return (
    <div role="img" aria-label="Mail per day" className="flex h-28 items-end gap-1">
      {days.map((d) => {
        const total = d.urgent + d.attention + d.other
        return (
          <div key={d.date} title={`${format(parseISO(d.date), 'EEE d MMM')}: ${d.urgent} urgent, ${d.attention} need you, ${d.other} other`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(total / max) * 100}%` }}>
              <span className="bg-muted-foreground/25" style={{ flexGrow: d.other }} />
              <span className="bg-warning" style={{ flexGrow: d.attention }} />
              <span className="bg-destructive" style={{ flexGrow: d.urgent }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <span className={cn('size-2 rounded-sm', i.color)} /> {i.label}
        </span>
      ))}
    </p>
  )
}

function MailCard({ data }: { data: Insights }) {
  const m = data.mail
  return (
    <Section title="Mail" description={`${m.total} decided by your mail agents${m.cleared ? `, ${m.cleared} cleared` : ''}${m.events ? `, ${m.events} with an event to approve` : ''}.`}>
      {m.total === 0 ? (
        <p className="text-sm text-muted-foreground">No mail has been judged in this period. The priority mail watch fills this in as mail arrives.</p>
      ) : (
        <div className="grid gap-4">
          <DayBars days={m.perDay} />
          <Legend items={[{ color: 'bg-destructive', label: 'Urgent' }, { color: 'bg-warning', label: 'Needs you' }, { color: 'bg-muted-foreground/25', label: 'Everything else' }]} />
          {m.dueSoon.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Due in the next week</h3>
              <ul className="grid gap-1.5">
                {m.dueSoon.map((d) => (
                  <li key={d.itemId}>
                    <Link to="/attention" className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                      <span className={cn('mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums', d.priority === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>{format(parseISO(d.due), 'EEE d MMM')}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.title}</span>
                        {d.action && <span className="block truncate text-xs text-muted-foreground">{d.action}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {m.topSenders.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Who writes most</h3>
              <ul className="grid gap-1 text-sm">
                {m.topSenders.map((s) => (
                  <li key={s.address} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {s.urgent > 0 && <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">{s.urgent} urgent</span>}
                    <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

function NewsCard({ data }: { data: Insights }) {
  const n = data.news
  const max = Math.max(1, ...n.byImportance.map((b) => b.count))
  return (
    <Section title="News" description={`${n.total} stories kept as relevant to your work.`}>
      {n.total === 0 ? (
        <p className="text-sm text-muted-foreground">No stories have been kept in this period. The news monitor runs on S&amp;B’s desk.</p>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            {n.byImportance.map((b) => (
              <div key={b.level} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 truncate capitalize text-muted-foreground">{b.level}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className={cn('block h-full rounded-full', b.level === 'critical' ? 'bg-destructive' : b.level === 'major' ? 'bg-warning' : 'bg-foreground/40')} style={{ width: `${(b.count / max) * 100}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums">{b.count}</span>
              </div>
            ))}
          </div>
          {n.topics.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">What it has been about</h3>
              <p className="flex flex-wrap gap-1.5">
                {n.topics.map((t) => (
                  <span key={t.term} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {t.term} <span className="text-muted-foreground tabular-nums">{t.count}</span>
                  </span>
                ))}
              </p>
            </div>
          )}
          <div>
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Top stories</h3>
            <ul className="grid gap-1">
              {n.top.map((s) => (
                <li key={s.title}>
                  <a href={s.link ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[s.source, s.importance].filter(Boolean).join(' · ')}</span>
                    </span>
                    {s.link && <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Section>
  )
}

function Rate({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{value === null ? '—' : `${Math.round(value * 100)}%`}</span>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-success" style={{ width: `${(value ?? 0) * 100}%` }} />
      </span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  )
}

function WorkCard({ data }: { data: Insights }) {
  const w = data.work
  const max = Math.max(60, ...w.load.map((l) => l.minutes))
  return (
    <Section title="Your work" description="From your tasks, follow-ups, meetings and hearings.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-3">
          <Rate label="Tasks finished" value={w.tasks.doneRate} hint={`${w.tasks.done} done, ${w.tasks.open} open, ${w.tasks.dueThisWeek} due this week`} />
          <Rate label="Calls that reached someone" value={w.followUps.reachRate} hint={`${w.followUps.reached} of ${w.followUps.tries} tries; ${w.followUps.open} follow-ups open`} />
          {w.tasks.overdueList.length > 0 && (
            <div>
              <h3 className="mb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Overdue</h3>
              <ul className="grid gap-0.5 text-sm">
                {w.tasks.overdueList.map((t) => (
                  <li key={t.id} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="shrink-0 text-xs text-destructive tabular-nums">{t.dueDate && format(parseISO(t.dueDate), 'd MMM')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {w.followUps.stuck.length > 0 && (
            <div>
              <h3 className="mb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Stuck: tried 3+ times</h3>
              <ul className="grid gap-0.5 text-sm">
                {w.followUps.stuck.map((f) => (
                  <li key={f.id} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">{f.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{f.tries}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">The next seven days</h3>
          <div role="img" aria-label="Planned work per day" className="flex h-32 items-end gap-2">
            {w.load.map((l) => (
              <div key={l.date} title={`${format(parseISO(l.date), 'EEE d MMM')}: ${Math.round(l.minutes / 6) / 10} h planned`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div className={cn('w-full rounded-t-md', l.minutes > 6 * 60 ? 'bg-destructive' : 'bg-foreground/60')} style={{ height: `${(l.minutes / max) * 100}%`, minHeight: l.minutes ? 3 : 0 }} />
                <span className="text-[10px] text-muted-foreground">{format(parseISO(l.date), 'EEE')}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Tasks, meetings and hearings by the time they take. A day over six hours is red. {w.meetings.upcoming} meetings this week{w.hearings.upcoming ? `, ${w.hearings.upcoming} hearing${w.hearings.upcoming === 1 ? '' : 's'} in the next month` : ''}.
          </p>
        </div>
      </div>
    </Section>
  )
}

function Connections({ data }: { data: Insights }) {
  return (
    <Section title="Where they touch" description="Mail and news that name a case you are handling, and when it is next in court.">
      <ul className="grid gap-2">
        {data.connections.map((c) => (
          <li key={c.text} className="flex items-start gap-2.5 text-sm">
            <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              {c.text}
              {c.link && (
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs underline">
                  Open
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
