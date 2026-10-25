import { progressOf } from '../shared/outcome'
import type { Entity, EntityRef, ID, ISODate } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'
import type { Task } from '../tasks/Task'

export type PlanStatus = 'draft' | 'active' | 'completed' | 'abandoned'

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

/**
 * A set of steps (tasks) towards an objective. Plans can come from a case hearing, a meeting
 * (preparation/agenda follow-through) or stand alone, and can be linked to one or more goals.
 */
export interface ActionPlan extends Entity {
  title: string
  objective: string
  workspace: WorkspaceId
  status: PlanStatus
  dueDate?: ISODate
  /** What prompted the plan: a hearing, meeting, case or goal. */
  origin?: EntityRef
  /** Set for plans that belong to a legal case. */
  caseId?: ID
}

export interface PlanProgress {
  total: number
  closed: number
  done: number
  /** 0..1 or null when the plan has no countable steps. */
  progress: number | null
}

export function stepsOf(planId: ID, tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.planId === planId)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.createdAt.localeCompare(b.createdAt))
}

export function planProgress(planId: ID, tasks: Task[]): PlanProgress {
  const steps = stepsOf(planId, tasks)
  return {
    total: steps.length,
    closed: steps.filter((t) => t.outcome.status !== 'open').length,
    done: steps.filter((t) => t.outcome.status === 'done').length,
    progress: progressOf(steps.map((t) => t.outcome)),
  }
}
