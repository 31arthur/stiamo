import type { Outcome } from '../shared/outcome'
import type { Entity, EntityRef, ID, TimeSlot } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'

/**
 * Appointments and meetings share one model — both are timed engagements with people.
 * The kind captures the difference in how they're handled:
 * - appointment: booked with a client or outside party; it must be confirmed beforehand (calls/messages).
 * - meeting: an agenda-driven discussion; it needs an agenda and preparation.
 */
export type MeetingKind = 'appointment' | 'meeting'
export type MeetingMode = 'in_person' | 'virtual' | 'phone'
export type ConfirmationTiming = 'day_before' | 'hour_before'

export const MEETING_KINDS: Record<MeetingKind, { label: string; description: string }> = {
  appointment: { label: 'Appointment', description: 'Booked with a client or outside party — confirm beforehand' },
  meeting: { label: 'Meeting', description: 'Agenda-driven discussion — prepare the agenda' },
}

export const MEETING_MODES: Record<MeetingMode, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  phone: 'Phone',
}

export const CONFIRMATION_LABELS: Record<ConfirmationTiming, string> = {
  day_before: 'Day before',
  hour_before: 'Hour before',
}

export interface AgendaItem {
  id: ID
  topic: string
  notes?: string
  /** Owner or presenter. */
  owner?: string
  /** Planned minutes for this item. */
  minutes?: number
  outcome: Outcome
}

export interface Meeting extends Entity {
  kind: MeetingKind
  title: string
  workspace: WorkspaceId
  slot: TimeSlot
  mode: MeetingMode
  location?: string
  link?: string
  /** Who it's with: client, person or organisation. */
  counterpart?: string
  /** Phone or email used for confirmations. */
  contact?: string
  attendees: string[]
  purpose?: string
  agenda: AgendaItem[]
  /** Confirmation follow-ups to keep scheduled for this engagement. */
  confirmations: ConfirmationTiming[]
  /** Preparation action plan. */
  prepPlanId?: ID
  /** The action plan this appointment is a step of, and its place there. */
  planId?: ID
  order?: number
  /** E.g. the legal case this is about. */
  related?: EntityRef
  /** Notes taken during or after. */
  minutes?: string
  /** Whether it happened and how it went. */
  outcome: Outcome
}

export const defaultConfirmations = (kind: MeetingKind): ConfirmationTiming[] =>
  kind === 'appointment' ? ['day_before', 'hour_before'] : []
