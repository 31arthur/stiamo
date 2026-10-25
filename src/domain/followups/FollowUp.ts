import type { ConfirmationTiming } from '../meetings/Meeting'
import type { Outcome } from '../shared/outcome'
import { instantKey } from '../shared/time'
import type { Entity, EntityRef, ISODate, Minutes } from '../shared/types'
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
  due: { date: ISODate; time?: Minutes }
  /** Time to block when placed on the planner. */
  duration: Minutes
  /** What this follow-up is about. */
  subject?: EntityRef
  /** Set when generated automatically as an appointment confirmation. */
  trigger?: ConfirmationTiming
  notes?: string
  outcome: Outcome
}

export const followUpKey = (f: FollowUp) => instantKey(f.due.date, f.due.time ?? 0)
