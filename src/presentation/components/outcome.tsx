import { useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Ban, Check, CheckCircle2, Circle, CircleDot, CornerDownRight, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { OUTCOME_LABELS } from '@/domain/shared/outcome'
import type { Outcome, OutcomeStatus } from '@/domain/shared/outcome'
import type { OutcomeTarget, SpawnRequest } from '@/domain/shared/RecordOutcomeUseCase'
import { shiftDate } from '@/domain/shared/time'
import type { ID, ISODate } from '@/domain/shared/types'
import { useAction, useToday } from '@/presentation/data/hooks'
import { spring } from '@/presentation/motion/presets'
import { DateInput, Segmented, TimeInput } from './form'

export const OUTCOME_STYLE: Record<OutcomeStatus, { icon: LucideIcon; className: string; chip: string }> = {
  open: { icon: Circle, className: 'text-muted-foreground', chip: 'bg-muted text-muted-foreground' },
  done: { icon: CheckCircle2, className: 'text-success', chip: 'bg-success/12 text-success' },
  partial: { icon: CircleDot, className: 'text-warning', chip: 'bg-warning/15 text-warning' },
  not_done: { icon: XCircle, className: 'text-destructive', chip: 'bg-destructive/10 text-destructive' },
  cancelled: { icon: Ban, className: 'text-muted-foreground', chip: 'bg-muted text-muted-foreground line-through' },
}

/** Which wording to use: a record kind, or an agenda item. */
export type OutcomeVocab = OutcomeTarget | 'agenda'

/** How each kind of thing talks about its result. */
export const OUTCOME_VOCAB: Record<OutcomeVocab, Partial<Record<OutcomeStatus, string>>> = {
  agenda: { done: 'Covered', partial: 'Partly covered', not_done: 'Not covered', cancelled: 'Dropped' },
  task: {},
  followUp: { done: 'Reached', partial: 'Left message', not_done: 'Gave up' },
  meeting: { done: 'Held', partial: 'Partly covered', not_done: 'Didn’t happen' },
  hearing: { done: 'Proceeded', partial: 'Part-heard', not_done: 'Adjourned' },
}

export const outcomeLabel = (status: OutcomeStatus, target?: OutcomeVocab) => (target && OUTCOME_VOCAB[target][status]) ?? OUTCOME_LABELS[status]

export function OutcomeBadge({ outcome, target, className }: { outcome: Outcome; target?: OutcomeVocab; className?: string }) {
  const style = OUTCOME_STYLE[outcome.status]
  const Icon = style.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', style.chip, className)}>
      <Icon className="size-3" />
      {outcomeLabel(outcome.status, target)}
    </span>
  )
}

export interface OutcomeSubmit {
  outcome: Outcome
  spawn?: SpawnRequest
}

interface OutcomeEditorProps {
  value: Outcome
  target: OutcomeVocab
  onSubmit: (result: OutcomeSubmit) => Promise<unknown> | void
  onCancel?: () => void
  submitLabel?: string
  /** Hide the spawn controls (e.g. where the caller handles follow-through itself). */
  allowSpawn?: boolean
}

const STATUSES: OutcomeStatus[] = ['done', 'partial', 'not_done', 'cancelled', 'open']

/** Status + comment + further action, optionally created right away as a task or follow-up. */
export function OutcomeEditor({ value, target, onSubmit, onCancel, submitLabel = 'Record outcome', allowSpawn = true }: OutcomeEditorProps) {
  const today = useToday()
  const [status, setStatus] = useState<OutcomeStatus>(value.status === 'open' ? 'done' : value.status)
  const [comment, setComment] = useState(value.comment ?? '')
  const [nextAction, setNextAction] = useState(value.nextAction ?? '')
  const [spawnKind, setSpawnKind] = useState<'none' | 'task' | 'followUp'>('none')
  const [spawnDate, setSpawnDate] = useState<ISODate>(shiftDate(today, 1))
  const [spawnTime, setSpawnTime] = useState<number | undefined>(undefined)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const spawn: SpawnRequest | undefined =
      spawnKind !== 'none' && nextAction.trim() ? { kind: spawnKind, title: nextAction, date: spawnDate, time: spawnKind === 'followUp' ? spawnTime : undefined } : undefined
    await onSubmit({ outcome: { status, comment, nextAction }, spawn })
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div role="radiogroup" aria-label="Outcome" className="grid grid-cols-5 gap-1">
        {STATUSES.map((s) => {
          const style = OUTCOME_STYLE[s]
          const Icon = style.icon
          const selected = s === status
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStatus(s)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors',
                selected ? 'border-foreground/20 bg-muted text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/60',
              )}
            >
              <Icon className={cn('size-4', style.className)} />
              <span className="leading-tight">{outcomeLabel(s, target)}</span>
            </button>
          )
        })}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment — what happened?" className="min-h-16 text-sm" />
      <div className="grid gap-2">
        <div className="relative">
          <CornerDownRight className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Further action needed (optional)" className="pl-8" />
        </div>
        <AnimatePresence initial={false}>
          {allowSpawn && nextAction.trim() && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid gap-2 rounded-lg bg-muted/60 p-2">
                <Segmented
                  size="sm"
                  label="Create further action as"
                  value={spawnKind}
                  onChange={setSpawnKind}
                  options={[
                    { value: 'none', label: 'Just note it' },
                    { value: 'task', label: 'Create task' },
                    { value: 'followUp', label: 'Create follow-up' },
                  ]}
                />
                {spawnKind !== 'none' && (
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput value={spawnDate} onChange={(d) => d && setSpawnDate(d)} />
                    {spawnKind === 'followUp' && <TimeInput value={spawnTime} onChange={setSpawnTime} />}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function useRecordOutcome() {
  return useAction<{ ref: { kind: OutcomeTarget; id: ID } } & OutcomeSubmit, { spawned?: unknown }>(
    (s, userId, { ref, outcome, spawn }) => s.outcomes.execute(userId, ref, outcome, spawn),
    { success: (r) => (r.spawned ? 'Outcome recorded · further action created' : 'Outcome recorded') },
  )
}

/**
 * The status circle used in every list: one click on "Done" closes it; the popover also records
 * partly/not done/cancelled with a comment and further action.
 */
export function OutcomeControl({ target, id, outcome, size = 'md' }: { target: OutcomeTarget; id: ID; outcome: Outcome; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false)
  const record = useRecordOutcome()
  const style = OUTCOME_STYLE[outcome.status]
  const Icon = style.icon

  const quick = async (status: OutcomeStatus) => {
    await record.run({ ref: { kind: target, id }, outcome: { ...outcome, status } })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            transition={spring.snappy}
            aria-label={`Outcome: ${outcomeLabel(outcome.status, target)}. Change`}
            className={cn('flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted', size === 'sm' ? 'size-5' : 'size-7', style.className)}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
        {outcome.status === 'open' && (
          <Button size="sm" className="w-full" onClick={() => quick('done')}>
            <Check /> Mark {outcomeLabel('done', target).toLowerCase()}
          </Button>
        )}
        {outcome.status !== 'open' && (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
            <OutcomeBadge outcome={outcome} target={target} />
            <button className="text-muted-foreground hover:text-foreground" onClick={() => quick('open')}>
              Reopen
            </button>
          </div>
        )}
        <OutcomeEditor
          value={outcome}
          target={target}
          onSubmit={async (r) => {
            await record.run({ ref: { kind: target, id }, ...r })
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Shows a recorded outcome's comment and further action. */
export function OutcomeNote({ outcome, target }: { outcome: Outcome; target?: OutcomeVocab }) {
  if (outcome.status === 'open' && !outcome.comment) return null
  return (
    <div className="grid gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={outcome} target={target} />
        {outcome.comment && <span className="text-muted-foreground">{outcome.comment}</span>}
      </div>
      {outcome.nextAction && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <CornerDownRight className="size-3" /> {outcome.nextAction}
        </div>
      )}
    </div>
  )
}
