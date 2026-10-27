import { useEffect, useState } from 'react'
import { DetailSkeleton } from '@/presentation/components/loading'
import type { FormEvent } from 'react'
import { AnimatePresence, Reorder } from 'motion/react'
import { ExternalLink, GripVertical, ListChecks, Pencil, Plus, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BackButton } from '@/presentation/components/BackButton'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MEETING_KINDS, MEETING_MODES } from '@/domain/meetings/Meeting'
import type { AgendaItem, Meeting } from '@/domain/meetings/Meeting'
import { planProgress } from '@/domain/plans/ActionPlan'
import { OPEN } from '@/domain/shared/outcome'
import { formatClock, formatDuration, slotEnd } from '@/domain/shared/time'
import { useEditor } from '@/presentation/app/create'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { friendlyDate } from '@/presentation/components/dates'
import { MEETING_KIND_ICON } from '@/presentation/components/kinds'
import { Meta, Section } from '@/presentation/components/layout'
import { OUTCOME_STYLE, OutcomeBadge, OutcomeControl, OutcomeEditor, OutcomeNote } from '@/presentation/components/outcome'
import { ProgressBar } from '@/presentation/components/progress'
import { RefChip } from '@/presentation/components/RefChip'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { useAction, useEntities, useEntity, useToday } from '@/presentation/data/hooks'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { useSaveMeeting } from '@/presentation/forms/MeetingForm'
import { MODE_ICON } from '@/presentation/meetings/MeetingCard'
import { FollowUpRow } from '@/presentation/pages/FollowUpsPage'
import { PlanSteps } from '@/presentation/plans/PlanSteps'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'


export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const meeting = useEntity('meeting', id)
  const { isLoading } = useEntities('meeting')
  if (!meeting) return isLoading ? <DetailSkeleton /> : <Navigate to="/meetings" replace />
  return <MeetingDetail key={meeting.id} meeting={meeting} />
}

function MeetingDetail({ meeting: m }: { meeting: Meeting }) {
  useDocumentTitle(m.title)
  const today = useToday()
  const navigate = useNavigate()
  const editor = useEditor()
  const save = useSaveMeeting()
  const { data: followUps } = useEntities('followUp')
  const remove = useAction<string, void>((s, userId, id) => s.meetings.remove(userId, id), { success: 'Deleted' })
  const KindIcon = MEETING_KIND_ICON[m.kind]
  const ModeIcon = MODE_ICON[m.mode]
  const confirmations = followUps.filter((f) => f.subject?.kind === 'meeting' && f.subject.id === m.id)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackButton fallback="/meetings" />
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: m.kind, value: m })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={m.title}
            onConfirm={async () => {
              await remove.run(m.id)
              navigate('/meetings')
            }}
          />
        </div>
      </div>

      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            <KindIcon className="size-3.5" /> {MEETING_KINDS[m.kind].label}
          </span>
          <WorkspaceBadge ws={m.workspace} />
          <OutcomeBadge outcome={m.outcome} target="meeting" />
          <RefChip refTo={m.related} />
        </div>
        <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{m.title}</h1>
        <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card/70 p-4 sm:grid-cols-4">
          <Meta label="When">
            {friendlyDate(m.slot.date, today)} · {formatClock(m.slot.start)}–{formatClock(slotEnd(m.slot))}
          </Meta>
          <Meta label="Duration">{formatDuration(m.slot.duration)}</Meta>
          <Meta label={MEETING_MODES[m.mode]}>
            <span className="inline-flex items-center gap-1">
              <ModeIcon className="size-3.5" />
              {m.link ? (
                <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                  Join link <ExternalLink className="size-3" />
                </a>
              ) : (
                (m.location ?? '—')
              )}
            </span>
          </Meta>
          <Meta label="With">{m.counterpart || m.attendees.join(', ') || '—'}</Meta>
        </div>
        {m.purpose && <p className="max-w-3xl text-sm text-muted-foreground">{m.purpose}</p>}
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <AgendaEditor meeting={m} onSave={(agenda) => save.run({ ...m, agenda })} />
          <MinutesEditor meeting={m} onSave={(minutes) => save.run({ ...m, minutes })} />
          <Section title="Thread & history" description="Linked cases, plans, follow-ups and everything that happened">
            <ThreadPanel root={{ kind: 'meeting', id: m.id }} />
          </Section>
        </div>
        <div className="grid content-start gap-4">
          <OutcomeSection meeting={m} />
          <Section title="Documents" description="Briefs, agendas, slides, recordings">
            <AttachmentsPanel owner={{ kind: 'meeting', id: m.id }} compact />
          </Section>
          <PrepSection meeting={m} />
          {(confirmations.length > 0 || m.kind === 'appointment') && (
            <Section title="Confirmations" description={m.confirmations.length ? 'Kept in sync with the appointment time' : 'Turn on in Edit to schedule calls'} bodyClassName="p-1.5">
              {confirmations.length ? (
                <ul className="grid">
                  {confirmations.map((f) => (
                    <FollowUpRow key={f.id} followUp={f} today={today} />
                  ))}
                </ul>
              ) : (
                <p className="px-2.5 py-2 text-sm text-muted-foreground">None scheduled.</p>
              )}
            </Section>
          )}
          {m.attendees.length > 0 && (
            <Section title="Attendees">
              <div className="flex flex-wrap gap-1.5">
                {m.attendees.map((a) => (
                  <span key={a} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {a}
                  </span>
                ))}
              </div>
              {m.contact && <p className="mt-3 text-xs text-muted-foreground">Contact: {m.contact}</p>}
            </Section>
          )}
        </div>
      </div>
    </>
  )
}

function AgendaEditor({ meeting: m, onSave }: { meeting: Meeting; onSave: (agenda: AgendaItem[]) => Promise<unknown> }) {
  const [items, setItems] = useState(m.agenda)
  const [topic, setTopic] = useState('')
  useEffect(() => setItems(m.agenda), [m.agenda])

  const planned = items.reduce((sum, a) => sum + (a.minutes ?? 0), 0)
  const covered = items.filter((a) => a.outcome.status !== 'open').length
  const update = (id: string, patch: Partial<AgendaItem>) => onSave(items.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    await onSave([...items, { id: crypto.randomUUID(), topic: topic.trim(), outcome: OPEN }])
    setTopic('')
  }

  return (
    <Section
      title={m.kind === 'appointment' ? 'Agenda & talking points' : 'Agenda'}
      description={
        items.length
          ? `${covered}/${items.length} covered${planned ? ` · ${formatDuration(planned)} planned of ${formatDuration(m.slot.duration)}` : ''}`
          : 'Prepare what this needs to cover'
      }
      bodyClassName="p-2"
    >
      {planned > m.slot.duration && <p className="mb-2 rounded-lg bg-warning/15 px-3 py-1.5 text-xs text-warning">Agenda runs {formatDuration(planned - m.slot.duration)} over the slot.</p>}
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="grid gap-1">
        <AnimatePresence initial={false}>
          {items.map((a, i) => (
            <Reorder.Item
              key={a.id}
              value={a}
              onDragEnd={() => onSave(items)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              whileDrag={{ scale: 1.015, boxShadow: '0 12px 30px -10px rgb(0 0 0 / 0.3)', zIndex: 10 }}
              className="group flex items-start gap-2 rounded-xl border bg-card p-2.5"
            >
              <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />
              <span className="mt-0.5 w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <AgendaOutcome item={a} meeting={m} onChange={(outcome) => update(a.id, { outcome })} />
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={a.topic}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== a.topic && update(a.id, { topic: e.target.value.trim() })}
                  className={cn('w-full bg-transparent text-sm font-medium outline-none', a.outcome.status === 'cancelled' && 'line-through opacity-60')}
                  aria-label="Agenda topic"
                />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    defaultValue={a.owner ?? ''}
                    onBlur={(e) => e.target.value !== (a.owner ?? '') && update(a.id, { owner: e.target.value || undefined })}
                    placeholder="Owner"
                    className="w-24 rounded bg-transparent outline-none placeholder:text-muted-foreground/60 focus:bg-muted"
                    aria-label="Owner"
                  />
                  <span className="inline-flex items-center">
                    <input
                      type="number"
                      min={0}
                      defaultValue={a.minutes ?? ''}
                      onBlur={(e) => update(a.id, { minutes: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="–"
                      className="w-8 rounded bg-transparent text-right outline-none focus:bg-muted"
                      aria-label="Minutes"
                    />
                    &nbsp;min
                  </span>
                </div>
                <textarea
                  defaultValue={a.notes ?? ''}
                  onBlur={(e) => e.target.value !== (a.notes ?? '') && update(a.id, { notes: e.target.value || undefined })}
                  placeholder="Notes / decision…"
                  rows={1}
                  className="mt-1 field-sizing-content w-full resize-none bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                />
                {(a.outcome.comment || a.outcome.nextAction) && <OutcomeNote outcome={a.outcome} target="agenda" />}
              </div>
              <button type="button" aria-label={`Remove ${a.topic}`} onClick={() => onSave(items.filter((x) => x.id !== a.id))} className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive">
                <X className="size-4" />
              </button>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <form onSubmit={add} className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground focus-within:bg-muted/50">
        <Plus className="size-4" />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Add agenda item…" className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground" aria-label="Add agenda item" />
      </form>
    </Section>
  )
}

/** Agenda items record outcomes on the meeting itself; further actions become linked tasks/follow-ups. */
function AgendaOutcome({ item, meeting: m, onChange }: { item: AgendaItem; meeting: Meeting; onChange: (o: AgendaItem['outcome']) => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const spawn = useAction<{ kind: 'task' | 'followUp'; title: string; date?: string; time?: number }, unknown>((s, userId, a) =>
    a.kind === 'task'
      ? s.crud.task.create(userId, { title: a.title, notes: '', workspace: m.workspace, priority: 'normal', estimate: 30, dueDate: a.date, related: { kind: 'meeting', id: m.id }, outcome: OPEN })
      : s.crud.followUp.create(userId, { title: a.title, channel: 'call', workspace: m.workspace, contact: m.contact || m.counterpart, due: a.date ? { date: a.date, time: a.time } : undefined, duration: 15, subject: { kind: 'meeting', id: m.id }, outcome: OPEN }),
    { success: 'Further action created' },
  )
  const style = OUTCOME_STYLE[item.outcome.status]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" aria-label="Agenda item outcome" className={cn('flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-muted', style.className)} />}>
        <style.icon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <OutcomeEditor
          value={item.outcome}
          target="agenda"
          onSubmit={async ({ outcome, spawn: s }) => {
            await onChange({ ...outcome, recordedAt: new Date().toISOString() })
            if (s) await spawn.run(s)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function MinutesEditor({ meeting: m, onSave }: { meeting: Meeting; onSave: (minutes: string) => Promise<unknown> }) {
  const [value, setValue] = useState(m.minutes ?? '')
  const dirty = value !== (m.minutes ?? '')
  return (
    <Section title="Minutes & notes" description="Saved when you click away" actions={dirty && <span className="text-[11px] text-muted-foreground">Unsaved…</span>}>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => dirty && onSave(value)} placeholder="Decisions, commitments, who said what…" className="min-h-40 border-none bg-transparent p-0 shadow-none focus-visible:ring-0" />
    </Section>
  )
}

function OutcomeSection({ meeting: m }: { meeting: Meeting }) {
  return (
    <Section title="Outcome" actions={<OutcomeControl target="meeting" id={m.id} outcome={m.outcome} />}>
      {m.outcome.status === 'open' ? (
        <p className="text-sm text-muted-foreground">Record whether it was held, how it went, and what happens next.</p>
      ) : (
        <OutcomeNote outcome={m.outcome} target="meeting" />
      )}
    </Section>
  )
}

function PrepSection({ meeting: m }: { meeting: Meeting }) {
  const { data: tasks } = useEntities('task')
  const plan = useEntity('plan', m.prepPlanId)
  const create = useAction<void, unknown>(
    async (s, userId) => {
      const steps = m.agenda.length ? m.agenda.map((a) => `Prepare: ${a.topic}`) : ['Gather documents', 'Draft talking points']
      const p = await s.plans.createWithSteps(
        userId,
        { title: `Prepare — ${m.title}`, objective: m.purpose ?? '', workspace: m.workspace, status: 'active', dueDate: m.slot.date, origin: { kind: 'meeting', id: m.id }, caseIds: m.related?.kind === 'case' ? [m.related.id] : undefined },
        steps,
      )
      await s.meetings.save(userId, { ...m, prepPlanId: p.id })
    },
    { success: 'Preparation plan created' },
  )

  if (!plan) {
    return (
      <Section title="Preparation">
        <p className="mb-3 text-sm text-muted-foreground">Turn the agenda into a preparation plan with steps you can track.</p>
        <Button variant="outline" size="sm" onClick={() => create.run()} disabled={create.pending}>
          <ListChecks /> Create preparation plan
        </Button>
      </Section>
    )
  }
  const progress = planProgress(plan.id, tasks)
  return (
    <Section
      title="Preparation"
      description={`${progress.done}/${progress.total} steps done`}
      actions={
        <Link to={`/plans/${plan.id}`} className="text-xs text-muted-foreground hover:text-foreground">
          Open plan →
        </Link>
      }
      bodyClassName="p-2"
    >
      <ProgressBar value={progress.progress ?? 0} className="mx-2 mb-2 w-auto" />
      <PlanSteps planId={plan.id} compact />
    </Section>
  )
}
