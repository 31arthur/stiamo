import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { EntityRef } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { useEntities } from '@/presentation/data/hooks'
import { KIND_META, MEETING_KIND_ICON } from './kinds'

/** Resolves a link to its display label and icon. */
export function useRefInfo(ref: EntityRef | undefined) {
  const { data: tasks } = useEntities('task')
  const { data: meetings } = useEntities('meeting')
  const { data: followUps } = useEntities('followUp')
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: plans } = useEntities('plan')
  const { data: goals } = useEntities('goal')

  return useMemo(() => {
    if (!ref) return null
    const find = <T extends { id: string }>(list: T[]) => list.find((x) => x.id === ref.id)
    switch (ref.kind) {
      case 'task':
        return label(KIND_META.task.icon, 'Task', find(tasks)?.title)
      case 'followUp':
        return label(KIND_META.followUp.icon, 'Follow-up', find(followUps)?.title)
      case 'meeting': {
        const m = find(meetings)
        return m ? label(MEETING_KIND_ICON[m.kind], m.kind === 'appointment' ? 'Appointment' : 'Meeting', m.counterpart || m.title) : null
      }
      case 'case': {
        const c = find(cases)
        return c ? label(KIND_META.case.icon, 'Case', c.title) : null
      }
      case 'hearing': {
        const h = find(hearings)
        const c = h && cases.find((x) => x.id === h.caseId)
        return h ? label(KIND_META.hearing.icon, 'Hearing', `${c?.reference ?? ''} · ${h.purpose}`) : null
      }
      case 'plan':
        return label(KIND_META.plan.icon, 'Plan', find(plans)?.title)
      case 'goal':
        return label(KIND_META.goal.icon, 'Goal', find(goals)?.title)
    }
  }, [ref, tasks, meetings, followUps, cases, hearings, plans, goals])
}

function label(icon: (typeof KIND_META)['task']['icon'], kindLabel: string, title: string | undefined) {
  return title ? { icon, kindLabel, title } : null
}

export function RefChip({ refTo, className }: { refTo: EntityRef | undefined; className?: string }) {
  const info = useRefInfo(refTo)
  const { openRef } = useEditor()
  if (!info || !refTo) return null
  const Icon = info.icon
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openRef(refTo)
      }}
      title={`${info.kindLabel}: ${info.title}`}
      className={cn('inline-flex max-w-56 items-center gap-1 rounded-md border bg-background/60 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground', className)}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{info.title}</span>
    </button>
  )
}
