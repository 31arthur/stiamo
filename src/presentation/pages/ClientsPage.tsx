import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarClock, Plus, Search } from 'lucide-react'
import { Link } from '@/presentation/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, isOngoing, PROJECT_STATUS_LABELS, projectRank } from '@/domain/clients/Client'
import type { ProjectStatus } from '@/domain/clients/Client'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { stagger } from '@/presentation/motion/presets'
import { initials } from './CounselPage'

export const PROJECT_TONE: Record<ProjectStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  active: 'bg-success/12 text-success',
  on_hold: 'bg-warning/15 text-warning',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
}

/** The next open meeting tied to each client, directly or through one of its projects. */
export function useNextMeetingByClient() {
  const today = useToday()
  const { data: projects } = useEntities('project')
  const { data: meetings } = useEntities('meeting')
  return useMemo(() => {
    const projectClient = new Map(projects.map((p) => [p.id, p.clientId]))
    const next = new Map<string, (typeof meetings)[number]>()
    for (const m of meetings) {
      const clientId = m.related?.kind === 'client' ? m.related.id : m.related?.kind === 'project' ? projectClient.get(m.related.id) : undefined
      if (!clientId || m.slot.date < today || m.outcome.status !== 'open') continue
      const cur = next.get(clientId)
      if (!cur || `${m.slot.date}${m.slot.start}` < `${cur.slot.date}${cur.slot.start}`) next.set(clientId, m)
    }
    return next
  }, [meetings, projects, today])
}

/** Who FSA works for. Their projects have a page of their own. */
export function ClientsPage() {
  const { open } = useEditor()
  const today = useToday()
  const { data: clients } = useEntities('client')
  const { data: projects } = useEntities('project')
  const nextByClient = useNextMeetingByClient()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const rows = clients
    .filter((c) => !q || [c.name, c.contactName, c.email, c.notes].filter(Boolean).join(' ').toLowerCase().includes(q))
    .map((c) => ({ c, projects: projects.filter((p) => p.clientId === c.id) }))
    .sort((a, b) => Number(b.c.status === 'active') - Number(a.c.status === 'active') || a.c.name.localeCompare(b.c.name))

  return (
    <>
      <PageHeader
        eyebrow="FSA"
        title="Clients"
        description="Who FSA does work for. Meetings, tasks and documents hang off a client; the work itself is organised as projects."
        actions={
          <Button onClick={() => open({ kind: 'client' })}>
            <Plus /> Client
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clients" value={clients.length} />
        <Stat label="Active" value={clients.filter((c) => c.status === 'active').length} tone="success" />
        <Stat label="Prospects" value={clients.filter((c) => c.status === 'prospect').length} />
        <Stat label="Meetings coming up" value={nextByClient.size} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/projects" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Go to projects →
        </Link>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients…" aria-label="Search clients" className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
        </div>
      </div>

      {rows.length === 0 ? (
        <Section>
          <EmptyState title={clients.length ? 'No match.' : 'No clients yet.'} action={clients.length ? undefined : <Button onClick={() => open({ kind: 'client' })}>Add a client</Button>}>
            {clients.length ? 'Try a different search.' : 'Add who you do FSA work for, then set up their projects and schedule meetings with them.'}
          </EmptyState>
        </Section>
      ) : (
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, projects: theirs }) => {
            const next = nextByClient.get(c.id)
            const ongoing = theirs.filter(isOngoing).sort((a, b) => projectRank(a) - projectRank(b))
            return (
              <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                <Link to={`/clients/${c.id}`} className={cn('group flex h-full flex-col gap-3 rounded-2xl border bg-card/80 p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-float', c.status === 'past' && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ws-fsa-soft text-sm font-semibold text-ws-fsa">{initials(c.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.contactName ?? CLIENT_KIND_LABELS[c.kind]} · {CLIENT_STATUS_LABELS[c.status]}
                      </div>
                    </div>
                  </div>
                  {ongoing.length > 0 && (
                    <ul className="grid gap-1">
                      {ongoing.slice(0, 3).map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs">
                          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', PROJECT_TONE[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span>
                          <span className="truncate">{p.title}</span>
                        </li>
                      ))}
                      {ongoing.length > 3 && <li className="text-[11px] text-muted-foreground">+{ongoing.length - 3} more</li>}
                    </ul>
                  )}
                  <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    {next ? (
                      <>
                        <CalendarClock className="size-3.5" /> Next: {friendlyDate(next.slot.date, today)}
                      </>
                    ) : theirs.length === 0 ? (
                      'No projects yet'
                    ) : (
                      'Nothing scheduled'
                    )}
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </>
  )
}
