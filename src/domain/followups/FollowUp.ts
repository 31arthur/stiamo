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

/** How one try went: nobody picked up, they asked for a later call, it's sorted, and so on. */
export type AttemptResult = 'no_answer' | 'left_message' | 'call_back' | 'they_will_call' | 'not_ready' | 'reached' | 'unreachable'

/** One try at reaching someone, kept on the follow-up so the whole chase can be read back. */
export interface Attempt {
  date: ISODate
  /** Local time of the try. */
  minute: Minutes
  result: AttemptResult
  /** How it was tried, when that differs from the follow-up's channel by then. */
  channel?: FollowUpChannel
  note?: string
  /** For "not done yet": the day they promised it for. */
  promisedFor?: ISODate
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
  /** Every try so far, oldest first. The follow-up stays open across them until someone is reached. */
  attempts?: Attempt[]
  /** The action plan this follow-up is a step of, and its place there. */
  planId?: ID
  order?: number
  outcome: Outcome
}

/** Sort key: dated follow-ups in time order, undated ones last. */
export const followUpKey = (f: FollowUp) => (f.due ? instantKey(f.due.date, f.due.time ?? 0) : '9999')
