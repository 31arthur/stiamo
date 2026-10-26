import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { PLAN_SCOPE_LABELS, planScope } from '@/domain/plans/ActionPlan'
import type { ActionPlan, PlanScope } from '@/domain/plans/ActionPlan'
import type { ID } from '@/domain/shared/types'
import { Segmented, NativeSelect } from '@/presentation/components/form'
import { useAction, useEntities } from '@/presentation/data/hooks'

const SCOPES: PlanScope[] = ['general', 'case', 'hearing', 'task']

/**
 * What the plan is for: nothing in particular, a whole case, one hearing of it, or a single task.
 * Choosing a narrower scope reveals what to pick; the plan moves as soon as a choice is made.
 */
export function PlanScopeEditor({ plan }: { plan: ActionPlan }) {
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: tasks } = useEntities('task')
  const current = planScope(plan)
  const [kind, setKind] = useState<PlanScope>(current)
  const apply = useAction<{ kind: PlanScope; caseId?: ID; hearingId?: ID; taskId?: ID }, unknown>((s, userId, scope) => s.plans.setScope(userId, plan.id, scope), { success: 'Scope updated' })

  const caseById = new Map(cases.map((c) => [c.id, c]))
  // When the plan already belongs to a case, offer that case's hearings first.
  const hearingOptions = hearings
    .filter((h) => !plan.caseId || h.caseId === plan.caseId)
    .sort((a, b) => b.date.localeCompare(a.date))
  const taskOptions = tasks.filter((t) => t.planId !== plan.id && (t.outcome.status === 'open' || t.id === plan.taskId)).sort((a, b) => a.title.localeCompare(b.title))

  function choose(next: PlanScope) {
    setKind(next)
    if (next === 'general') apply.run({ kind: 'general' })
    else if (next === 'case' && plan.caseId) apply.run({ kind: 'case', caseId: plan.caseId })
  }

  return (
    <div className="grid gap-2">
      <Segmented<PlanScope> size="sm" label="What this plan covers" value={kind} onChange={choose} options={SCOPES.map((s) => ({ value: s, label: PLAN_SCOPE_LABELS[s] }))} />

      {kind === 'case' && (
        <NativeSelect aria-label="Case" value={plan.caseId ?? ''} onChange={(e) => e.target.value && apply.run({ kind: 'case', caseId: e.target.value })} className="h-8 max-w-md">
          <option value="">Choose a case…</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.reference} — {c.title}
            </option>
          ))}
        </NativeSelect>
      )}

      {kind === 'hearing' && (
        <NativeSelect aria-label="Hearing" value={plan.hearingId ?? ''} onChange={(e) => e.target.value && apply.run({ kind: 'hearing', hearingId: e.target.value })} className="h-8 max-w-md">
          <option value="">Choose a hearing…</option>
          {hearingOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {caseById.get(h.caseId)?.reference ?? 'Case'} · {format(parseISO(h.date), 'd MMM yyyy')} · {h.purpose}
            </option>
          ))}
        </NativeSelect>
      )}

      {kind === 'task' && (
        <NativeSelect aria-label="Task" value={plan.taskId ?? ''} onChange={(e) => e.target.value && apply.run({ kind: 'task', taskId: e.target.value })} className="h-8 max-w-md">
          <option value="">Choose a task…</option>
          {taskOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )
}
