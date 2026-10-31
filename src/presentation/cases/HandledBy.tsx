import { useState } from 'react'
import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { Briefcase, Mail, MapPin, Phone, Undo2, UserCheck } from 'lucide-react'
import { Link } from '@/presentation/routing'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Engagement, LegalCase } from '@/domain/cases/LegalCase'
import { COUNSEL_KIND_LABELS, counselLabel } from '@/domain/counsel/Counsel'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { Section } from '@/presentation/components/layout'
import { useAction, useEntity } from '@/presentation/data/hooks'
import { FormShell } from '@/presentation/forms/shared'
import { ValidationError } from '@/domain/shared/errors'
import { emptyEngagement, EngagementFields } from './EngagementFields'

/** Who is running the case: us (the usual answer) or outside counsel, with the terms of the brief. */
export function HandledBy({ legalCase: c }: { legalCase: LegalCase }) {
  const [editing, setEditing] = useState(false)
  const counsel = useEntity('counsel', c.engagement?.counselId)
  const assign = useAction<Engagement | null, unknown>((s, userId, e) => s.cases.assignCounsel(userId, c.id, e), {
    success: (_r) => 'Updated who handles this case',
  })

  return (
    <Section
      title="Handled by"
      actions={
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Briefcase /> {c.engagement ? 'Change brief' : 'Brief counsel'}
        </Button>
      }
    >
      {!c.engagement ? (
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
            <UserCheck className="size-4" />
          </span>
          <div>
            <div className="text-sm font-medium">Handled by us</div>
            <p className="text-xs text-muted-foreground">We’re running this case ourselves. Brief outside counsel if it needs one.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ws-sb-soft text-xs font-semibold text-ws-sb">
              {(counsel?.name ?? '?').replace(/^adv\.?\s*/i, '').slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              {counsel ? (
                <Link to={`/counsel/${counsel.id}`} className="block truncate text-sm font-medium hover:underline">
                  {counselLabel(counsel)}
                </Link>
              ) : (
                <div className="text-sm font-medium text-muted-foreground">Counsel no longer in your directory</div>
              )}
              {counsel && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{COUNSEL_KIND_LABELS[counsel.kind]}</span>
                  {counsel.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {counsel.city}
                    </span>
                  )}
                  {counsel.phone && (
                    <a href={`tel:${counsel.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Phone className="size-3" /> {counsel.phone}
                    </a>
                  )}
                  {counsel.email && (
                    <a href={`mailto:${counsel.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Mail className="size-3" /> Email
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
            {c.engagement.engagedOn && <Row label="Briefed on">{format(parseISO(c.engagement.engagedOn), 'd MMM yyyy')}</Row>}
            <Row label="Terms">{c.engagement.proBono ? 'Pro bono' : (c.engagement.fee ?? 'Fee not recorded')}</Row>
            {c.engagement.scope && <Row label="Scope">{c.engagement.scope}</Row>}
            {c.engagement.notes && <Row label="Notes">{c.engagement.notes}</Row>}
          </dl>
          <ConfirmDelete what="this brief — the case goes back to being handled by us" onConfirm={() => assign.run(null)}>
            <Undo2 /> Take it back
          </ConfirmDelete>
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal tracking-tight">{c.engagement ? 'Change the brief' : 'Brief counsel'}</DialogTitle>
            <DialogDescription>
              {c.reference} — {c.title}
            </DialogDescription>
          </DialogHeader>
          {editing && <BriefForm legalCase={c} onDone={() => setEditing(false)} onSave={(e) => assign.run(e)} />}
        </DialogContent>
      </Dialog>
    </Section>
  )
}

function BriefForm({ legalCase: c, onSave, onDone }: { legalCase: LegalCase; onSave: (e: Engagement) => Promise<unknown>; onDone: () => void }) {
  const [value, setValue] = useState<Engagement>(c.engagement ?? emptyEngagement())
  return (
    <FormShell
      submitLabel="Save brief"
      onCancel={onDone}
      onSubmit={async () => {
        if (!value.counselId) throw new ValidationError('Choose the counsel')
        await onSave(value)
        onDone()
      }}
    >
      <EngagementFields value={value} onChange={setValue} caseType={c.type} idPrefix="brief" />
    </FormShell>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}
