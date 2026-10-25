import { motion } from 'motion/react'
import { Clock, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock, formatDuration } from '@/domain/shared/time'
import type { ISODate } from '@/domain/shared/types'
import { isOverdue } from '@/domain/tasks/Task'
import type { Task } from '@/domain/tasks/Task'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { ClickableRow } from '@/presentation/components/layout'
import { OutcomeControl, OutcomeNote } from '@/presentation/components/outcome'
import { RefChip } from '@/presentation/components/RefChip'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { spring } from '@/presentation/motion/presets'
import { AttachmentBadge } from '@/presentation/attachments/AttachmentsPanel'
import { useAttachmentCounts } from '@/presentation/attachments/useAttachments'

const PRIORITY_TONE = { urgent: 'text-destructive', high: 'text-warning', normal: 'hidden', low: 'hidden' } as const

export function TaskRow({ task, today, showPlan = true }: { task: Task; today: ISODate; showPlan?: boolean }) {
  const { open } = useEditor()
  const overdue = isOverdue(task, today)
  const closed = task.outcome.status !== 'open'
  const files = useAttachmentCounts()

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      transition={spring.soft}
      className="group flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50"
    >
      <OutcomeControl target="task" id={task.id} outcome={task.outcome} />
      <ClickableRow onActivate={() => open({ kind: 'task', value: task })} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Flag className={cn('size-3.5 shrink-0 fill-current', PRIORITY_TONE[task.priority])} aria-label={`${task.priority} priority`} />
          <span className={cn('truncate text-sm font-medium', closed && 'text-muted-foreground line-through decoration-foreground/30')}>{task.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <WorkspaceBadge ws={task.workspace} />
          {task.dueDate && <span className={cn('tabular-nums', overdue && 'font-medium text-destructive')}>{overdue ? `Overdue · ${friendlyDate(task.dueDate, today)}` : `Due ${friendlyDate(task.dueDate, today)}`}</span>}
          {task.slot && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3" />
              {friendlyDate(task.slot.date, today)} {formatClock(task.slot.start)}
            </span>
          )}
          <span className="tabular-nums">{formatDuration(task.estimate)}</span>
          <AttachmentBadge count={files.get(`task:${task.id}`)} />
          {showPlan && task.planId && <RefChip refTo={{ kind: 'plan', id: task.planId }} />}
          {task.related && task.related.kind !== 'plan' && <RefChip refTo={task.related} />}
        </div>
        {closed && (
          <div className="mt-1.5">
            <OutcomeNote outcome={task.outcome} target="task" />
          </div>
        )}
      </ClickableRow>
    </motion.li>
  )
}
