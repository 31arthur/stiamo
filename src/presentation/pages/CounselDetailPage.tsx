import { format, parseISO } from 'date-fns'
import { HeartHandshake, Mail, MapPin, Pencil, Phone, Scale } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BackButton } from '@/presentation/components/BackButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CASE_STATUS_LABELS, CASE_TYPES, caseTypeOf } from '@/domain/cases/LegalCase'
import { COUNSEL_KIND_LABELS } from '@/domain/counsel/Counsel'
import type { Counsel } from '@/domain/counsel/Counsel'
import type { ID } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { Meta, Section } from '@/presentation/components/layout'
import { useAction, useEntities, useEntity } from '@/presentation/data/hooks'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'
import { CASE_STATUS_TONE } from '@/presentation/pages/CasesPage'
import { initials } from '@/presentation/pages/CounselPage'

export function CounselDetailPage() {
  const { id } = useParams<{ id: string }>()
  const counsel = useEntity('counsel', id)
  const { isLoading } = useEntities('counsel')
  if (!counsel) return isLoading ? null : <Navigate to="/counsel" replace />
  return <CounselDetail key={counsel.id} counsel={counsel} />
}

function CounselDetail({ counsel: c }: { counsel: Counsel }) {
  useDocumentTitle(c.name)
  const navigate = useNavigate()
  const editor = useEditor()
  const { data: cases } = useEntities('case')
  const remove = useAction<ID, void>((s, userId, id) => s.counsel.remove(userId, id), { success: 'Removed — their cases are back with us' })
  const briefed = cases.filter((x) => x.engagement?.counselId === c.id).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || (b.engagement?.engagedOn ?? '').localeCompare(a.engagement?.engagedOn ?? ''))

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback="/counsel" />
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'counsel', value: c })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={`${c.name} — ${briefed.length ? `their ${briefed.length} case${briefed.length === 1 ? '' : 's'} go back to being handled by us` : 'no cases are affected'}`}
            onConfirm={async () => {
              await remove.run(c.id)
              navigate('/counsel')
            }}
          />
        </div>
      </div>

      <header className="flex flex-wrap items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ws-sb-soft font-display text-3xl text-ws-sb">{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{COUNSEL_KIND_LABELS[c.kind]}</span>
            {c.proBono && (
              <span className="inline-flex items-center gap-1 rounded-md bg-ws-media-soft px-2 py-0.5 font-medium text-ws-media">
                <HeartHandshake className="size-3" /> Takes pro bono
              </span>
            )}
            {c.status === 'inactive' && <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">Not available</span>}
          </div>
          <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{c.name}</h1>
          {c.firm && <p className="text-muted-foreground">{c.firm}</p>}
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
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <Section title="Cases briefed" description={`${briefed.length} in all`} bodyClassName="p-2">
            {briefed.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Not briefed on any case yet. Open a case and choose “Brief counsel”.</p>
            ) : (
              <ul className="grid gap-2">
                {briefed.map((k) => (
                  <li key={k.id}>
                    <Link to={`/cases/${k.id}`} className="block rounded-xl border p-3 transition-colors hover:bg-muted/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{k.reference}</span>
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', CASE_STATUS_TONE[k.status])}>{CASE_STATUS_LABELS[k.status]}</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">{CASE_TYPES[caseTypeOf(k.type)].label}</span>
                      </div>
                      <div className="mt-1 font-medium">{k.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {k.engagement?.engagedOn && <span>Briefed {format(parseISO(k.engagement.engagedOn), 'd MMM yyyy')}</span>}
                        <span>{k.engagement?.proBono ? 'Pro bono' : (k.engagement?.fee ?? 'Fee not recorded')}</span>
                        {k.engagement?.scope && <span>{k.engagement.scope}</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Thread & history" description="Every case they’re on, and everything that happened on them">
            <ThreadPanel root={{ kind: 'counsel', id: c.id }} />
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section title="Profile">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-4">
                <Meta label="City">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {c.city ?? '—'}
                  </span>
                </Meta>
                <Meta label="Appears before">{c.courts ?? '—'}</Meta>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Good for</div>
                {c.expertise.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Not specified</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {c.expertise.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                        <Scale className="size-3" /> {CASE_TYPES[caseTypeOf(t)].label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {c.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{c.notes}</p>}
            </div>
          </Section>
          <Section title="Documents" description="Fee agreements, vakalatnamas, correspondence">
            <AttachmentsPanel owner={{ kind: 'counsel', id: c.id }} compact />
          </Section>
        </div>
      </div>
    </>
  )
}
