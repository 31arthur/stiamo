import { progressOf } from '../shared/outcome'
import type { Entity, EntityRef, ID, ISODate, RichDoc } from '../shared/types'
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
  /** Set when the plan is only for one hearing of that case (e.g. preparing for the next date). */
  hearingId?: ID
  /** Set when the plan is only about one task. */
  taskId?: ID
  /** The plan's page: rich blocks (text, headings, images, files, drawings…) from the block editor. */
  doc?: RichDoc
}

/** What a plan covers: nothing in particular, a whole case, a single hearing, or a single task. */
export type PlanScope = 'general' | 'case' | 'hearing' | 'task'

export const PLAN_SCOPE_LABELS: Record<PlanScope, string> = {
  general: 'General',
  case: 'Whole case',
  hearing: 'One hearing',
  task: 'One task',
}

export const planScope = (p: Pick<ActionPlan, 'caseId' | 'hearingId' | 'taskId'>): PlanScope =>
  p.hearingId ? 'hearing' : p.taskId ? 'task' : p.caseId ? 'case' : 'general'

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
