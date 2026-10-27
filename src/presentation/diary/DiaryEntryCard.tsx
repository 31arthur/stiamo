import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { CalendarClock, CheckCircle2, Circle, ListChecks, ListPlus, Pencil } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DIARY_KIND_LABELS } from '@/domain/diary/Diary'
import type { DiaryEntry } from '@/domain/diary/Diary'
import type { Hearing, LegalCase } from '@/domain/cases/LegalCase'
import type { ID } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/Task'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate } from '@/presentation/components/dates'
import { useAction } from '@/presentation/data/hooks'
import { spring } from '@/presentation/motion/presets'

/**
 * One entry of the case diary. The order and the work due come first, since that's what gets
 * looked up; the rest of the write-up opens on demand. Each action follows its task, so the diary
 * shows what has since been done.
 */
export function DiaryEntryCard({ entry: e, legalCase, hearing, tasks, today, showCase = false }: { entry: DiaryEntry; legalCase?: LegalCase; hearing?: Hearing; tasks: Task[]; today: string; showCase?: boolean }) {
  const { open } = useEditor()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const court = e.kind === 'court'
  const toTasks = useAction<ID, unknown>((s, userId, id) => s.diary.toTasks(userId, id), { success: 'Tasks created' })
  const toPlan = useAction<ID, { id: ID }>((s, userId, id) => s.diary.toPlan(userId, id), { success: 'Action plan created' })

  const taskOf = (taskId?: ID) => (taskId ? tasks.find((t) => t.id === taskId) : undefined)
  const unlinked = e.actions.filter((a) => !taskOf(a.taskId))
  const hasMore = !!(e.submissions || e.evidence || e.reflections || e.bench)
  const title = court ? (hearing?.purpose ?? 'Hearing') : (e.title ?? 'Chamber work')

  return (
    <motion.li layout transition={spring.soft} className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tabular-nums">{format(parseISO(e.date), 'EEE d MMM yyyy')}</span>
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', court ? 'bg-ws-sb-soft text-ws-sb' : 'bg-muted text-muted-foreground')}>{DIARY_KIND_LABELS[e.kind]}</span>
            {showCase && legalCase && (
              <Link to={`/cases/${legalCase.id}`} className="font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                {legalCase.reference}
              </Link>
            )}
          </div>
          <div className="text-sm">{title}</div>
          {showCase && legalCase && <div className="truncate text-xs text-muted-foreground">{legalCase.title}</div>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Edit diary entry" onClick={() => open({ kind: 'diary', value: e })}>
          <Pencil />
        </Button>
      </div>

      {e.order && (
        <div className="mt-2 rounded-lg border-l-2 border-ws-sb/50 bg-muted/50 px-3 py-2">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Order</div>
          <p className="text-sm whitespace-pre-line">{e.order}</p>
        </div>
      )}
      {e.proceedings && <p className={cn('mt-2 text-sm whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-3')}>{e.proceedings}</p>}

      {e.authorities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {e.authorities.map((a) => (
            <span key={a} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] italic">
              {a}
            </span>
          ))}
        </div>
      )}

      {expanded && hasMore && (
        <dl className="mt-2 grid gap-2 text-sm">
          {[
            ['Bench', e.bench],
            ['Submissions', e.submissions],
            ['Evidence', e.evidence],
            ['Reflections', e.reflections],
          ]
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
        </dl>
      )}
      {(hasMore || e.proceedings.length > 180) && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {expanded ? 'Show less' : 'Show the whole entry'}
        </button>
      )}

      {e.nextDate && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
          <CalendarClock className="size-3.5" /> Next: {friendlyDate(e.nextDate, today)}
          {e.nextPurpose && <span className="text-muted-foreground">· {e.nextPurpose}</span>}
        </div>
      )}

      {e.actions.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Work due before the next date</span>
            {unlinked.length > 0 && (
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" onClick={() => toTasks.run(e.id)} disabled={toTasks.pending}>
                  <ListPlus /> Make tasks
                </Button>
                <Button variant="ghost" size="xs" onClick={async () => navigate(`/plans/${(await toPlan.run(e.id)).id}`)} disabled={toPlan.pending}>
                  <ListChecks /> Start a plan
                </Button>
              </div>
            )}
          </div>
          <ul className="grid gap-1">
            {e.actions.map((a) => {
              const t = taskOf(a.taskId)
              const done = t?.outcome.status === 'done'
              const closed = !!t && t.outcome.status !== 'open'
              const due = t?.dueDate ?? a.due
              return (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className={cn('mt-0.5 size-4 shrink-0', t ? 'text-muted-foreground' : 'text-muted-foreground/40')} />}
                  <span className={cn('min-w-0 flex-1', closed && 'text-muted-foreground line-through decoration-foreground/30')}>{a.text}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {due && !closed ? friendlyDate(due, today) : !t && 'no task yet'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </motion.li>
  )
}
