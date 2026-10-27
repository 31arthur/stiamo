import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { HearingRecord } from '@/domain/cases/CaseUseCases'
import { CASE_STATUS_LABELS } from '@/domain/cases/LegalCase'
import type { CaseStatus, Hearing, LegalCase } from '@/domain/cases/LegalCase'
import type { OutcomeStatus } from '@/domain/shared/outcome'
import { DateInput, Field, NativeSelect, TimeInput } from '@/presentation/components/form'
import { OUTCOME_STYLE, outcomeLabel } from '@/presentation/components/outcome'
import { useAction, useEntities } from '@/presentation/data/hooks'
import { ActionListEditor } from '@/presentation/diary/ActionListEditor'
import type { ActionRow } from '@/presentation/diary/ActionListEditor'
import { DiaryFields } from '@/presentation/diary/DiaryFields'
import type { DiaryDetail } from '@/presentation/diary/DiaryFields'
import { FormShell } from '@/presentation/forms/shared'

const STATUSES: OutcomeStatus[] = ['done', 'partial', 'not_done', 'cancelled']

/**
 * Write up a hearing: what happened, the order, the next listing and the work it leaves behind.
 * It is the case diary entry for the date; the work becomes the action plan for the next stage.
 */
export function RecordHearingDialog({ hearing, legalCase, onClose }: { hearing: Hearing | null; legalCase: LegalCase; onClose: () => void }) {
  return (
    <Dialog open={hearing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {hearing && <RecordHearingForm key={hearing.id} hearing={hearing} legalCase={legalCase} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function RecordHearingForm({ hearing, legalCase, onClose }: { hearing: Hearing; legalCase: LegalCase; onClose: () => void }) {
  const { data: diary } = useEntities('diary')
  // Revising a hearing that's already written up starts from its diary entry, and doesn't list or plan again by default.
  const entry = diary.find((e) => e.hearingId === hearing.id)
  const revising = hearing.outcome.status !== 'open'

  const [summary, setSummary] = useState(hearing.summary ?? entry?.proceedings ?? '')
  const [status, setStatus] = useState<OutcomeStatus>(hearing.outcome.status === 'open' ? 'done' : hearing.outcome.status)
  const [comment, setComment] = useState(hearing.outcome.comment ?? '')
  const [detail, setDetail] = useState<DiaryDetail>({ bench: entry?.bench ?? hearing.forum, order: entry?.order, submissions: entry?.submissions, authorities: entry?.authorities ?? [], evidence: entry?.evidence, reflections: entry?.reflections })
  const [more, setMore] = useState(!!(entry?.submissions || entry?.evidence || entry?.reflections || entry?.authorities.length))
  const [actions, setActions] = useState<ActionRow[]>(entry?.actions ?? [])
  const [hasNext, setHasNext] = useState(!hearing.nextHearingId)
  const [nextDate, setNextDate] = useState<string | undefined>()
  const [nextTime, setNextTime] = useState<number | undefined>(hearing.time)
  const [nextPurpose, setNextPurpose] = useState('')
  const [makePlan, setMakePlan] = useState(!revising)
  const [planTitle, setPlanTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [stage, setStage] = useState(legalCase.stage ?? '')
  const [caseStatus, setCaseStatus] = useState<CaseStatus>(legalCase.status)

  const record = useAction<HearingRecord, unknown>((s, userId, r) => s.cases.recordHearing(userId, hearing.id, r), {
    success: 'Hearing recorded in the diary',
  })

  const defaultPlanTitle = `Prepare for ${nextPurpose || 'next hearing'}${nextDate ? ` — ${format(parseISO(nextDate), 'd MMM')}` : ''}`
  const open = actions.filter((a) => a.text.trim() && !a.taskId).length
  const patchDetail = (p: Partial<DiaryDetail>) => setDetail((d) => ({ ...d, ...p }))

  async function submit() {
    await record.run({
      summary,
      outcome: { status, comment },
      next: hasNext && nextDate ? { date: nextDate, time: nextTime, purpose: nextPurpose || 'Next hearing' } : undefined,
      // The plan's steps are the actions without a task yet, each due by its own date or the next hearing.
      plan: makePlan ? { title: planTitle.trim() || defaultPlanTitle, objective, steps: [] } : undefined,
      diary: { ...detail, actions },
      caseUpdate: { stage: stage || undefined, status: caseStatus },
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl font-normal tracking-tight">{revising ? 'Revise the diary entry' : 'Record hearing'}</DialogTitle>
        <DialogDescription>
          {legalCase.reference} · {format(parseISO(hearing.date), 'EEE d MMM yyyy')} · {hearing.purpose}
        </DialogDescription>
      </DialogHeader>
      <FormShell submitLabel={revising ? 'Save' : 'Record hearing'} onCancel={onClose} onSubmit={submit}>
        <Field label="What happened" htmlFor="rh-summary">
          <Textarea id="rh-summary" autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-28" placeholder="Who appeared, what was taken up, what the bench observed…" />
        </Field>
        <DiaryFields idPrefix="rh" value={detail} onChange={patchDetail} show={['order']} />
        <Field label="Result">
          <div role="radiogroup" aria-label="Result" className="grid grid-cols-4 gap-1.5">
            {STATUSES.map((s) => {
              const st = OUTCOME_STYLE[s]
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  onClick={() => setStatus(s)}
                  className={cn('flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors', status === s ? 'border-foreground/30 bg-muted' : 'text-muted-foreground hover:bg-muted/50')}
                >
                  <st.icon className={cn('size-4', st.className)} /> {outcomeLabel(s, 'hearing')}
                </button>
              )
            })}
          </div>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Short note, e.g. “Adjourned at respondent’s request”" />
        </Field>

        <div>
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn('size-4 transition-transform', !more && '-rotate-90')} /> Bench, submissions, authorities, evidence, reflections
          </button>
          {more && (
            <div className="mt-3">
              <DiaryFields idPrefix="rh" value={detail} onChange={patchDetail} show={['bench', 'submissions', 'authorities', 'evidence', 'reflections']} />
            </div>
          )}
        </div>

        <Toggle checked={hasNext} onChange={setHasNext} label="Next hearing listed" />
        <AnimatePresence initial={false}>
          {hasNext && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_2fr]">
                <Field label="Date" htmlFor="rh-date">
                  <DateInput id="rh-date" value={nextDate} onChange={setNextDate} />
                </Field>
                <Field label="Time" htmlFor="rh-time">
                  <TimeInput id="rh-time" value={nextTime} onChange={setNextTime} />
                </Field>
                <Field label="Listed for" htmlFor="rh-purpose">
                  <Input id="rh-purpose" value={nextPurpose} onChange={(e) => setNextPurpose(e.target.value)} placeholder="e.g. Final arguments" />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {revising && hearing.nextHearingId && !hasNext && <p className="-mt-2 text-xs text-muted-foreground">A next hearing was already listed from this one. Switch this on only to list another.</p>}

        <Field label="Work due before the next date" hint="Give a date to anything the court directed. Each becomes a task or a step of the plan.">
          <ActionListEditor actions={actions} onChange={setActions} />
        </Field>

        <Toggle checked={makePlan} onChange={setMakePlan} label={open ? `Turn the ${open} new action${open === 1 ? '' : 's'} into an action plan` : 'Create an action plan for the next stage'} />
        <AnimatePresence initial={false}>
          {makePlan && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid gap-3 rounded-xl bg-muted/50 p-3">
                <Field label="Plan" htmlFor="rh-plan">
                  <Input id="rh-plan" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder={defaultPlanTitle} />
                </Field>
                <Field label="Objective" htmlFor="rh-obj" hint="The actions above are its steps; add more on the plan page">
                  <Input id="rh-obj" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What must be ready by the next date?" />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!makePlan && open > 0 && <p className="-mt-2 text-xs text-muted-foreground">Without a plan, the actions stay in the diary entry — make them tasks from there when you’re ready.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Case stage" htmlFor="rh-stage">
            <Input id="rh-stage" value={stage} onChange={(e) => setStage(e.target.value)} />
          </Field>
          <Field label="Case status" htmlFor="rh-status">
            <NativeSelect id="rh-status" value={caseStatus} onChange={(e) => setCaseStatus(e.target.value as CaseStatus)}>
              {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
                <option key={s} value={s}>
                  {CASE_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FormShell>
    </>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-sm font-medium">
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-foreground' : 'bg-muted-foreground/30')}>
        <motion.span layout className={cn('absolute top-0.5 size-4 rounded-full bg-background shadow', checked ? 'right-0.5' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}
