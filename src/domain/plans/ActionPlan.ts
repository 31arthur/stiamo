import type { FollowUp } from '../followups/FollowUp'
import type { Meeting } from '../meetings/Meeting'
import { progressOf } from '../shared/outcome'
import type { Outcome } from '../shared/outcome'
import type { Entity, EntityRef, ID, ISODate, Minutes, RichDoc } from '../shared/types'
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

/** What a step of a plan is: a task to do, a follow-up to make, or an appointment to keep. */
export type StepKind = 'task' | 'followUp' | 'appointment'

export const STEP_KINDS: Record<StepKind, { label: string; hint: string }> = {
  task: { label: 'Task', hint: 'Something to do by a day' },
  followUp: { label: 'Follow-up', hint: 'A call, message or visit to make' },
  appointment: { label: 'Appointment', hint: 'Booked with someone, at a time' },
}

/** The records a plan's steps can live in. */
export interface StepPool {
  tasks: Task[]
  followUps: FollowUp[]
  meetings: Meeting[]
}

/** One step of a plan, whatever it is stored as. `date` is the step's own deadline. */
export interface PlanStep {
  kind: StepKind
  id: ID
  title: string
  planId?: ID
  order?: number
  createdAt: string
  /** The day the step is due or booked for. Each step has its own, whatever the plan's. */
  date?: ISODate
  /** Time of day, when the step has one. */
  time?: Minutes
  outcome: Outcome
  /** The record behind the step. */
  ref: EntityRef
}

export const taskStep = (t: Task): PlanStep => ({
  kind: 'task', id: t.id, title: t.title, planId: t.planId, order: t.order, createdAt: t.createdAt,
  date: t.dueDate ?? t.slot?.date, time: t.slot?.start, outcome: t.outcome, ref: { kind: 'task', id: t.id },
})
export const followUpStep = (f: FollowUp): PlanStep => ({
  kind: 'followUp', id: f.id, title: f.title, planId: f.planId, order: f.order, createdAt: f.createdAt,
  date: f.due?.date, time: f.due?.time, outcome: f.outcome, ref: { kind: 'followUp', id: f.id },
})
export const appointmentStep = (m: Meeting): PlanStep => ({
  kind: 'appointment', id: m.id, title: m.title, planId: m.planId, order: m.order, createdAt: m.createdAt,
  date: m.slot.date, time: m.slot.start, outcome: m.outcome, ref: { kind: 'meeting', id: m.id },
})

/** Older callers pass just the tasks; a plan's other steps are then not counted. */
export const asPool = (pool: StepPool | Task[]): StepPool => (Array.isArray(pool) ? { tasks: pool, followUps: [], meetings: [] } : pool)

const byOrder = (a: PlanStep, b: PlanStep) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.createdAt.localeCompare(b.createdAt)

/** Every step of a plan in its own order, whether a task, a follow-up or an appointment. */
export function planSteps(planId: ID, pool: StepPool | Task[]): PlanStep[] {
  const p = asPool(pool)
  return [
    ...p.tasks.filter((t) => t.planId === planId).map(taskStep),
    ...p.followUps.filter((f) => f.planId === planId).map(followUpStep),
    ...p.meetings.filter((m) => m.planId === planId).map(appointmentStep),
  ].sort(byOrder)
}

/** A step (or any task, follow-up or appointment) found by its id. */
export function stepById(id: ID, pool: StepPool | Task[]): PlanStep | undefined {
  const p = asPool(pool)
  const t = p.tasks.find((x) => x.id === id)
  if (t) return taskStep(t)
  const f = p.followUps.find((x) => x.id === id)
  if (f) return followUpStep(f)
  const m = p.meetings.find((x) => x.id === id)
  return m ? appointmentStep(m) : undefined
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

export function planProgress(planId: ID, pool: StepPool | Task[]): PlanProgress {
  const steps = planSteps(planId, pool)
  return {
    total: steps.length,
    closed: steps.filter((t) => t.outcome.status !== 'open').length,
    done: steps.filter((t) => t.outcome.status === 'done').length,
    progress: progressOf(steps.map((t) => t.outcome)),
  }
}
