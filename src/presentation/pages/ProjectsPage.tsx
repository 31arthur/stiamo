import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isOngoing, PROJECT_STATUS_LABELS, projectRank } from '@/domain/clients/Client'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { NativeSelect } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { PROJECT_TONE } from './ClientsPage'

/** The work FSA is doing, across every client. */
export function ProjectsPage() {
  const { open } = useEditor()
  const today = useToday()
  const { data: clients } = useEntities('client')
  const { data: projects } = useEntities('project')
  const { data: tasks } = useEntities('task')
  const [showDone, setShowDone] = useState(false)
  const [clientId, setClientId] = useState('')
  const [query, setQuery] = useState('')

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])
  const openTasks = useMemo(() => {
    const n = new Map<string, number>()
    for (const t of tasks) if (t.related?.kind === 'project' && t.outcome.status === 'open') n.set(t.related.id, (n.get(t.related.id) ?? 0) + 1)
    return n
  }, [tasks])

  const q = query.trim().toLowerCase()
  const rows = projects
    .filter((p) => (showDone || isOngoing(p)) && (!clientId || p.clientId === clientId) && (!q || `${p.title} ${clientName.get(p.clientId) ?? ''} ${p.description}`.toLowerCase().includes(q)))
    .sort((a, b) => projectRank(a) - projectRank(b) || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || a.title.localeCompare(b.title))

  return (
    <>
      <PageHeader
        eyebrow="FSA"
        title="Projects"
        description="The work being done for clients. Each project has its own meetings, tasks and documents."
        actions={
          <Button onClick={() => open({ kind: 'project', value: {} })} disabled={clients.length === 0}>
            <Plus /> Project
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="In progress" value={projects.filter((p) => p.status === 'active').length} tone="success" />
        <Stat label="Planned" value={projects.filter((p) => p.status === 'planned').length} />
        <Stat label="On hold" value={projects.filter((p) => p.status === 'on_hold').length} tone="warning" />
        <Stat label="Finished" value={projects.filter((p) => p.status === 'completed').length} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-9 w-full sm:w-56">
          <option value="">All clients</option>
          {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <button type="button" aria-pressed={showDone} onClick={() => setShowDone(!showDone)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', showDone ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
          Show finished
        </button>
        <Link to="/clients" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Go to clients →
        </Link>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" aria-label="Search projects" className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
        </div>
      </div>

      {rows.length === 0 ? (
        <Section>
          <EmptyState title={projects.length ? 'No match.' : 'No projects yet.'} action={projects.length || clients.length === 0 ? undefined : <Button onClick={() => open({ kind: 'project', value: {} })}>New project</Button>}>
            {projects.length ? 'Try a different filter, or show finished projects.' : clients.length === 0 ? 'Add a client first; every project belongs to one.' : 'Set up the work you’re doing for a client.'}
          </EmptyState>
        </Section>
      ) : (
        <Section bodyClassName="p-2">
          <ul className="grid gap-0.5">
            {rows.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="grid gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50 sm:grid-cols-[6.5rem_1fr_auto]">
                  <span className={cn('h-fit w-fit rounded px-1.5 py-0.5 text-[10px] font-medium', PROJECT_TONE[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{clientName.get(p.clientId) ?? 'No client'}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    {(openTasks.get(p.id) ?? 0) > 0 && <span>{openTasks.get(p.id)} open task{openTasks.get(p.id) === 1 ? '' : 's'}</span>}
                    {p.dueDate && <span>Due {friendlyDate(p.dueDate, today)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
