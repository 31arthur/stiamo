import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PROJECT_STATUS_LABELS } from '@/domain/clients/Client'
import type { Project, ProjectStatus } from '@/domain/clients/Client'
import { useEditor } from '@/presentation/app/create'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'
import { BackButton } from '@/presentation/components/BackButton'
import { ClientWork } from '@/presentation/clients/ClientWork'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { Segmented } from '@/presentation/components/form'
import { Meta, Section } from '@/presentation/components/layout'
import { useEntities, useEntity, useRemove, useSave } from '@/presentation/data/hooks'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const project = useEntity('project', id)
  const { isLoading } = useEntities('project')
  if (!project) return isLoading ? null : <Navigate to="/projects" replace />
  return <ProjectDetail key={project.id} project={project} />
}

function ProjectDetail({ project: p }: { project: Project }) {
  useDocumentTitle(p.title)
  const navigate = useNavigate()
  const editor = useEditor()
  const client = useEntity('client', p.clientId)
  const save = useSave('project')
  const remove = useRemove('project', 'Project deleted')
  const keys = useMemo(() => new Set([`project:${p.id}`]), [p.id])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback="/projects" />
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'project', value: p })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={`${p.title} — meetings and tasks stay, but are no longer tied to it`}
            onConfirm={async () => {
              await remove.run(p.id)
              navigate('/projects')
            }}
          />
        </div>
      </div>

      <header className="min-w-0">
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Project{client && ' · '}
          {client && (
            <Link to={`/clients/${client.id}`} className="underline-offset-2 hover:underline">
              {client.name}
            </Link>
          )}
        </div>
        <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{p.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented<ProjectStatus>
            size="sm"
            label="Status"
            value={p.status}
            onChange={(status) => save.run({ ...p, status })}
            options={(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
          />
          {p.startDate && <Meta label="Started">{format(parseISO(p.startDate), 'd MMM yyyy')}</Meta>}
          {p.dueDate && <Meta label="Due">{format(parseISO(p.dueDate), 'd MMM yyyy')}</Meta>}
        </div>
        {p.description && <p className="mt-3 max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{p.description}</p>}
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <ClientWork target={{ kind: 'project', id: p.id }} keys={keys} counterpart={client?.name} />
        </div>
        <div className="grid content-start gap-4">
          <Section title="Documents" description="Specs, designs, contracts — upload a file or link a Google Doc">
            <AttachmentsPanel owner={{ kind: 'project', id: p.id }} compact />
          </Section>
          <Section title="Thread & history">
            <ThreadPanel root={{ kind: 'project', id: p.id }} />
          </Section>
        </div>
      </div>
    </>
  )
}
