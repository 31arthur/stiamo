import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Globe, Mail, Pencil, Phone, Plus } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, clientRefKeys, PROJECT_STATUS_LABELS, projectRank } from '@/domain/clients/Client'
import type { Client } from '@/domain/clients/Client'
import type { ID } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'
import { BackButton } from '@/presentation/components/BackButton'
import { ClientWork } from '@/presentation/clients/ClientWork'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { Meta, Section } from '@/presentation/components/layout'
import { useAction, useEntities, useEntity } from '@/presentation/data/hooks'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'
import { initials } from './CounselPage'
import { PROJECT_TONE } from './ClientsPage'

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useEntity('client', id)
  const { isLoading } = useEntities('client')
  if (!client) return isLoading ? null : <Navigate to="/clients" replace />
  return <ClientDetail key={client.id} client={client} />
}

function ClientDetail({ client: c }: { client: Client }) {
  useDocumentTitle(c.name)
  const navigate = useNavigate()
  const editor = useEditor()
  const { data: projects } = useEntities('project')
  const remove = useAction<ID, void>((s, userId, id) => s.clients.remove(userId, id), { success: 'Client deleted' })
  const theirs = useMemo(() => projects.filter((p) => p.clientId === c.id).sort((a, b) => projectRank(a) - projectRank(b) || a.title.localeCompare(b.title)), [projects, c.id])
  const keys = useMemo(() => clientRefKeys(c.id, projects), [c.id, projects])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback="/clients" />
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'client', value: c })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={`${c.name}${theirs.length ? ` and its ${theirs.length} project${theirs.length === 1 ? '' : 's'}` : ''} — meetings and tasks stay, but are no longer tied to them`}
            onConfirm={async () => {
              await remove.run(c.id)
              navigate('/clients')
            }}
          />
        </div>
      </div>

      <header className="flex flex-wrap items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ws-fsa-soft font-display text-3xl text-ws-fsa">{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{CLIENT_KIND_LABELS[c.kind]}</span>
            <span className={cn('rounded-md px-2 py-0.5 font-medium', c.status === 'active' ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>{CLIENT_STATUS_LABELS[c.status]}</span>
          </div>
          <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{c.name}</h1>
          {c.contactName && <p className="text-muted-foreground">{c.contactName}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {c.phone && (
              <Button variant="outline" size="sm" render={<a href={`tel:${c.phone}`} />}>
                <Phone /> {c.phone}
              </Button>
            )}
            {c.email && (
              <Button variant="outline" size="sm" render={<a href={`mailto:${c.email}`} />}>
                <Mail /> {c.email}
              </Button>
            )}
            {c.website && (
              <Button variant="outline" size="sm" render={<a href={/^https?:/i.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" />}>
                <Globe /> Website
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <Section
            title="Projects"
            description={`${theirs.filter((p) => p.status === 'active').length} in progress · ${theirs.length} in all`}
            actions={
              <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'project', value: { clientId: c.id } })}>
                <Plus /> Project
              </Button>
            }
            bodyClassName="p-2"
          >
            {theirs.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <ul className="grid gap-0.5">
                {theirs.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50">
                      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', PROJECT_TONE[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                      {p.dueDate && <span className="text-xs text-muted-foreground tabular-nums">Due {format(parseISO(p.dueDate), 'd MMM yyyy')}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <ClientWork target={{ kind: 'client', id: c.id }} keys={keys} counterpart={c.name} />

          <Section title="Thread & history" description="Projects, meetings, tasks and every change">
            <ThreadPanel root={{ kind: 'client', id: c.id }} />
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section title="Profile">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-4">
                <Meta label="Contact">{c.contactName ?? '—'}</Meta>
                <Meta label="Since">{format(parseISO(c.createdAt), 'MMM yyyy')}</Meta>
              </div>
              {c.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{c.notes}</p>}
            </div>
          </Section>
          <Section title="Documents" description="Contracts, proposals, briefs — upload a file or link a Google Doc">
            <AttachmentsPanel owner={{ kind: 'client', id: c.id }} compact />
          </Section>
        </div>
      </div>
    </>
  )
}
