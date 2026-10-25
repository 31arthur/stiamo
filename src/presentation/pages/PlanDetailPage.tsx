import { useMemo } from 'react'
import { ArrowLeft, CornerDownRight, Pencil, Target } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PLAN_STATUS_LABELS, planProgress, stepsOf } from '@/domain/plans/ActionPlan'
import type { ActionPlan, PlanStatus } from '@/domain/plans/ActionPlan'
import type { OutcomeStatus } from '@/domain/shared/outcome'
import type { ID } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { friendlyDate } from '@/presentation/components/dates'
import { Segmented } from '@/presentation/components/form'
import { Meta, Section } from '@/presentation/components/layout'
import { OUTCOME_STYLE, outcomeLabel } from '@/presentation/components/outcome'
import { ProgressRing } from '@/presentation/components/progress'
import { RefChip } from '@/presentation/components/RefChip'
import { WorkspaceBadge, WorkspaceDot } from '@/presentation/components/workspace'
import { useAction, useEntities, useEntity, useSave, useToday } from '@/presentation/data/hooks'
import { PlanSteps } from '@/presentation/plans/PlanSteps'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'


export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const plan = useEntity('plan', id)
  const { isLoading } = useEntities('plan')
  if (!plan) return isLoading ? null : <Navigate to="/plans" replace />
  return <PlanDetail key={plan.id} plan={plan} />
}

function PlanDetail({ plan: p }: { plan: ActionPlan }) {
  const today = useToday()
  const navigate = useNavigate()
  const editor = useEditor()
  const { data: tasks } = useEntities('task')
  const { data: goals } = useEntities('goal')
  const save = useSave('plan')
  const remove = useAction<ID, void>((s, userId, id) => s.plans.remove(userId, id), { success: 'Plan deleted — its steps were kept as tasks' })
  const toggleGoal = useAction<{ goalId: ID; linked: boolean }, void>(
    (s, userId, a) => (a.linked ? s.plans.unlink(userId, p.id, a.goalId) : s.plans.link(userId, p.id, a.goalId)),
    { success: 'Goal links updated' },
  )

  const prog = planProgress(p.id, tasks)
  const steps = stepsOf(p.id, tasks)
  const breakdown = useMemo(() => {
    const counts: Partial<Record<OutcomeStatus, number>> = {}
    for (const s of steps) counts[s.outcome.status] = (counts[s.outcome.status] ?? 0) + 1
    return counts
  }, [steps])
  const furtherActions = steps.filter((s) => s.outcome.nextAction)

  return (
    <>
      <div className="flex items-center justify-between">
        <Link to="/plans" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Action plans
        </Link>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'plan', value: p })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={p.title}
            onConfirm={async () => {
              await remove.run(p.id)
              navigate('/plans')
            }}
          />
        </div>
      </div>

      <header className="flex flex-wrap items-start gap-6">
        <ProgressRing value={prog.progress ?? 0} size={88} stroke={7} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceBadge ws={p.workspace} />
            {p.origin && <RefChip refTo={p.origin} />}
            {p.caseId && p.origin?.kind !== 'case' && <RefChip refTo={{ kind: 'case', id: p.caseId }} />}
          </div>
          <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{p.title}</h1>
          {p.objective && <p className="mt-1 max-w-3xl text-muted-foreground">{p.objective}</p>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <Segmented<PlanStatus>
          label="Status"
          value={p.status}
          onChange={(status) => save.run({ ...p, status })}
          options={(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => ({ value: s, label: PLAN_STATUS_LABELS[s] }))}
        />
        <Meta label="Due">{p.dueDate ? friendlyDate(p.dueDate, today) : '—'}</Meta>
        <Meta label="Steps">
          {prog.done}/{prog.total} done
        </Meta>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Section title="Steps" description="Drag to reorder · click the circle to record each outcome" bodyClassName="p-2">
          <PlanSteps planId={p.id} />
        </Section>
        <div className="grid content-start gap-4">
          <Section title="Outcomes">
            <div className="grid grid-cols-2 gap-2">
              {(['done', 'partial', 'not_done', 'cancelled', 'open'] as OutcomeStatus[]).map((s) => {
                const st = OUTCOME_STYLE[s]
                return (
                  <div key={s} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
                    <st.icon className={cn('size-4', st.className)} />
                    <span className="flex-1 text-xs">{outcomeLabel(s, 'task')}</span>
                    <span className="text-sm font-semibold tabular-nums">{breakdown[s] ?? 0}</span>
                  </div>
                )
              })}
            </div>
            {furtherActions.length > 0 && (
              <div className="mt-4 grid gap-1.5">
                <div className="text-xs font-medium text-muted-foreground">Further actions noted</div>
                {furtherActions.map((s) => (
                  <div key={s.id} className="flex items-start gap-1.5 text-xs">
                    <CornerDownRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <span>
                      {s.outcome.nextAction} <span className="text-muted-foreground">— from “{s.title}”</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title="Files">
            <AttachmentsPanel owner={{ kind: 'plan', id: p.id }} compact />
          </Section>
          <Section title="Thread & history">
            <ThreadPanel root={{ kind: 'plan', id: p.id }} />
          </Section>
          <Section title="Contributes to goals" description="A plan can move several goals forward" bodyClassName="grid gap-1 p-2">
            {goals.length === 0 && <p className="p-2 text-sm text-muted-foreground">No goals yet.</p>}
            {goals.map((g) => {
              const linked = g.planIds.includes(p.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={linked}
                  onClick={() => toggleGoal.run({ goalId: g.id, linked })}
                  className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors', linked ? 'bg-foreground text-background' : 'hover:bg-muted')}
                >
                  <Target className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{g.title}</span>
                  {g.workspace && <WorkspaceDot ws={g.workspace} />}
                </button>
              )
            })}
          </Section>
        </div>
      </div>
    </>
  )
}
