import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, Reorder } from 'motion/react'
import { CalendarClock, CheckSquare, ChevronDown, GripVertical, PhoneCall, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { planSteps, STEP_KINDS } from '@/domain/plans/ActionPlan'
import type { PlanStep, StepKind } from '@/domain/plans/ActionPlan'
import type { StepDraft } from '@/domain/plans/PlanUseCases'
import type { EntityRef, ID, ISODate } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { friendlyDateTime } from '@/presentation/components/dates'
import { OutcomeControl, OutcomeNote } from '@/presentation/components/outcome'
import { useAction, useEntity, useStepPool, useToday } from '@/presentation/data/hooks'

const STEP_ICON: Record<StepKind, LucideIcon> = { task: CheckSquare, followUp: PhoneCall, appointment: CalendarClock }
const KINDS = Object.keys(STEP_KINDS) as StepKind[]

/**
 * A plan's steps: each is a task, a follow-up or an appointment with its own due day, which you can
 * change here. Reorder by dragging, record each step's outcome, add steps inline.
 */
export function PlanSteps({ planId, compact = false }: { planId: ID; compact?: boolean }) {
  const today = useToday()
  const plan = useEntity('plan', planId)
  const pool = useStepPool()
  const [order, setOrder] = useState<PlanStep[]>([])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<StepKind>('task')
  const [date, setDate] = useState<ISODate | undefined>(undefined)
  const reorder = useAction<ID[], void>((s, userId, ids) => s.plans.reorderSteps(userId, planId, ids))
  const addStep = useAction<StepDraft, EntityRef>((s, userId, draft) => s.plans.addStep(userId, planId, draft))

  useEffect(() => setOrder(planSteps(planId, pool)), [planId, pool])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addStep.run({ title: title.trim(), kind, dueDate: date ?? plan?.dueDate })
    setTitle('')
  }

  return (
    <div className="grid gap-1">
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="grid gap-0.5">
        <AnimatePresence initial={false}>
          {order.map((s, i) => (
            <Step key={s.id} step={s} index={i} today={today} planDue={plan?.dueDate} onDrop={() => reorder.run(order.map((x) => x.id))} />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <form onSubmit={add} className={cn('grid gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground focus-within:bg-muted/50', compact && 'px-1')}>
        <div className="flex items-center gap-2">
          <Plus className="size-4 shrink-0" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a step…" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" aria-label="Add a step" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-6">
          <div role="radiogroup" aria-label="What kind of step" className="inline-flex rounded-lg border p-0.5">
            {KINDS.map((k) => {
              const Icon = STEP_ICON[k]
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  title={`${STEP_KINDS[k].label} — ${STEP_KINDS[k].hint}`}
                  onClick={() => setKind(k)}
                  className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors', kind === k ? 'bg-foreground text-background' : 'hover:text-foreground')}
                >
                  <Icon className="size-3.5" /> {STEP_KINDS[k].label}
                </button>
              )
            })}
          </div>
          <label className="inline-flex items-center gap-1 text-xs">
            <span className="sr-only">Due</span>
            <DueDate value={date ?? plan?.dueDate} onChange={setDate} placeholder="Due" />
          </label>
          {title.trim() && (
            <Button type="submit" size="xs" loading={addStep.pending}>
              Add
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

/** A date that reads as a small chip but is a real date field. Empty is allowed: no due day. */
function DueDate({ value, onChange, placeholder, invalid }: { value: ISODate | undefined; onChange: (d: ISODate | undefined) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <input
      type="date"
      aria-label={placeholder ?? 'Due date'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={cn('rounded-md border bg-transparent px-1.5 py-0.5 text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50', invalid ? 'border-destructive/40 text-destructive' : 'text-muted-foreground')}
    />
  )
}

function Step({ step, index, today, planDue, onDrop }: { step: PlanStep; index: number; today: ISODate; planDue?: ISODate; onDrop: () => void }) {
  const { open } = useEditor()
  const pool = useStepPool()
  const closed = step.outcome.status !== 'open'
  const overdue = !closed && !!step.date && step.date < today
  const pastPlan = !!step.date && !!planDue && step.date > planDue
  const Icon = STEP_ICON[step.kind]
  const convert = useAction<StepKind, EntityRef>((s, userId, to) => s.plans.convertStep(userId, step.ref, to), { success: 'Step changed' })
  const reschedule = useAction<ISODate | undefined, void>((s, userId, date) => s.plans.setStepDate(userId, step.ref, date))

  function edit() {
    if (step.kind === 'task') open({ kind: 'task', value: pool.tasks.find((t) => t.id === step.id) })
    else if (step.kind === 'followUp') open({ kind: 'followUp', value: pool.followUps.find((f) => f.id === step.id) })
    else open({ kind: 'appointment', value: pool.meetings.find((m) => m.id === step.id) })
  }

  return (
    <Reorder.Item
      value={step}
      onDragEnd={onDrop}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgb(0 0 0 / 0.3)', zIndex: 10 }}
      className="group relative flex items-start gap-2 rounded-lg bg-card px-1.5 py-1.5 hover:bg-muted/40"
    >
      <GripVertical className="mt-1.5 size-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground active:cursor-grabbing" />
      <span className="mt-1 w-4 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">{index + 1}</span>
      <OutcomeControl target={step.ref.kind as 'task' | 'followUp' | 'meeting'} id={step.id} outcome={step.outcome} size="sm" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={edit} className="block w-full text-left">
          <div className={cn('text-sm', closed && 'text-muted-foreground line-through decoration-foreground/30')}>{step.title}</div>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <ActionMenu
            trigger={<button type="button" disabled={convert.pending} aria-label={`${STEP_KINDS[step.kind].label} — change the kind`} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60" />}
            triggerContent={
              <>
                <Icon className="size-3" /> {STEP_KINDS[step.kind].label} <ChevronDown className="size-3 opacity-60" />
              </>
            }
            items={KINDS.map((k) => {
              const KIcon = STEP_ICON[k]
              return { key: k, label: k === step.kind ? `${STEP_KINDS[k].label} (current)` : `Change to ${STEP_KINDS[k].label.toLowerCase()}`, icon: <KIcon className="size-4" />, onSelect: () => k !== step.kind && void convert.run(k) }
            })}
          />
          {closed ? (
            step.date && <span className="text-[11px] text-muted-foreground">{friendlyDateTime(step.date, step.time, today)}</span>
          ) : (
            <DueDate value={step.date} invalid={overdue} placeholder={`Due date of “${step.title}”`} onChange={(d) => (d || step.kind !== 'appointment') && void reschedule.run(d)} />
          )}
          {step.time !== undefined && !closed && step.date && <span className="text-[11px] text-muted-foreground">{friendlyDateTime(step.date, step.time, today).split(', ')[1]}</span>}
          {overdue && <span className="text-[11px] text-destructive">overdue</span>}
          {pastPlan && !closed && <span className="text-[11px] text-muted-foreground" title="This step is due after the plan’s own deadline">after the plan’s deadline</span>}
        </div>
        {closed && (step.outcome.comment || step.outcome.nextAction) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1">
            <OutcomeNote outcome={step.outcome} target={step.ref.kind as 'task' | 'followUp' | 'meeting'} />
          </motion.div>
        )}
      </div>
    </Reorder.Item>
  )
}
