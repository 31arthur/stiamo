import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CONFIRMATION_LABELS, defaultConfirmations, MEETING_KINDS, MEETING_MODES } from '@/domain/meetings/Meeting'
import type { ConfirmationTiming, Meeting, MeetingKind, MeetingMode } from '@/domain/meetings/Meeting'
import { OPEN } from '@/domain/shared/outcome'
import { formatDuration } from '@/domain/shared/time'
import { DateInput, DURATION_PRESETS, Field, NativeSelect, Segmented, TimeInput, TokenInput } from '@/presentation/components/form'
import { MEETING_KIND_ICON } from '@/presentation/components/kinds'
import { WorkspacePicker } from '@/presentation/components/workspace'
import { useAction, useEntities, useToday } from '@/presentation/data/hooks'
import { ClientProjectField } from './ClientProjectField'
import { FormShell, lines, usePatch } from './shared'

export type MeetingDraft = Omit<Meeting, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newMeeting = (kind: MeetingKind, date: string, over: Partial<MeetingDraft> = {}): MeetingDraft => ({
  kind,
  title: '',
  workspace: kind === 'appointment' ? 'sb' : 'personal',
  slot: { date, start: 10 * 60, duration: kind === 'appointment' ? 45 : 60 },
  mode: kind === 'appointment' ? 'in_person' : 'virtual',
  attendees: [],
  agenda: [],
  confirmations: defaultConfirmations(kind),
  outcome: OPEN,
  ...over,
})

export function useSaveMeeting() {
  return useAction<Meeting | MeetingDraft, Meeting>((s, userId, m) => s.meetings.save(userId, m), {
    success: (m) => `${MEETING_KINDS[m.kind].label} saved${m.confirmations.length ? ' · confirmations scheduled' : ''}`,
  })
}

export function MeetingForm({ initial, onDone }: { initial: Meeting | MeetingDraft; onDone: (saved?: Meeting) => void }) {
  const today = useToday()
  const [m, patch] = usePatch(initial)
  const [agendaText, setAgendaText] = useState('')
  const { data: cases } = useEntities('case')
  const save = useSaveMeeting()
  const editing = 'createdAt' in initial

  const setKind = (kind: MeetingKind) => patch({ kind, confirmations: editing ? m.confirmations : defaultConfirmations(kind) })
  const toggleConfirmation = (c: ConfirmationTiming) =>
    patch({ confirmations: m.confirmations.includes(c) ? m.confirmations.filter((x) => x !== c) : [...m.confirmations, c] })

  async function submit() {
    const agenda = editing ? m.agenda : lines(agendaText).map((topic) => ({ id: crypto.randomUUID(), topic, outcome: OPEN }))
    onDone(await save.run({ ...m, agenda }))
  }

  return (
    <FormShell submitLabel={editing ? 'Save' : `Create ${MEETING_KINDS[m.kind].label.toLowerCase()}`} onCancel={() => onDone()} onSubmit={submit}>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kind">
        {(Object.keys(MEETING_KINDS) as MeetingKind[]).map((k) => {
          const Icon = MEETING_KIND_ICON[k]
          const selected = m.kind === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setKind(k)}
              className={cn('flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors', selected ? 'border-foreground/30 bg-muted' : 'hover:bg-muted/50')}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block text-sm font-medium">{MEETING_KINDS[k].label}</span>
                <span className="block text-[11px] text-muted-foreground">{MEETING_KINDS[k].description}</span>
              </span>
            </button>
          )
        })}
      </div>
      <Field label="Title" htmlFor="mt-title">
        <Input id="mt-title" autoFocus value={m.title} onChange={(e) => patch({ title: e.target.value })} placeholder={m.kind === 'appointment' ? 'e.g. Consultation — trust distribution' : 'e.g. Sprint planning'} />
      </Field>
      <Field label="Workspace">
        <WorkspacePicker id="mt-ws" value={m.workspace} onChange={(workspace) => patch({ workspace })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="mt-date">
          <DateInput id="mt-date" value={m.slot.date} onChange={(date) => patch({ slot: { ...m.slot, date: date ?? today } })} />
        </Field>
        <Field label="Starts" htmlFor="mt-start">
          <TimeInput id="mt-start" value={m.slot.start} onChange={(start) => patch({ slot: { ...m.slot, start: start ?? m.slot.start } })} />
        </Field>
        <Field label="Duration" htmlFor="mt-dur">
          <NativeSelect id="mt-dur" value={m.slot.duration} onChange={(e) => patch({ slot: { ...m.slot, duration: Number(e.target.value) } })}>
            {[...new Set([...DURATION_PRESETS, 180, m.slot.duration])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mode">
          <Segmented<MeetingMode> size="sm" label="Mode" value={m.mode} onChange={(mode) => patch({ mode })} options={(Object.keys(MEETING_MODES) as MeetingMode[]).map((v) => ({ value: v, label: MEETING_MODES[v] }))} />
        </Field>
        {m.mode === 'virtual' ? (
          <Field label="Link" htmlFor="mt-link">
            <Input id="mt-link" value={m.link ?? ''} onChange={(e) => patch({ link: e.target.value || undefined })} placeholder="https://" />
          </Field>
        ) : (
          <Field label={m.mode === 'phone' ? 'Dial-in / number' : 'Location'} htmlFor="mt-loc">
            <Input id="mt-loc" value={m.location ?? ''} onChange={(e) => patch({ location: e.target.value || undefined })} />
          </Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.kind === 'appointment' ? 'With (client / party)' : 'With'} htmlFor="mt-cp">
          <Input id="mt-cp" value={m.counterpart ?? ''} onChange={(e) => patch({ counterpart: e.target.value || undefined })} />
        </Field>
        <Field label="Contact for confirmations" htmlFor="mt-contact">
          <Input id="mt-contact" value={m.contact ?? ''} onChange={(e) => patch({ contact: e.target.value || undefined })} placeholder="Phone or email" />
        </Field>
      </div>
      <Field label="Attendees" htmlFor="mt-att" hint="Press Enter after each name">
        <TokenInput id="mt-att" values={m.attendees} onChange={(attendees) => patch({ attendees })} placeholder="Add people" />
      </Field>
      <Field label="Confirmation follow-ups" hint="Created automatically and kept in sync if you reschedule">
        <div className="flex gap-2">
          {(Object.keys(CONFIRMATION_LABELS) as ConfirmationTiming[]).map((c) => {
            const on = m.confirmations.includes(c)
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggleConfirmation(c)}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              >
                Call {CONFIRMATION_LABELS[c].toLowerCase()}
              </button>
            )
          })}
        </div>
      </Field>
      {m.workspace === 'sb' && (
        <Field label="Related case" htmlFor="mt-case">
          <NativeSelect id="mt-case" value={m.related?.kind === 'case' ? m.related.id : ''} onChange={(e) => patch({ related: e.target.value ? { kind: 'case', id: e.target.value } : undefined })}>
            <option value="">None</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} — {c.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {m.workspace === 'fsa' && (
        <ClientProjectField
          id="mt-client"
          value={m.related}
          onChange={(related, clientName) => patch({ related, counterpart: m.counterpart || clientName })}
        />
      )}
      <Field label="Purpose" htmlFor="mt-purpose">
        <Textarea id="mt-purpose" value={m.purpose ?? ''} onChange={(e) => patch({ purpose: e.target.value })} className="min-h-14" />
      </Field>
      {!editing && (
        <Field label="Agenda" htmlFor="mt-agenda" hint="One item per line — refine it on the meeting page">
          <Textarea id="mt-agenda" value={agendaText} onChange={(e) => setAgendaText(e.target.value)} className="min-h-20" />
        </Field>
      )}
    </FormShell>
  )
}
