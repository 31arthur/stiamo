import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PLAN_STATUS_LABELS, planProgress } from '@/domain/plans/ActionPlan'
import type { PlanStatus } from '@/domain/plans/ActionPlan'
import { useEditor } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { friendlyDate } from '@/presentation/components/dates'
import { Segmented } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section } from '@/presentation/components/layout'
import { ProgressBar } from '@/presentation/components/progress'
import { RefChip } from '@/presentation/components/RefChip'
import { WS_STYLE, WorkspaceBadge } from '@/presentation/components/workspace'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { PlanCoverageChips } from '@/presentation/plans/PlanScopeEditor'
import { stagger } from '@/presentation/motion/presets'

export function PlansPage() {
  const today = useToday()
  const { open } = useEditor()
  const { matches } = useWorkspaceFilter()
  const { data: plans } = useEntities('plan')
  const { data: tasks } = useEntities('task')
  const { data: goals } = useEntities('goal')
  const [status, setStatus] = useState<PlanStatus | 'all'>('active')

  const cards = useMemo(
    () =>
      plans
        .filter((p) => matches(p.workspace) && (status === 'all' || p.status === status))
        .map((p) => ({ p, prog: planProgress(p.id, tasks), goals: goals.filter((g) => g.planIds.includes(p.id)) }))
        .sort((a, b) => (a.p.dueDate ?? '9999').localeCompare(b.p.dueDate ?? '9999')),
    [plans, tasks, goals, matches, status],
  )

  return (
    <>
      <PageHeader
        title="Action plans"
        description="Steps towards an objective — from a hearing, a meeting, or a goal. Each step records its own outcome."
        actions={
          <Button onClick={() => open({ kind: 'plan' })}>
            <Plus /> New plan
          </Button>
        }
      />
      <Segmented<PlanStatus | 'all'>
        label="Status"
        value={status}
        onChange={setStatus}
        options={[...(['active', 'draft', 'completed', 'abandoned'] as PlanStatus[]).map((s) => ({ value: s, label: PLAN_STATUS_LABELS[s] })), { value: 'all' as const, label: 'All' }]}
      />
      {cards.length === 0 ? (
        <Section>
          <EmptyState title="No plans here." />
        </Section>
      ) : (
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ p, prog, goals: linked }) => {
            const overdue = p.dueDate && p.dueDate < today && p.status === 'active'
            return (
              <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                <Link to={`/plans/${p.id}`} className="group flex h-full flex-col gap-3 overflow-hidden rounded-2xl border bg-card/80 p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-float">
                  <div className="flex items-center justify-between gap-2">
                    <WorkspaceBadge ws={p.workspace} />
                    <span className={cn('text-[11px] tabular-nums', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {p.dueDate ? `${overdue ? 'Overdue · ' : 'Due '}${friendlyDate(p.dueDate, today)}` : 'No due date'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{p.title}</div>
                    {p.objective && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.objective}</p>}
                  </div>
                  <div className="mt-auto grid gap-1.5">
                    <ProgressBar value={prog.progress ?? 0} barClassName={WS_STYLE[p.workspace].bar} />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        {prog.done}/{prog.total} done{prog.closed > prog.done && ` · ${prog.closed - prog.done} other outcomes`}
                      </span>
                      <span>{PLAN_STATUS_LABELS[p.status]}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.origin && <RefChip refTo={p.origin} />}
                    <PlanCoverageChips plan={p} />
                    {linked.map((g) => (
                      <span key={g.id} className="inline-flex max-w-48 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                        <Target className="size-3 shrink-0" /> <span className="truncate">{g.title}</span>
                      </span>
                    ))}
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </>
  )
}
