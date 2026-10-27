import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarClock, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, isOngoing, PROJECT_STATUS_LABELS, projectRank } from '@/domain/clients/Client'
import type { ProjectStatus } from '@/domain/clients/Client'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { Segmented } from '@/presentation/components/form'
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

type View = 'clients' | 'projects'

export function ClientsPage() {
  const { open } = useEditor()
  const today = useToday()
  const { data: clients } = useEntities('client')
  const { data: projects } = useEntities('project')
  const { data: meetings } = useEntities('meeting')
  const [view, setView] = useState<View>('clients')
  const [showDone, setShowDone] = useState(false)
  const [query, setQuery] = useState('')

  const byClient = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  /** The next meeting that's tied to a client or project, by the client it belongs to. */
  const nextByClient = useMemo(() => {
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

  const q = query.trim().toLowerCase()
  const clientRows = clients
    .filter((c) => !q || [c.name, c.contactName, c.email, c.notes].filter(Boolean).join(' ').toLowerCase().includes(q))
    .map((c) => ({ c, projects: projects.filter((p) => p.clientId === c.id) }))
    .sort((a, b) => Number(b.c.status === 'active') - Number(a.c.status === 'active') || a.c.name.localeCompare(b.c.name))
  const projectRows = projects
    .filter((p) => (showDone || isOngoing(p)) && (!q || `${p.title} ${byClient.get(p.clientId)?.name ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => projectRank(a) - projectRank(b) || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || a.title.localeCompare(b.title))

  return (
    <>
      <PageHeader
        eyebrow="FSA"
        title="Clients & projects"
        description="Who FSA works for and what’s being built. Meetings, tasks and documents hang off a client or a project."
        actions={
          <>
            <Button variant="outline" onClick={() => open({ kind: 'project', value: {} })} disabled={clients.length === 0}>
              <Plus /> Project
            </Button>
            <Button onClick={() => open({ kind: 'client' })}>
              <Plus /> Client
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active clients" value={clients.filter((c) => c.status === 'active').length} />
        <Stat label="Projects in progress" value={projects.filter((p) => p.status === 'active').length} />
        <Stat label="On hold" value={projects.filter((p) => p.status === 'on_hold').length} tone="warning" />
        <Stat label="Meetings coming up" value={[...nextByClient.values()].length} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<View> label="View" value={view} onChange={setView} options={[{ value: 'clients', label: `Clients · ${clients.length}` }, { value: 'projects', label: `Projects · ${projects.length}` }]} />
        {view === 'projects' && (
          <button type="button" aria-pressed={showDone} onClick={() => setShowDone(!showDone)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', showDone ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
            Show finished
          </button>
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search clients and projects" className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
        </div>
      </div>

      {view === 'clients' ? (
        clientRows.length === 0 ? (
          <Section>
            <EmptyState title={clients.length ? 'No match.' : 'No clients yet.'} action={clients.length ? undefined : <Button onClick={() => open({ kind: 'client' })}>Add a client</Button>}>
              {clients.length ? 'Try a different search.' : 'Add who you do FSA work for, then set up their projects and schedule meetings with them.'}
            </EmptyState>
          </Section>
        ) : (
          <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clientRows.map(({ c, projects: theirs }) => {
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
        )
      ) : projectRows.length === 0 ? (
        <Section>
          <EmptyState title={projects.length ? 'No match.' : 'No projects yet.'} action={projects.length || clients.length === 0 ? undefined : <Button onClick={() => open({ kind: 'project', value: {} })}>New project</Button>}>
            {projects.length ? 'Try a different filter.' : clients.length === 0 ? 'Add a client first; projects belong to a client.' : 'Set up the work you’re doing for a client.'}
          </EmptyState>
        </Section>
      ) : (
        <Section bodyClassName="p-2">
          <ul className="grid gap-0.5">
            {projectRows.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50">
                  <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', PROJECT_TONE[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{byClient.get(p.clientId)?.name}</span>
                  {p.dueDate && <span className="text-xs text-muted-foreground tabular-nums">Due {friendlyDate(p.dueDate, today)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
