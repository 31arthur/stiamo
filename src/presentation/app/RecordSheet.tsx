import type { ReactNode } from 'react'
import { Clock, Flag, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { CHANNEL_LABELS } from '@/domain/followups/FollowUp'
import type { FollowUp } from '@/domain/followups/FollowUp'
import { CONFIRMATION_LABELS } from '@/domain/meetings/Meeting'
import { formatClock, formatDuration } from '@/domain/shared/time'
import type { EntityRef } from '@/domain/shared/types'
import { PRIORITY_LABELS } from '@/domain/tasks/Task'
import type { Task } from '@/domain/tasks/Task'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { friendlyDate, friendlyDateTime } from '@/presentation/components/dates'
import { Meta } from '@/presentation/components/layout'
import { OutcomeControl, OutcomeNote } from '@/presentation/components/outcome'
import { RefChip } from '@/presentation/components/RefChip'
import { Tabs } from '@/presentation/components/tabs'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { useEntity, useRemove, useToday } from '@/presentation/data/hooks'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'
import type { EditorRequest } from './create'

/** Side panel for a task or follow-up: its details, outcome, and the whole thread around it. */
export function RecordSheet({ refTo, onClose, onEdit }: { refTo: EntityRef | null; onClose: () => void; onEdit: (r: EditorRequest) => void }) {
  const task = useEntity('task', refTo?.kind === 'task' ? refTo.id : undefined)
  const followUp = useEntity('followUp', refTo?.kind === 'followUp' ? refTo.id : undefined)
  const record = task ?? followUp
  return (
    <Sheet open={!!refTo && !!record} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
        {task && <TaskBody task={task} onEdit={() => onEdit({ kind: 'task', value: task })} onDeleted={onClose} />}
        {followUp && <FollowUpBody followUp={followUp} onEdit={() => onEdit({ kind: 'followUp', value: followUp })} onDeleted={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function Header({ children, onEdit, onDelete, title }: { children: ReactNode; onEdit: () => void; onDelete: () => Promise<unknown>; title: string }) {
  return (
    <div className="sticky top-0 z-10 border-b bg-popover/90 px-5 pt-5 pb-4 backdrop-blur">
      {children}
      <div className="mt-3 flex gap-1.5">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
        <ConfirmDelete what={title} onConfirm={onDelete} />
      </div>
    </div>
  )
}

function TaskBody({ task: t, onEdit, onDeleted }: { task: Task; onEdit: () => void; onDeleted: () => void }) {
  const today = useToday()
  const remove = useRemove('task', 'Task deleted')
  return (
    <>
      <Header
        title={t.title}
        onEdit={onEdit}
        onDelete={async () => {
          await remove.run(t.id)
          onDeleted()
        }}
      >
        <div className="flex items-start gap-2 pr-8">
          <OutcomeControl target="task" id={t.id} outcome={t.outcome} />
          <div className="min-w-0">
            <SheetTitle className={cn('font-display text-2xl leading-tight font-normal', t.outcome.status !== 'open' && 'text-muted-foreground')}>{t.title}</SheetTitle>
            <SheetDescription className="mt-1 flex flex-wrap items-center gap-1.5">
              <WorkspaceBadge ws={t.workspace} />
              {t.planId && <RefChip refTo={{ kind: 'plan', id: t.planId }} />}
              {t.related && <RefChip refTo={t.related} />}
            </SheetDescription>
          </div>
        </div>
      </Header>
      <div className="p-5">
        <Tabs
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              content: (
                <div className="grid gap-5">
                  <div className="grid grid-cols-2 gap-4 rounded-xl border p-3 sm:grid-cols-4">
                    <Meta label="Priority">
                      <span className="inline-flex items-center gap-1">
                        <Flag className="size-3" /> {PRIORITY_LABELS[t.priority]}
                      </span>
                    </Meta>
                    <Meta label="Due">{t.dueDate ? friendlyDate(t.dueDate, today) : '—'}</Meta>
                    <Meta label="Planned">{t.slot ? `${friendlyDate(t.slot.date, today)} ${formatClock(t.slot.start)}` : '—'}</Meta>
                    <Meta label="Estimate">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatDuration(t.estimate)}
                      </span>
                    </Meta>
                  </div>
                  {t.notes && <p className="text-sm whitespace-pre-line">{t.notes}</p>}
                  <OutcomeNote outcome={t.outcome} target="task" />
                </div>
              ),
            },
            { id: 'thread', label: 'Thread & history', content: <ThreadPanel root={{ kind: 'task', id: t.id }} /> },
          ]}
        />
      </div>
    </>
  )
}

function FollowUpBody({ followUp: f, onEdit, onDeleted }: { followUp: FollowUp; onEdit: () => void; onDeleted: () => void }) {
  const today = useToday()
  const remove = useRemove('followUp', 'Follow-up deleted')
  return (
    <>
      <Header
        title={f.title}
        onEdit={onEdit}
        onDelete={async () => {
          await remove.run(f.id)
          onDeleted()
        }}
      >
        <div className="flex items-start gap-2 pr-8">
          <OutcomeControl target="followUp" id={f.id} outcome={f.outcome} />
          <div className="min-w-0">
            <SheetTitle className="font-display text-2xl leading-tight font-normal">{f.title}</SheetTitle>
            <SheetDescription className="mt-1 flex flex-wrap items-center gap-1.5">
              <WorkspaceBadge ws={f.workspace} />
              {f.subject && <RefChip refTo={f.subject} />}
            </SheetDescription>
          </div>
        </div>
      </Header>
      <div className="p-5">
        <Tabs
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              content: (
                <div className="grid gap-5">
                  <div className="grid grid-cols-2 gap-4 rounded-xl border p-3 sm:grid-cols-3">
                    <Meta label="Channel">{CHANNEL_LABELS[f.channel]}</Meta>
                    <Meta label="When">{f.due ? friendlyDateTime(f.due.date, f.due.time, today) : 'Anytime'}</Meta>
                    <Meta label="Contact">{f.contact ?? '—'}</Meta>
                    {f.trigger && <Meta label="Confirmation">{CONFIRMATION_LABELS[f.trigger]}</Meta>}
                  </div>
                  {f.notes && <p className="text-sm whitespace-pre-line">{f.notes}</p>}
                  <OutcomeNote outcome={f.outcome} target="followUp" />
                </div>
              ),
            },
            { id: 'thread', label: 'Thread & history', content: <ThreadPanel root={{ kind: 'followUp', id: f.id }} /> },
          ]}
        />
      </div>
    </>
  )
}
