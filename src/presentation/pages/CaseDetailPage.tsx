import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { AlertCircle, ArrowLeft, CalendarPlus, Gavel, Link2, ListChecks, NotebookPen, Paperclip, Pencil } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CASE_STATUS_LABELS, hearingsOf } from '@/domain/cases/LegalCase'
import type { Hearing, LegalCase } from '@/domain/cases/LegalCase'
import { planProgress } from '@/domain/plans/ActionPlan'
import { formatClock, instantKey } from '@/domain/shared/time'
import { useEditor } from '@/presentation/app/create'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { RecordHearingDialog } from '@/presentation/cases/RecordHearingDialog'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { friendlyDate, relativeDays } from '@/presentation/components/dates'
import { Meta, Section } from '@/presentation/components/layout'
import { OutcomeBadge } from '@/presentation/components/outcome'
import { ProgressBar } from '@/presentation/components/progress'
import { useAction, useEntities, useEntity, useGraph, useSave, useToday } from '@/presentation/data/hooks'
import type { RecordInfo } from '@/presentation/components/records'
import { LinkPicker } from '@/presentation/relations/LinkPicker'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'
import { useAttachments } from '@/presentation/attachments/useAttachments'
import { newHearing } from '@/presentation/forms/CaseForms'
import { MeetingCard } from '@/presentation/meetings/MeetingCard'
import { FollowUpRow } from '@/presentation/pages/FollowUpsPage'
import { CASE_STATUS_TONE } from '@/presentation/pages/CasesPage'
import { PlanSteps } from '@/presentation/plans/PlanSteps'
import { TaskRow } from '@/presentation/tasks/TaskRow'
import { spring } from '@/presentation/motion/presets'

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const legalCase = useEntity('case', id)
  const { isLoading } = useEntities('case')
  if (!legalCase) return isLoading ? null : <Navigate to="/cases" replace />
  return <CaseDetail key={legalCase.id} legalCase={legalCase} />
}

function CaseDetail({ legalCase: c }: { legalCase: LegalCase }) {
  useDocumentTitle(c.title)
  const today = useToday()
  const navigate = useNavigate()
  const editor = useEditor()
  const [recording, setRecording] = useState<Hearing | null>(null)
  const { data: hearings } = useEntities('hearing')
  const { data: plans } = useEntities('plan')
  const { data: tasks } = useEntities('task')
  const { data: meetings } = useEntities('meeting')
  const { data: followUps } = useEntities('followUp')
  const remove = useAction<string, void>((s, userId, id) => s.cases.remove(userId, id), { success: 'Case deleted' })

  const list = hearingsOf(c.id, hearings)
  const unrecorded = list.filter((h) => h.date < today && h.outcome.status === 'open')
  const casePlans = plans.filter((p) => p.caseId === c.id).sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1))
  const isAboutCase = (r?: { kind: string; id: string }) => r?.kind === 'case' && r.id === c.id
  // Every meeting connected to the case — held about it or linked to it by hand.
  const graph = useGraph()
  const connectedIds = new Set(graph.neighbors({ kind: 'case', id: c.id }).filter((n) => n.ref.kind === 'meeting').map((n) => n.ref.id))
  const caseMeetings = meetings
    .filter((m) => connectedIds.has(m.id))
    .sort((a, b) => (a.slot.date >= today ? 0 : 1) - (b.slot.date >= today ? 0 : 1) || a.slot.date.localeCompare(b.slot.date))
  const [linking, setLinking] = useState(false)
  const linkMeeting = useAction<RecordInfo, unknown>((s, userId, t) => s.links.link(userId, { kind: 'case', id: c.id }, t.ref, { a: c.title, b: t.title }), { success: 'Meeting linked to the case' })
  const caseFollowUps = followUps.filter((f) => isAboutCase(f.subject) && f.outcome.status === 'open')
  const caseTasks = tasks.filter((t) => isAboutCase(t.related) && !t.planId && t.outcome.status === 'open')

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Cases
        </Link>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'hearing', value: newHearing(c.id, today) })}>
            <CalendarPlus /> List hearing
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'case', value: c })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={`${c.reference} and its hearings`}
            onConfirm={async () => {
              await remove.run(c.id)
              navigate('/cases')
            }}
          />
        </div>
      </div>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{c.reference}</span>
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', CASE_STATUS_TONE[c.status])}>{CASE_STATUS_LABELS[c.status]}</span>
          {c.practiceArea && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{c.practiceArea}</span>}
        </div>
        <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{c.title}</h1>
        <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card/70 p-4 sm:grid-cols-5">
          <Meta label="Client">{c.client}</Meta>
          <Meta label="Opposing party">{c.opposingParty ?? '—'}</Meta>
          <Meta label="Court">{c.court}</Meta>
          <Meta label="Stage">{c.stage ?? '—'}</Meta>
          <Meta label="Filed">{c.filedOn ? format(parseISO(c.filedOn), 'd MMM yyyy') : '—'}</Meta>
        </div>
      </header>

      {unrecorded.map((h) => (
        <motion.div
          key={h.id}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
        >
          <AlertCircle className="size-4 text-destructive" />
          <span className="flex-1 text-sm">
            The hearing on <span className="font-medium">{friendlyDate(h.date, today)}</span> ({h.purpose}) hasn’t been written up.
          </span>
          <Button size="sm" onClick={() => setRecording(h)}>
            <NotebookPen /> Record hearing
          </Button>
        </motion.div>
      ))}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="grid content-start gap-4">
          <SummaryEditor legalCase={c} />
          <Section title="Hearings" description={`${list.length} listed`} actions={<Gavel className="size-4 text-muted-foreground" />}>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hearings listed yet.</p>
            ) : (
              <ol className="relative grid gap-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-border">
                {[...list].reverse().map((h) => (
                  <HearingItem key={h.id} hearing={h} today={today} onRecord={() => setRecording(h)} onEdit={() => editor.open({ kind: 'hearing', value: h })} />
                ))}
              </ol>
            )}
          </Section>
          <Section title="Thread & history" description="Everything connected to this case, and everything that happened">
            <ThreadPanel root={{ kind: 'case', id: c.id }} />
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section
            title="Action plans"
            actions={
              <Button variant="ghost" size="sm" onClick={() => editor.open({ kind: 'plan', value: { caseId: c.id, workspace: 'sb', origin: { kind: 'case', id: c.id } } })}>
                <ListChecks /> New
              </Button>
            }
            bodyClassName="grid gap-4 p-2"
          >
            {casePlans.length === 0 && <p className="p-2 text-sm text-muted-foreground">Plans are created when you record a hearing, or start one here.</p>}
            {casePlans.map((p) => {
              const prog = planProgress(p.id, tasks)
              return (
                <div key={p.id} className={cn('rounded-xl border p-2', p.status !== 'active' && 'opacity-70')}>
                  <div className="flex items-start justify-between gap-2 px-1.5 pt-1">
                    <Link to={`/plans/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {prog.done}/{prog.total}
                      {p.dueDate && ` · by ${friendlyDate(p.dueDate, today)}`}
                    </span>
                  </div>
                  {p.objective && <p className="px-1.5 text-xs text-muted-foreground">{p.objective}</p>}
                  <ProgressBar value={prog.progress ?? 0} className="mx-1.5 my-2 w-auto" />
                  <PlanSteps planId={p.id} compact />
                </div>
              )
            })}
          </Section>
          <Section title="Case documents" description="Pleadings, orders, evidence, correspondence">
            <AttachmentsPanel owner={{ kind: 'case', id: c.id }} compact />
          </Section>
          <Section
            title="Meetings & appointments"
            description={`${caseMeetings.length} connected to this case`}
            actions={
              <Button variant="ghost" size="sm" onClick={() => setLinking(true)}>
                <Link2 /> Link
              </Button>
            }
            bodyClassName="p-2"
          >
            {caseMeetings.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Link existing meetings, or set this case on an appointment.</p>
            ) : (
              <ul className="grid gap-2">
                {caseMeetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} needsOutcome={m.slot.date < today && m.outcome.status === 'open'} confirmations={[]} />
                ))}
              </ul>
            )}
          </Section>
          <LinkPicker
            open={linking}
            onOpenChange={setLinking}
            from={{ kind: 'case', id: c.id }}
            exclude={caseMeetings.map((m) => ({ kind: 'meeting' as const, id: m.id }))}
            onPick={(t) => linkMeeting.run(t)}
          />
          {(caseFollowUps.length > 0 || caseTasks.length > 0) && (
            <Section title="Open follow-ups & tasks" bodyClassName="p-1.5">
              <ul className="grid">
                {caseFollowUps.map((f) => (
                  <FollowUpRow key={f.id} followUp={f} today={today} />
                ))}
                {caseTasks.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      <RecordHearingDialog hearing={recording} legalCase={c} onClose={() => setRecording(null)} />
    </>
  )
}

function HearingItem({ hearing: h, today, onRecord, onEdit }: { hearing: Hearing; today: string; onRecord: () => void; onEdit: () => void }) {
  const [showFiles, setShowFiles] = useState(false)
  const fileCount = useAttachments({ kind: 'hearing', id: h.id }).length
  const past = instantKey(h.date) < instantKey(today)
  const upcoming = !past && h.outcome.status === 'open'
  return (
    <motion.li layout transition={spring.soft} className="relative">
      <span
        className={cn(
          'absolute top-1.5 -left-6 size-[15px] rounded-full border-2 border-background',
          upcoming ? 'bg-ws-sb ring-4 ring-ws-sb/20' : h.outcome.status === 'open' ? 'bg-destructive' : 'bg-muted-foreground/40',
        )}
      />
      <div className={cn('rounded-xl border p-3', upcoming && 'border-ws-sb/30 bg-ws-sb-soft/40')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold tabular-nums">
              {format(parseISO(h.date), 'EEE d MMM yyyy')}
              {h.time !== undefined && ` · ${formatClock(h.time)}`}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{relativeDays(h.date, today)}</span>
            </div>
            <div className="text-sm">
              {h.purpose}
              {h.forum && <span className="text-muted-foreground"> · {h.forum}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {h.outcome.status !== 'open' && <OutcomeBadge outcome={h.outcome} target="hearing" />}
            {(past || h.date === today) && (
              <Button size="sm" variant={h.outcome.status === 'open' ? 'default' : 'ghost'} onClick={onRecord}>
                <NotebookPen /> {h.outcome.status === 'open' ? 'Record' : 'Revise'}
              </Button>
            )}
            {upcoming && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil />
              </Button>
            )}
          </div>
        </div>
        {h.summary && <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{h.summary}</p>}
        {h.outcome.comment && <p className="mt-1 text-xs text-muted-foreground italic">{h.outcome.comment}</p>}
        <button type="button" onClick={() => setShowFiles(!showFiles)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Paperclip className="size-3" /> {fileCount ? `${fileCount} file${fileCount === 1 ? '' : 's'}` : 'Attach order sheet / documents'}
        </button>
        {showFiles && <AttachmentsPanel owner={{ kind: 'hearing', id: h.id }} compact className="mt-2" />}
      </div>
    </motion.li>
  )
}

function SummaryEditor({ legalCase: c }: { legalCase: LegalCase }) {
  const [value, setValue] = useState(c.summary)
  const save = useSave('case', 'Summary saved')
  const dirty = value !== c.summary
  return (
    <Section title="Case summary" description="Facts, issues, strategy — revise it as the matter evolves" actions={dirty && <span className="text-[11px] text-muted-foreground">Unsaved…</span>}>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => dirty && save.run({ ...c, summary: value })}
        className="min-h-40 border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
        placeholder="Write the case summary…"
      />
    </Section>
  )
}
