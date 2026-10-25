import type { FollowUp } from '../followups/FollowUp'
import { OPEN } from '../shared/outcome'
import { offsetMinutes, shiftDate } from '../shared/time'
import type { Draft, ISODate, Minutes, TimeSlot } from '../shared/types'
import type { ConfirmationTiming, Meeting } from './Meeting'

/** Day-before confirmation calls happen at the meeting's own clock time, kept within working hours. */
const DAY_BEFORE_EARLIEST = 9 * 60
const DAY_BEFORE_LATEST = 19 * 60
const CONFIRMATION_DURATION = 10

export function confirmationDue(slot: TimeSlot, timing: ConfirmationTiming): { date: ISODate; time: Minutes } {
  if (timing === 'hour_before') {
    const { date, minute } = offsetMinutes(slot.date, slot.start, -60)
    return { date, time: minute }
  }
  return {
    date: shiftDate(slot.date, -1),
    time: Math.min(DAY_BEFORE_LATEST, Math.max(DAY_BEFORE_EARLIEST, slot.start)),
  }
}

export interface ConfirmationSync {
  create: Draft<FollowUp>[]
  update: FollowUp[]
  remove: FollowUp[]
}

export const confirmationTitle = (meeting: Meeting) =>
  `Confirm ${meeting.kind === 'appointment' ? 'appointment' : 'meeting'} — ${meeting.counterpart || meeting.title}`

/**
 * Keeps generated confirmation follow-ups in step with the meeting: creates missing ones, moves open
 * ones when the meeting is rescheduled, and drops open ones that are no longer wanted (or when the
 * meeting is cancelled). Follow-ups that already have an outcome are history and never touched.
 */
export function syncConfirmations(meeting: Meeting, followUps: FollowUp[]): ConfirmationSync {
  const generated = followUps.filter((f) => f.trigger && f.subject?.kind === 'meeting' && f.subject.id === meeting.id)
  const wanted = meeting.outcome.status === 'cancelled' ? [] : meeting.confirmations
  const result: ConfirmationSync = { create: [], update: [], remove: [] }

  for (const timing of wanted) {
    const due = confirmationDue(meeting.slot, timing)
    const existing = generated.find((f) => f.trigger === timing)
    const title = confirmationTitle(meeting)
    if (!existing) {
      result.create.push({
        title,
        channel: meeting.mode === 'virtual' ? 'message' : 'call',
        workspace: meeting.workspace,
        contact: meeting.contact || meeting.counterpart,
        due,
        duration: CONFIRMATION_DURATION,
        subject: { kind: 'meeting', id: meeting.id },
        trigger: timing,
        outcome: OPEN,
      })
    } else if (
      existing.outcome.status === 'open' &&
      (existing.due.date !== due.date || existing.due.time !== due.time || existing.title !== title || existing.workspace !== meeting.workspace)
    ) {
      result.update.push({ ...existing, due, title, workspace: meeting.workspace, contact: meeting.contact || meeting.counterpart })
    }
  }

  result.remove = generated.filter((f) => f.outcome.status === 'open' && !wanted.includes(f.trigger!))
  return result
}
