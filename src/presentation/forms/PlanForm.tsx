import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { PLAN_STATUS_LABELS } from '@/domain/plans/ActionPlan'
import type { ActionPlan, PlanStatus } from '@/domain/plans/ActionPlan'
import type { ID } from '@/domain/shared/types'
import { DateInput, Field, NativeSelect } from '@/presentation/components/form'
import { WorkspaceDot, WorkspacePicker } from '@/presentation/components/workspace'
import { useAction, useEntities, useSave } from '@/presentation/data/hooks'
import { FormShell, lines, usePatch } from './shared'

export type PlanDraft = Omit<ActionPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newPlan = (over: Partial<PlanDraft> = {}): PlanDraft => ({ title: '', objective: '', workspace: 'personal', status: 'active', ...over })

export interface PlanFormExtras {
  steps?: string[]
  goalIds?: ID[]
}

export function PlanForm({ initial, extras, onDone }: { initial: ActionPlan | PlanDraft; extras?: PlanFormExtras; onDone: (saved?: ActionPlan) => void }) {
  const [p, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const [stepsText, setStepsText] = useState((extras?.steps ?? []).join('\n'))
  const [goalIds, setGoalIds] = useState<ID[]>(extras?.goalIds ?? [])
  const { data: goals } = useEntities('goal')
  const { data: cases } = useEntities('case')
  const update = useSave('plan', 'Plan updated')
  const create = useAction<{ draft: PlanDraft; steps: string[]; goalIds: ID[] }, ActionPlan>((s, userId, a) => s.plans.createWithSteps(userId, a.draft, a.steps, a.goalIds), {
    success: 'Action plan created',
  })

  const submit = async () => onDone(editing ? await update.run(p) : await create.run({ draft: p, steps: lines(stepsText), goalIds }))

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Create plan'} onCancel={() => onDone()} onSubmit={submit}>
      <Field label="Plan" htmlFor="plan-title">
        <Input id="plan-title" autoFocus value={p.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Prepare for final arguments" />
      </Field>
      <Field label="Objective" htmlFor="plan-obj">
        <Textarea id="plan-obj" value={p.objective} onChange={(e) => patch({ objective: e.target.value })} className="min-h-14" placeholder="What does success look like?" />
      </Field>
      <Field label="Workspace">
        <WorkspacePicker id="plan-ws" value={p.workspace} onChange={(workspace) => patch({ workspace })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due" htmlFor="plan-due">
          <DateInput id="plan-due" value={p.dueDate} onChange={(dueDate) => patch({ dueDate })} />
        </Field>
        {editing ? (
          <Field label="Status" htmlFor="plan-status">
            <NativeSelect id="plan-status" value={p.status} onChange={(e) => patch({ status: e.target.value as PlanStatus })}>
              {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PLAN_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field label="Case (optional)" htmlFor="plan-case">
            <NativeSelect id="plan-case" value={p.caseId ?? ''} onChange={(e) => patch({ caseId: e.target.value || undefined, ...(e.target.value && { workspace: 'sb' as const }) })}>
              <option value="">None</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} — {c.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      {!editing && (
        <>
          <Field label="Steps" htmlFor="plan-steps" hint="One per line — each becomes a task with its own outcome">
            <Textarea id="plan-steps" value={stepsText} onChange={(e) => setStepsText(e.target.value)} className="min-h-24" />
          </Field>
          {goals.length > 0 && (
            <Field label="Contributes to goals">
              <div className="flex flex-wrap gap-1.5">
                {goals.map((g) => {
                  const on = goalIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setGoalIds(on ? goalIds.filter((x) => x !== g.id) : [...goalIds, g.id])}
                      className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors', on ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {g.workspace && <WorkspaceDot ws={g.workspace} />}
                      {g.title}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}
        </>
      )}
    </FormShell>
  )
}
