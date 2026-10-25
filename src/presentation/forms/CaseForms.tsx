import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CASE_STATUS_LABELS } from '@/domain/cases/LegalCase'
import type { CaseStatus, Hearing, LegalCase } from '@/domain/cases/LegalCase'
import { OPEN } from '@/domain/shared/outcome'
import { formatDuration } from '@/domain/shared/time'
import { DateInput, DURATION_PRESETS, Field, NativeSelect, TimeInput } from '@/presentation/components/form'
import { useSave, useToday } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

export type CaseDraft = Omit<LegalCase, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
export type HearingDraft = Omit<Hearing, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newCase = (): CaseDraft => ({ reference: '', title: '', client: '', court: '', status: 'active', summary: '' })

export const newHearing = (caseId: string, date: string): HearingDraft => ({ caseId, date, time: 10 * 60 + 30, duration: 60, purpose: '', outcome: OPEN })

export function CaseForm({ initial, onDone }: { initial: LegalCase | CaseDraft; onDone: (saved?: LegalCase) => void }) {
  const [c, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const save = useSave('case', editing ? 'Case updated' : 'Case opened')

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Open case'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(c))}>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="Case number" htmlFor="case-ref">
          <Input id="case-ref" autoFocus value={c.reference} onChange={(e) => patch({ reference: e.target.value })} placeholder="CS(COMM) 412/2025" />
        </Field>
        <Field label="Title" htmlFor="case-title">
          <Input id="case-title" value={c.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Client v. Opposing party" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="case-client">
          <Input id="case-client" value={c.client} onChange={(e) => patch({ client: e.target.value })} />
        </Field>
        <Field label="Opposing party" htmlFor="case-opp">
          <Input id="case-opp" value={c.opposingParty ?? ''} onChange={(e) => patch({ opposingParty: e.target.value || undefined })} />
        </Field>
        <Field label="Court / forum" htmlFor="case-court">
          <Input id="case-court" value={c.court} onChange={(e) => patch({ court: e.target.value })} />
        </Field>
        <Field label="Practice area" htmlFor="case-area">
          <Input id="case-area" value={c.practiceArea ?? ''} onChange={(e) => patch({ practiceArea: e.target.value || undefined })} />
        </Field>
        <Field label="Stage" htmlFor="case-stage">
          <Input id="case-stage" value={c.stage ?? ''} onChange={(e) => patch({ stage: e.target.value || undefined })} placeholder="Pleadings, Evidence, Arguments…" />
        </Field>
        <Field label="Status" htmlFor="case-status">
          <NativeSelect id="case-status" value={c.status} onChange={(e) => patch({ status: e.target.value as CaseStatus })}>
            {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Filed on" htmlFor="case-filed">
          <DateInput id="case-filed" value={c.filedOn} onChange={(filedOn) => patch({ filedOn })} />
        </Field>
      </div>
      {!editing && (
        <Field label="Case summary" htmlFor="case-summary">
          <Textarea id="case-summary" value={c.summary} onChange={(e) => patch({ summary: e.target.value })} className="min-h-24" placeholder="Facts, issues, relief sought…" />
        </Field>
      )}
    </FormShell>
  )
}

export function HearingForm({ initial, onDone }: { initial: Hearing | HearingDraft; onDone: (saved?: Hearing) => void }) {
  const today = useToday()
  const [h, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const save = useSave('hearing', editing ? 'Hearing updated' : 'Hearing listed')

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Add hearing'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(h))}>
      <Field label="Listed for" htmlFor="hr-purpose">
        <Input id="hr-purpose" autoFocus value={h.purpose} onChange={(e) => patch({ purpose: e.target.value })} placeholder="e.g. Cross-examination of PW-2" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="hr-date">
          <DateInput id="hr-date" value={h.date} onChange={(date) => patch({ date: date ?? today })} />
        </Field>
        <Field label="Time" htmlFor="hr-time">
          <TimeInput id="hr-time" value={h.time} onChange={(time) => patch({ time })} />
        </Field>
        <Field label="Block" htmlFor="hr-dur">
          <NativeSelect id="hr-dur" value={h.duration} onChange={(e) => patch({ duration: Number(e.target.value) })}>
            {[...new Set([...DURATION_PRESETS, 180, h.duration])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Court room / bench" htmlFor="hr-forum">
        <Input id="hr-forum" value={h.forum ?? ''} onChange={(e) => patch({ forum: e.target.value || undefined })} />
      </Field>
    </FormShell>
  )
}
