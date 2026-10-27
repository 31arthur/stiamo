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
  /**
   * The cases this plan belongs to. One plan can serve several cases (the same approach for a batch
   * of similar matters); it is one page and one set of steps, shared by all of them.
   */
  caseIds?: ID[]
  /**
   * Narrows the plan to particular hearings of those cases, e.g. the same preparation for the next
   * two dates. Empty means it covers the cases as a whole.
   */
  hearingIds?: ID[]
  /** Set when the plan is only about one task. */
  taskId?: ID
  /** Single-valued fields from before plans could cover several. Read through `planCaseIds`/`planHearingIds`; rewritten on save. */
  caseId?: ID
  hearingId?: ID
  /** The plan's page: rich blocks (text, headings, images, files, drawings…) from the block editor. */
  doc?: RichDoc
}

/** What a plan covers: nothing in particular, whole case(s), particular hearings, or a single task. */
export type PlanScope = 'general' | 'case' | 'hearing' | 'task'

export const PLAN_SCOPE_LABELS: Record<PlanScope, string> = {
  general: 'General',
  case: 'Case-wide',
  hearing: 'Specific hearings',
  task: 'One task',
}

type Coverage = Pick<ActionPlan, 'caseIds' | 'hearingIds' | 'caseId' | 'hearingId'>
const unique = (ids: (ID | undefined)[]): ID[] => [...new Set(ids.filter((id): id is ID => !!id))]

export const planCaseIds = (p: Coverage): ID[] => unique([...(p.caseIds ?? []), p.caseId])
export const planHearingIds = (p: Coverage): ID[] => unique([...(p.hearingIds ?? []), p.hearingId])

export const planScope = (p: Coverage & Pick<ActionPlan, 'taskId'>): PlanScope =>
  planHearingIds(p).length ? 'hearing' : p.taskId ? 'task' : planCaseIds(p).length ? 'case' : 'general'

/** True when the plan applies to this case, whether as a whole or through one of its hearings. */
export const coversCase = (p: Coverage, caseId: ID) => planCaseIds(p).includes(caseId)
export const coversHearing = (p: Coverage, hearingId: ID) => planHearingIds(p).includes(hearingId)

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
