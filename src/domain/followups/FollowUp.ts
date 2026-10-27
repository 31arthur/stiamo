import type { ConfirmationTiming } from '../meetings/Meeting'
import type { Outcome } from '../shared/outcome'
import { instantKey } from '../shared/time'
import type { Entity, EntityRef, ID, ISODate, Minutes } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'

export type FollowUpChannel = 'call' | 'message' | 'email' | 'visit'

export const CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  call: 'Call',
  message: 'Message',
  email: 'Email',
  visit: 'Visit',
}

/** A touch-point to make with someone: a call, message, email or visit. */
export interface FollowUp extends Entity {
  title: string
  channel: FollowUpChannel
  workspace: WorkspaceId
  /** Name and/or number of who to reach. */
  contact?: string
  /** Optional: a follow-up can simply be pending, or due on a day, or at a specific time. */
  due?: { date: ISODate; time?: Minutes }
  /** Time to block when placed on the planner. */
  duration: Minutes
  /** What this follow-up is about. */
  subject?: EntityRef
  /** Set when generated automatically as an appointment confirmation. */
  trigger?: ConfirmationTiming
  notes?: string
  /** The action plan this follow-up is a step of, and its place there. */
  planId?: ID
  order?: number
  outcome: Outcome
}

/** Sort key: dated follow-ups in time order, undated ones last. */
export const followUpKey = (f: FollowUp) => (f.due ? instantKey(f.due.date, f.due.time ?? 0) : '9999')
