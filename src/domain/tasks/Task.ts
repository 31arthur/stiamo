import type { Outcome } from '../shared/outcome'
import type { Entity, EntityRef, ID, ISODate, Minutes, TimeSlot } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

export interface Task extends Entity {
  title: string
  notes: string
  workspace: WorkspaceId
  priority: TaskPriority
  dueDate?: ISODate
  /** Planned time block on the day planner. */
  slot?: TimeSlot
  /** Expected effort, used when the task is placed on the timeline. */
  estimate: Minutes
  /** The action plan this task is a step of. */
  planId?: ID
  /** Position within its action plan. */
  order?: number
  /** Where the task came from (a meeting, hearing, follow-up…). */
  related?: EntityRef
  outcome: Outcome
}

/** The day a task shows up on: its planned slot, otherwise its due date. */
export const taskDate = (t: Task): ISODate | undefined => t.slot?.date ?? t.dueDate

/** Open, past its due date, and not already planned for today or later. */
export const isOverdue = (t: Task, today: ISODate) =>
  t.outcome.status === 'open' && !!t.dueDate && t.dueDate < today && !(t.slot && t.slot.date >= today)
