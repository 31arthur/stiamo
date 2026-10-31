import { useState } from 'react'
import { CalendarClock, CheckCircle2, Circle, ListChecks, ListPlus } from 'lucide-react'
import { useNavigate } from '@/presentation/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Hearing } from '@/domain/cases/LegalCase'
import type { ID } from '@/domain/shared/types'
import { stepById } from '@/domain/plans/ActionPlan'
import { friendlyDate } from '@/presentation/components/dates'
import { useAction, useStepPool } from '@/presentation/data/hooks'

/**
 * What was written up about a hearing — its case diary entry. The order and the work due come
 * first, since that's what gets looked up; the rest of the write-up opens on demand. Each action
 * follows its step (task, follow-up or appointment), so the record shows what has since been done.
 */
export function HearingRecordDetails({ hearing: h, next, today }: { hearing: Hearing; next?: Hearing; today: string }) {
  const navigate = useNavigate()
  const pool = useStepPool()
  const [expanded, setExpanded] = useState(false)
  const toTasks = useAction<ID, unknown>((s, userId, id) => s.hearingActions.toTasks(userId, id), { success: 'Tasks created' })
  const toPlan = useAction<ID, { id: ID }>((s, userId, id) => s.hearingActions.toPlan(userId, id), { success: 'Action plan created' })

  const actions = h.actions ?? []
  const taskOf = (taskId?: ID) => (taskId ? stepById(taskId, pool) : undefined)
  const unlinked = actions.filter((a) => !taskOf(a.taskId))
  const more = [
    ['Bench', h.bench],
    ['Submissions', h.submissions],
    ['Evidence', h.evidence],
    ['Reflections', h.reflections],
  ].filter(([, v]) => v)

  return (
    <>
      {h.order && (
        <div className="mt-2 rounded-lg border-l-2 border-ws-sb/50 bg-muted/50 px-3 py-2">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Order</div>
          <p className="text-sm whitespace-pre-line">{h.order}</p>
        </div>
      )}
      {h.summary && <p className={cn('mt-2 text-sm whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-4')}>{h.summary}</p>}
      {h.outcome.comment && <p className="mt-1 text-xs text-muted-foreground italic">{h.outcome.comment}</p>}

      {(h.authorities?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {h.authorities!.map((a) => (
            <span key={a} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] italic">
              {a}
            </span>
          ))}
        </div>
      )}

      {expanded && more.length > 0 && (
        <dl className="mt-2 grid gap-2 text-sm">
          {more.map(([label, v]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
              <dd className="whitespace-pre-line">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {(more.length > 0 || (h.summary?.length ?? 0) > 220) && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {expanded ? 'Show less' : 'Show the whole entry'}
        </button>
      )}

      {next && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
          <CalendarClock className="size-3.5" /> Next: {friendlyDate(next.date, today)}
          <span className="text-muted-foreground">· {next.purpose}</span>
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Work due before the next date</span>
            {unlinked.length > 0 && (
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" onClick={() => toTasks.run(h.id)} loading={toTasks.pending} disabled={toPlan.pending}>
                  <ListPlus /> Make tasks
                </Button>
                <Button variant="ghost" size="xs" onClick={async () => navigate(`/plans/${(await toPlan.run(h.id)).id}`)} loading={toPlan.pending} disabled={toTasks.pending}>
                  <ListChecks /> Start a plan
                </Button>
              </div>
            )}
          </div>
          <ul className="grid gap-1">
            {actions.map((a) => {
              const t = taskOf(a.taskId)
              const done = t?.outcome.status === 'done'
              const closed = !!t && t.outcome.status !== 'open'
              const due = t?.date ?? a.due
              return (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className={cn('mt-0.5 size-4 shrink-0', t ? 'text-muted-foreground' : 'text-muted-foreground/40')} />}
                  <span className={cn('min-w-0 flex-1', closed && 'text-muted-foreground line-through decoration-foreground/30')}>{a.text}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{due && !closed ? friendlyDate(due, today) : !t && 'no task yet'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
