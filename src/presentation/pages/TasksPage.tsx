import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { AnimatePresence } from 'motion/react'
import { CornerDownLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OPEN } from '@/domain/shared/outcome'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { PRIORITY_RANK } from '@/domain/tasks/Task'
import type { Task } from '@/domain/tasks/Task'
import { useEditor } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { Segmented } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useEntities, useSave, useToday } from '@/presentation/data/hooks'
import { TaskRow } from '@/presentation/tasks/TaskRow'

type StatusFilter = 'open' | 'closed' | 'all'
type Grouping = 'due' | 'workspace'

export function TasksPage() {
  const today = useToday()
  const { open } = useEditor()
  const { matches, scope } = useWorkspaceFilter()
  const { data: tasks } = useEntities('task')
  const [status, setStatus] = useState<StatusFilter>('open')
  const [grouping, setGrouping] = useState<Grouping>('due')

  const visible = useMemo(
    () =>
      tasks
        .filter((t) => matches(t.workspace))
        .filter((t) => (status === 'all' ? true : status === 'open' ? t.outcome.status === 'open' : t.outcome.status !== 'open'))
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    [tasks, matches, status],
  )

  const groups = useMemo(() => (grouping === 'due' ? groupByDue(visible, today) : groupByWorkspace(visible)), [visible, grouping, today])

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Tasks"
        description="Personal, S&B (legal), FSA (tech) and media work. Record how each one turned out — not just whether it’s ticked."
        actions={
          <Button onClick={() => open({ kind: 'task' })}>
            <Plus /> New task
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<StatusFilter> label="Status" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Outcome recorded' }, { value: 'all', label: 'All' }]} />
        <Segmented<Grouping> label="Group by" value={grouping} onChange={setGrouping} options={[{ value: 'due', label: 'By date' }, { value: 'workspace', label: 'By workspace' }]} />
        <QuickAdd workspace={scope === 'all' ? 'personal' : scope} />
      </div>

      {visible.length === 0 ? (
        <Section>
          <EmptyState title={status === 'open' ? 'Nothing open.' : 'Nothing here yet.'}>Add a task above, or switch the filter.</EmptyState>
        </Section>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => (
            <Section
              key={g.key}
              title={
                <span className="flex items-center gap-2">
                  {g.ws && <WorkspaceDot ws={g.ws} />}
                  {g.label}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">{g.items.length}</span>
                </span>
              }
              className={g.key === 'overdue' ? 'border-destructive/30' : undefined}
              bodyClassName="p-1.5"
            >
              <ul className="grid">
                <AnimatePresence initial={false}>
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </AnimatePresence>
              </ul>
            </Section>
          ))}
        </div>
      )}
    </>
  )
}

interface Group {
  key: string
  label: string
  items: Task[]
  ws?: WorkspaceId
}

function groupByDue(tasks: Task[], today: string): Group[] {
  const buckets: Record<string, Group> = {
    overdue: { key: 'overdue', label: 'Overdue', items: [] },
    today: { key: 'today', label: 'Today', items: [] },
    week: { key: 'week', label: 'Next 7 days', items: [] },
    later: { key: 'later', label: 'Later', items: [] },
    none: { key: 'none', label: 'No date', items: [] },
  }
  for (const t of tasks) {
    const date = t.slot?.date ?? t.dueDate
    if (!date) buckets.none.items.push(t)
    else {
      const diff = differenceInCalendarDays(parseISO(date), parseISO(today))
      if (diff < 0 && t.outcome.status === 'open') buckets.overdue.items.push(t)
      else if (diff <= 0) buckets.today.items.push(t)
      else if (diff <= 7) buckets.week.items.push(t)
      else buckets.later.items.push(t)
    }
  }
  return Object.values(buckets).filter((g) => g.items.length)
}

function groupByWorkspace(tasks: Task[]): Group[] {
  return WORKSPACE_IDS.map((ws) => ({ key: ws, label: WORKSPACES[ws].name, ws, items: tasks.filter((t) => t.workspace === ws) })).filter((g) => g.items.length)
}

function QuickAdd({ workspace }: { workspace: WorkspaceId }) {
  const today = useToday()
  const [title, setTitle] = useState('')
  const save = useSave('task', 'Task added for today')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await save.run({ title, notes: '', workspace, priority: 'normal', estimate: 30, dueDate: today, outcome: OPEN })
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="ml-auto flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:ring-3 focus-within:ring-ring/40">
      <WorkspaceDot ws={workspace} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Quick add to ${WORKSPACES[workspace].short} for today…`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label="Quick add task" />
      <CornerDownLeft className="size-3.5 text-muted-foreground" />
    </form>
  )
}
