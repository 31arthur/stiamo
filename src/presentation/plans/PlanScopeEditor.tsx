import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Gavel, Link2, Plus, Scale, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { coversCase, coversHearing, planCaseIds, planHearingIds } from '@/domain/plans/ActionPlan'
import { hearingCaseIds } from '@/domain/cases/LegalCase'
import type { Hearing } from '@/domain/cases/LegalCase'
import type { ActionPlan } from '@/domain/plans/ActionPlan'
import type { EntityRef } from '@/domain/shared/types'
import { KIND_META } from '@/presentation/components/kinds'
import { RefChip } from '@/presentation/components/RefChip'
import { useAction, useEntities } from '@/presentation/data/hooks'

/**
 * What a plan applies to. One plan can cover several cases and several hearings — the same
 * approach reused — and stays one page with one set of steps. Hearings sit under their case;
 * a case with no hearings listed is covered as a whole.
 */
export function PlanScopeEditor({ plan }: { plan: ActionPlan }) {
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: tasks } = useEntities('task')
  const [picking, setPicking] = useState(false)
  const cover = useAction<EntityRef, unknown>((s, userId, ref) => s.plans.cover(userId, plan.id, ref))
  const uncover = useAction<EntityRef, unknown>((s, userId, ref) => s.plans.uncover(userId, plan.id, ref))

  const caseIds = planCaseIds(plan).filter((id) => cases.some((c) => c.id === id))
  const hearingIds = planHearingIds(plan)
  const task = plan.taskId ? tasks.find((t) => t.id === plan.taskId) : undefined
  const shared = caseIds.length > 1 || hearingIds.filter((id) => hearings.some((h) => h.id === id)).length > 1
  const empty = caseIds.length === 0 && !task

  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5">
        {caseIds.map((id) => {
          const c = cases.find((x) => x.id === id)!
          const mine = hearings.filter((h) => hearingCaseIds(h).includes(id) && hearingIds.includes(h.id)).sort((a, b) => a.date.localeCompare(b.date))
          return (
            <div key={id} className="flex flex-wrap items-center gap-1.5">
              <Chip icon={Scale} label={`${c.reference} · ${c.title}`} onRemove={() => uncover.run({ kind: 'case', id })} removeLabel={`Stop covering ${c.reference}`} />
              {mine.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">whole case</span>
              ) : (
                mine.map((h) => <Chip key={h.id} icon={Gavel} muted label={`${format(parseISO(h.date), 'd MMM yyyy')} · ${h.purpose}`} onRemove={() => uncover.run({ kind: 'hearing', id: h.id })} removeLabel={`Stop covering the ${h.date} hearing`} />)
              )}
            </div>
          )
        })}
        {task && <Chip icon={KIND_META.task.icon} label={task.title} onRemove={() => uncover.run({ kind: 'task', id: task.id })} removeLabel="Stop covering this task" />}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button variant="outline" size="xs" onClick={() => setPicking(true)}>
          <Plus /> {empty ? 'Tie to a case, hearing or task' : 'Add'}
        </Button>
        {empty && <span className="text-[11px] text-muted-foreground">General for now — not tied to anything.</span>}
        {shared && <span className="text-[11px] text-muted-foreground">Shared: one page and one set of steps for all of these.</span>}
      </div>
      <CoveragePicker open={picking} onOpenChange={setPicking} plan={plan} onPick={(ref) => cover.run(ref)} />
    </div>
  )
}

function Chip({ icon: Icon, label, onRemove, removeLabel, muted }: { icon: typeof Scale; label: string; onRemove: () => void; removeLabel: string; muted?: boolean }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md border py-0.5 pr-0.5 pl-1.5 text-xs', muted ? 'bg-muted/50 text-muted-foreground' : 'bg-background')}>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
      <button type="button" aria-label={removeLabel} onClick={onRemove} className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted">
        <X className="size-3" />
      </button>
    </span>
  )
}

/** Pick a hearing, case or task for a plan to cover. Hearings come first: they're what's usually reused. */
function CoveragePicker({ open, onOpenChange, plan, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; plan: ActionPlan; onPick: (ref: EntityRef) => void }) {
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: tasks } = useEntities('task')
  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])
  const refsOf = (h: Hearing) => hearingCaseIds(h).map((id) => caseById.get(id)?.reference).filter(Boolean).join(' + ')

  const hearingOptions = hearings.filter((h) => !coversHearing(plan, h.id) && caseById.has(h.caseId)).sort((a, b) => b.date.localeCompare(a.date))
  const caseOptions = cases.filter((c) => !coversCase(plan, c.id))
  const taskOptions = tasks.filter((t) => t.id !== plan.taskId && t.planId !== plan.id && t.outcome.status === 'open').sort((a, b) => a.title.localeCompare(b.title))

  const pick = (ref: EntityRef) => {
    onOpenChange(false)
    onPick(ref)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Apply this plan to…" className="sm:max-w-xl">
      <Command>
        <CommandInput placeholder="Search hearings, cases, tasks…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nothing matches.</CommandEmpty>
          {hearingOptions.length > 0 && (
            <CommandGroup heading="Hearings">
              {hearingOptions.map((h) => (
                <CommandItem key={h.id} value={`hearing ${refsOf(h)} ${caseById.get(h.caseId)?.title} ${h.date} ${h.purpose}`} onSelect={() => pick({ kind: 'hearing', id: h.id })}>
                  <Gavel />
                  <span className="truncate">
                    {refsOf(h)} · {h.purpose}
                  </span>
                  <CommandShortcut>{format(parseISO(h.date), 'd MMM yyyy')}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {caseOptions.length > 0 && (
            <CommandGroup heading="Whole cases">
              {caseOptions.map((c) => (
                <CommandItem key={c.id} value={`case ${c.reference} ${c.title} ${c.client ?? ''}`} onSelect={() => pick({ kind: 'case', id: c.id })}>
                  <Scale />
                  <span className="truncate">{c.title}</span>
                  <CommandShortcut>{c.reference}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {taskOptions.length > 0 && (
            <CommandGroup heading="A single task (replaces the cases and hearings above)">
              {taskOptions.map((t) => (
                <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => pick({ kind: 'task', id: t.id })}>
                  <KIND_META.task.icon />
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

/**
 * From a case or a hearing: reuse a plan that already exists instead of writing another. The plan
 * stays one plan; it simply now covers this too.
 */
export function UseExistingPlan({ target, label = 'Use an existing plan', className }: { target: EntityRef; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const { data: plans } = useEntities('plan')
  const { data: hearings } = useEntities('hearing')
  const cover = useAction<string, unknown>((s, userId, planId) => s.plans.cover(userId, planId, target), { success: 'Plan applied' })

  const caseId = target.kind === 'case' ? target.id : hearings.find((h) => h.id === target.id)?.caseId
  const options = plans
    .filter((p) => !p.taskId && p.status !== 'abandoned' && !(target.kind === 'hearing' ? coversHearing(p, target.id) : coversCase(p, target.id)))
    // Plans already on this case are the likeliest to be reused for another of its hearings.
    .sort((a, b) => Number(caseId ? coversCase(b, caseId) : 0) - Number(caseId ? coversCase(a, caseId) : 0) || a.title.localeCompare(b.title))

  return (
    <>
      <Button variant="ghost" size="xs" className={className} onClick={() => (options.length ? setOpen(true) : toast.info('There are no other plans to reuse yet'))}>
        <Link2 /> {label}
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Use an existing plan" className="sm:max-w-xl">
        <Command>
          <CommandInput placeholder="Search plans…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup heading="They keep one page and one set of steps">
              {options.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.title} ${p.objective}`}
                  onSelect={() => {
                    setOpen(false)
                    void cover.run(p.id)
                  }}
                >
                  <KIND_META.plan.icon />
                  <span className="truncate">{p.title}</span>
                  {caseId && coversCase(p, caseId) && <CommandShortcut>on this case</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

/** Compact "what it covers" chips for lists: the first few, then a count. */
export function PlanCoverageChips({ plan }: { plan: ActionPlan }) {
  const hearingIds = planHearingIds(plan)
  const caseIds = planCaseIds(plan).filter((id) => !(plan.origin?.kind === 'case' && plan.origin.id === id))
  const ids = hearingIds.length ? hearingIds.map((id): EntityRef => ({ kind: 'hearing', id })) : caseIds.map((id): EntityRef => ({ kind: 'case', id }))
  const more = ids.length - 2
  return (
    <>
      {plan.taskId && <RefChip refTo={{ kind: 'task', id: plan.taskId }} />}
      {ids.slice(0, 2).map((ref) => (
        <RefChip key={`${ref.kind}:${ref.id}`} refTo={ref} />
      ))}
      {more > 0 && (
        <span className="self-center text-[11px] text-muted-foreground">
          +{more} more {hearingIds.length ? 'hearings' : 'cases'}
        </span>
      )}
    </>
  )
}
