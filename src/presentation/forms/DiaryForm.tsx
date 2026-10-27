import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DIARY_KIND_LABELS } from '@/domain/diary/Diary'
import type { DiaryEntry, DiaryKind } from '@/domain/diary/Diary'
import { hearingsOf } from '@/domain/cases/LegalCase'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { DateInput, Field, NativeSelect, Segmented, TokenInput } from '@/presentation/components/form'
import { useAction, useEntities, useToday } from '@/presentation/data/hooks'
import { ActionListEditor } from '@/presentation/diary/ActionListEditor'
import type { ActionRow } from '@/presentation/diary/ActionListEditor'
import { DiaryFields } from '@/presentation/diary/DiaryFields'
import { FormShell, usePatch } from './shared'

export type DiaryDraft = Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newDiaryEntry = (today: string, over: Partial<DiaryDraft> = {}): DiaryDraft => ({ caseId: '', kind: 'chamber', date: today, proceedings: '', authorities: [], actions: [], ...over })

/** A diary entry written by hand: chamber work between dates, or a court entry for a date you didn't record at the time. */
export function DiaryForm({ initial, onDone }: { initial: DiaryEntry | DiaryDraft; onDone: (saved?: DiaryEntry) => void }) {
  const today = useToday()
  const [e, patch] = usePatch<DiaryEntry | DiaryDraft>(initial)
  const editing = 'createdAt' in initial
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const [more, setMore] = useState(!!(initial.order || initial.submissions || initial.evidence || initial.reflections || initial.bench || initial.authorities.length))
  const remove = useAction<string, void>((s, userId, id) => s.diary.remove(userId, id), { success: 'Diary entry deleted' })
  const save = useAction<DiaryEntry | DiaryDraft, DiaryEntry>((s, userId, entry) => s.diary.save(userId, entry), { success: editing ? 'Diary entry saved' : 'Added to the diary' })

  const court = e.kind === 'court'
  const caseHearings = e.caseId ? hearingsOf(e.caseId, hearings).filter((h) => h.date <= today || h.id === e.hearingId).reverse() : []
  const setKind = (kind: DiaryKind) => patch({ kind, hearingId: kind === 'court' ? e.hearingId : undefined })

  return (
    <FormShell
      submitLabel={editing ? 'Save' : 'Add to diary'}
      onCancel={() => onDone()}
      onSubmit={async () => onDone(await save.run(e))}
      danger={
        editing && (
          <ConfirmDelete
            what="this diary entry (tasks made from it are kept)"
            onConfirm={async () => {
              await remove.run((initial as DiaryEntry).id)
              onDone()
            }}
          />
        )
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<DiaryKind> label="Kind" value={e.kind} onChange={setKind} options={(Object.keys(DIARY_KIND_LABELS) as DiaryKind[]).map((k) => ({ value: k, label: k === 'court' ? 'Court entry' : 'Chamber work' }))} />
        <p className="text-xs text-muted-foreground">{court ? 'What happened on a date in court.' : 'Work done between dates: conferences, drafting, research.'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field label="Case" htmlFor="dy-case">
          <NativeSelect id="dy-case" value={e.caseId} onChange={(ev) => patch({ caseId: ev.target.value, hearingId: undefined })} disabled={editing}>
            <option value="">Choose a case…</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} — {c.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date" htmlFor="dy-date">
          <DateInput id="dy-date" value={e.date} onChange={(date) => patch({ date: date ?? today })} />
        </Field>
      </div>

      {court ? (
        <Field label="Hearing" htmlFor="dy-hearing" hint="Optional — ties the entry to a listed date">
          <NativeSelect id="dy-hearing" value={e.hearingId ?? ''} onChange={(ev) => {
            const h = caseHearings.find((x) => x.id === ev.target.value)
            patch({ hearingId: h?.id, date: h?.date ?? e.date, bench: e.bench ?? h?.forum })
          }}>
            <option value="">Not tied to a hearing</option>
            {caseHearings.map((h) => (
              <option key={h.id} value={h.id}>
                {format(parseISO(h.date), 'd MMM yyyy')} · {h.purpose}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <Field label="What was it" htmlFor="dy-title">
          <Input id="dy-title" autoFocus value={e.title ?? ''} onChange={(ev) => patch({ title: ev.target.value || undefined })} placeholder="e.g. Conference with the union, drafted the reply" />
        </Field>
      )}

      <Field label={court ? 'What happened' : 'Notes'} htmlFor="dy-proc">
        <Textarea id="dy-proc" value={e.proceedings} onChange={(ev) => patch({ proceedings: ev.target.value })} className="min-h-28" placeholder={court ? 'The proceedings of the day: who appeared, what was taken up…' : 'What was discussed, decided or done…'} />
      </Field>

      <div>
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn('size-4 transition-transform', !more && '-rotate-90')} /> {court ? 'Order, submissions, authorities, evidence' : 'Authorities and reflections'}
        </button>
        {more && (
          <div className="mt-3">
            {court ? (
              <DiaryFields idPrefix="dy" value={e} onChange={(p) => patch(p)} />
            ) : (
              <div className="grid gap-4">
                <Field label="Authorities consulted" htmlFor="dy-auth" hint="Press Enter after each">
                  <TokenInput id="dy-auth" values={e.authorities} onChange={(authorities) => patch({ authorities })} />
                </Field>
                <Field label="Reflections" htmlFor="dy-refl">
                  <Textarea id="dy-refl" value={e.reflections ?? ''} onChange={(ev) => patch({ reflections: ev.target.value || undefined })} className="min-h-16" />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>

      {court && (
        <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
          <Field label="Next date" htmlFor="dy-next">
            <DateInput id="dy-next" value={e.nextDate} onChange={(nextDate) => patch({ nextDate })} />
          </Field>
          <Field label="Listed for" htmlFor="dy-purpose">
            <Input id="dy-purpose" value={e.nextPurpose ?? ''} onChange={(ev) => patch({ nextPurpose: ev.target.value || undefined })} placeholder="e.g. Final arguments" />
          </Field>
        </div>
      )}

      <Field label="Work to do" hint="Each can become a task, or all of them an action plan, from the diary entry">
        <ActionListEditor actions={e.actions as ActionRow[]} onChange={(actions) => patch({ actions: actions as DiaryEntry['actions'] })} />
      </Field>
    </FormShell>
  )
}
