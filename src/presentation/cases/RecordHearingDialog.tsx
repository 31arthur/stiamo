import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
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
import { useAction } from '@/presentation/data/hooks'
import { FormShell, lines } from '@/presentation/forms/shared'

const STATUSES: OutcomeStatus[] = ['done', 'partial', 'not_done', 'cancelled']

/** Write up a hearing: what happened, the next listing, and the action plan to prepare for it. */
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
  const [summary, setSummary] = useState(hearing.summary ?? '')
  const [status, setStatus] = useState<OutcomeStatus>(hearing.outcome.status === 'open' ? 'done' : hearing.outcome.status)
  const [comment, setComment] = useState(hearing.outcome.comment ?? '')
  const [hasNext, setHasNext] = useState(true)
  const [nextDate, setNextDate] = useState<string | undefined>()
  const [nextTime, setNextTime] = useState<number | undefined>(hearing.time)
  const [nextPurpose, setNextPurpose] = useState('')
  const [makePlan, setMakePlan] = useState(true)
  const [planTitle, setPlanTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [steps, setSteps] = useState('')
  const [stage, setStage] = useState(legalCase.stage ?? '')
  const [caseStatus, setCaseStatus] = useState<CaseStatus>(legalCase.status)

  const record = useAction<HearingRecord, unknown>((s, userId, r) => s.cases.recordHearing(userId, hearing.id, r), {
    success: 'Hearing recorded',
  })

  const defaultPlanTitle = `Prepare for ${nextPurpose || 'next hearing'}${nextDate ? ` — ${format(parseISO(nextDate), 'd MMM')}` : ''}`

  async function submit() {
    await record.run({
      summary,
      outcome: { status, comment },
      next: hasNext && nextDate ? { date: nextDate, time: nextTime, purpose: nextPurpose || 'Next hearing' } : undefined,
      plan: makePlan ? { title: planTitle.trim() || defaultPlanTitle, objective, steps: lines(steps) } : undefined,
      caseUpdate: { stage: stage || undefined, status: caseStatus },
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl font-normal tracking-tight">Record hearing</DialogTitle>
        <DialogDescription>
          {legalCase.reference} · {format(parseISO(hearing.date), 'EEE d MMM yyyy')} · {hearing.purpose}
        </DialogDescription>
      </DialogHeader>
      <FormShell submitLabel="Record hearing" onCancel={onClose} onSubmit={submit}>
        <Field label="What happened" htmlFor="rh-summary">
          <Textarea id="rh-summary" autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-28" placeholder="Submissions made, orders passed, observations of the bench…" />
        </Field>
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

        <Toggle checked={makePlan} onChange={setMakePlan} label="Create the action plan for the next stage" />
        <AnimatePresence initial={false}>
          {makePlan && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid gap-3 rounded-xl bg-muted/50 p-3">
                <Field label="Plan" htmlFor="rh-plan">
                  <Input id="rh-plan" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder={defaultPlanTitle} />
                </Field>
                <Field label="Objective" htmlFor="rh-obj">
                  <Input id="rh-obj" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What must be ready by the next date?" />
                </Field>
                <Field label="Steps" htmlFor="rh-steps" hint="One per line — each becomes a task due before the next hearing">
                  <Textarea id="rh-steps" value={steps} onChange={(e) => setSteps(e.target.value)} className="min-h-24" placeholder={'Draft rejoinder\nCollect certified copies\nBrief senior counsel'} />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
