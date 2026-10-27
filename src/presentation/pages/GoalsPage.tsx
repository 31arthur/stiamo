import { useMemo } from 'react'
import { motion } from 'motion/react'
import { ListChecks, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { goalProgress, HEALTH_LABELS, HORIZON_LABELS, keyResultProgress } from '@/domain/goals/Goal'
import type { GoalHealth } from '@/domain/goals/Goal'
import { useEditor } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { ProgressBar, ProgressRing } from '@/presentation/components/progress'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { useEntities, useStepPool, useToday } from '@/presentation/data/hooks'
import { HEALTH_STYLE } from '@/presentation/goals/health'
import { stagger } from '@/presentation/motion/presets'

export function GoalsPage() {
  const today = useToday()
  const { open } = useEditor()
  const { matches } = useWorkspaceFilter()
  const { data: goals } = useEntities('goal')
  const pool = useStepPool()

  const rows = useMemo(
    () =>
      goals
        .filter((g) => matches(g.workspace))
        .map((g) => ({ g, gp: goalProgress(g, pool, today) }))
        .sort((a, b) => Number(a.g.status !== 'active') - Number(b.g.status !== 'active') || a.g.targetDate.localeCompare(b.g.targetDate)),
    [goals, pool, matches, today],
  )
  const count = (h: GoalHealth) => rows.filter((r) => r.gp.health === h).length

  return (
    <>
      <PageHeader
        title="Goals"
        description="The long view. Each goal rolls up its key results and the action plans linked to it — and compares progress with time elapsed."
        actions={
          <Button onClick={() => open({ kind: 'goal' })}>
            <Plus /> Set a goal
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="On track" value={count('on_track')} tone="success" />
        <Stat label="At risk" value={count('at_risk')} tone={count('at_risk') ? 'warning' : 'default'} />
        <Stat label="Off track" value={count('off_track')} tone={count('off_track') ? 'danger' : 'default'} />
        <Stat label="Achieved" value={count('achieved')} />
      </div>
      {rows.length === 0 ? (
        <Section>
          <EmptyState title="No goals yet." action={<Button onClick={() => open({ kind: 'goal' })}>Set a goal</Button>} />
        </Section>
      ) : (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ g, gp }) => (
            <motion.div key={g.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              <Link to={`/goals/${g.id}`} className="group flex h-full gap-5 rounded-2xl border bg-card/80 p-5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-float">
                <ProgressRing value={gp.progress} size={84} stroke={7} ringClassName={HEALTH_STYLE[gp.health].ring} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', HEALTH_STYLE[gp.health].chip)}>{HEALTH_LABELS[gp.health]}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{HORIZON_LABELS[g.horizon]}</span>
                    {g.workspace && <WorkspaceBadge ws={g.workspace} />}
                  </div>
                  <div className="mt-1.5 font-display text-2xl leading-tight">{g.title}</div>
                  <div className="mt-3 grid gap-1">
                    <ProgressBar value={gp.progress} marker={gp.elapsed} barClassName={HEALTH_STYLE[gp.health].bar} />
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>{Math.round(gp.progress * 100)}% done</span>
                      <span>
                        {Math.round(gp.elapsed * 100)}% of time · {gp.daysLeft >= 0 ? `${gp.daysLeft} days left` : `${-gp.daysLeft} days over`}
                      </span>
                    </div>
                  </div>
                  {g.keyResults.length > 0 && (
                    <div className="mt-3 grid gap-1.5">
                      {g.keyResults.slice(0, 3).map((kr) => (
                        <div key={kr.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
                          <span className="truncate text-muted-foreground">{kr.label}</span>
                          <span className="font-medium tabular-nums">
                            {kr.current}/{kr.target}
                            {kr.unit && ` ${kr.unit}`}
                          </span>
                          <ProgressBar value={keyResultProgress(kr)} className="col-span-2 h-1" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ListChecks className="size-3" /> {g.planIds.length} linked plan{g.planIds.length === 1 ? '' : 's'}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  )
}
