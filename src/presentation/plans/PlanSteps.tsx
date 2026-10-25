import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, Reorder } from 'motion/react'
import { GripVertical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stepsOf } from '@/domain/plans/ActionPlan'
import type { ID, ISODate } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/Task'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { OutcomeControl, OutcomeNote } from '@/presentation/components/outcome'
import { useAction, useEntities, useToday } from '@/presentation/data/hooks'

/** A plan's steps: reorder by dragging, record each step's outcome, add steps inline. */
export function PlanSteps({ planId, compact = false }: { planId: ID; compact?: boolean }) {
  const today = useToday()
  const { data: tasks } = useEntities('task')
  const [order, setOrder] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const reorder = useAction<ID[], void>((s, userId, ids) => s.plans.reorderSteps(userId, planId, ids))
  const addStep = useAction<string, Task>((s, userId, t) => s.plans.addStep(userId, planId, t))

  useEffect(() => setOrder(stepsOf(planId, tasks)), [planId, tasks])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addStep.run(title.trim())
    setTitle('')
  }

  return (
    <div className="grid gap-1">
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="grid gap-0.5">
        <AnimatePresence initial={false}>
          {order.map((t, i) => (
            <Step key={t.id} task={t} index={i} today={today} compact={compact} onDrop={() => reorder.run(order.map((x) => x.id))} />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <form onSubmit={add} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground focus-within:bg-muted/50">
        <Plus className="size-4" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a step…" className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground" aria-label="Add a step" />
      </form>
    </div>
  )
}

function Step({ task, index, today, compact, onDrop }: { task: Task; index: number; today: ISODate; compact: boolean; onDrop: () => void }) {
  const { open } = useEditor()
  const closed = task.outcome.status !== 'open'
  return (
    <Reorder.Item
      value={task}
      onDragEnd={onDrop}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgb(0 0 0 / 0.3)', zIndex: 10 }}
      className="group relative flex items-start gap-2 rounded-lg bg-card px-1.5 py-1.5 hover:bg-muted/40"
    >
      <GripVertical className="mt-1.5 size-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground active:cursor-grabbing" />
      <span className="mt-1 w-4 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">{index + 1}</span>
      <OutcomeControl target="task" id={task.id} outcome={task.outcome} size="sm" />
      <button type="button" onClick={() => open({ kind: 'task', value: task })} className="min-w-0 flex-1 text-left">
        <div className={cn('text-sm', closed && 'text-muted-foreground line-through decoration-foreground/30')}>{task.title}</div>
        {!compact && task.dueDate && <div className="text-[11px] text-muted-foreground">Due {friendlyDate(task.dueDate, today)}</div>}
        {closed && (task.outcome.comment || task.outcome.nextAction) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1">
            <OutcomeNote outcome={task.outcome} target="task" />
          </motion.div>
        )}
      </button>
    </Reorder.Item>
  )
}
