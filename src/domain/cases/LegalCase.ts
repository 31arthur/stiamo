import type { Outcome } from '../shared/outcome'
import { instantKey } from '../shared/time'
import type { Entity, ID, ISODate, Minutes } from '../shared/types'
import type { OrganizationCode } from './Organization'

export type CaseStatus = 'active' | 'on_hold' | 'disposed' | 'closed'

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  disposed: 'Disposed',
  closed: 'Closed',
}

/** How we are engaged on a matter — whether we run the whole case or take a part of it. */
export type CaseType = 'full_case' | 'pil' | 'writ' | 'appeal' | 'intervention' | 'appearance' | 'complaint' | 'advisory'

export const CASE_TYPES: Record<CaseType, { label: string; description: string }> = {
  full_case: { label: 'Full case', description: 'We conduct the whole matter, from filing to disposal' },
  pil: { label: 'Public interest litigation', description: 'Filed for a wider group or cause, not one individual' },
  writ: { label: 'Writ petition', description: 'Constitutional remedy before the High Court or Supreme Court' },
  appeal: { label: 'Appeal / revision', description: 'Challenging an order or judgment' },
  intervention: { label: 'Intervention', description: 'Joining a case someone else has filed' },
  appearance: { label: 'Appearance only', description: 'We appear on specific hearings, not the whole case' },
  complaint: { label: 'Complaint / representation', description: 'Before a labour authority, commission or police' },
  advisory: { label: 'Legal opinion', description: 'Advice without a proceeding' },
}

export const CASE_TYPE_ORDER = Object.keys(CASE_TYPES) as CaseType[]

/** A legal matter, filed on behalf of one of the organizations. */
export interface LegalCase extends Entity {
  /** Our case number, generated when the case is opened: `{ORG}-{YYYY}-{NNN}`. */
  reference: string
  /** The organization the case is filed for; its code prefixes the case number. */
  organization: OrganizationCode
  type: CaseType
  title: string
  /** The person or group the case is brought for, if more specific than the organization. */
  client?: string
  /** The court's own number for the matter, once it has one (e.g. "WP 1290/2026"). */
  courtNumber?: string
  /** Court or forum; blank for opinions. */
  court?: string
  opposingParty?: string
  practiceArea?: string
  /** Procedural stage, e.g. "Evidence", "Arguments". */
  stage?: string
  status: CaseStatus
  /** Running case summary, written and revised over time. */
  summary: string
  filedOn?: ISODate
}

export interface Hearing extends Entity {
  caseId: ID
  date: ISODate
  time?: Minutes
  duration: Minutes
  /** What the hearing is listed for. */
  purpose: string
  /** Courtroom / bench. */
  forum?: string
  /** What happened, written after the hearing. */
  summary?: string
  /** Done = proceeded as planned; not done = adjourned/not taken up; etc. */
  outcome: Outcome
  /** The hearing scheduled as a result of this one. */
  nextHearingId?: ID
}

const hearingKey = (h: Hearing) => instantKey(h.date, h.time ?? 0)

export function hearingsOf(caseId: ID, hearings: Hearing[]): Hearing[] {
  return hearings.filter((h) => h.caseId === caseId).sort((a, b) => hearingKey(a).localeCompare(hearingKey(b)))
}

/** The next hearing on or after `today` that hasn't been recorded yet. */
export function nextHearing(caseId: ID, hearings: Hearing[], today: ISODate): Hearing | undefined {
  return hearingsOf(caseId, hearings).find((h) => h.date >= today && h.outcome.status === 'open')
}

/** Past hearings whose result hasn't been written up — these need attention. */
export function unrecordedHearings(hearings: Hearing[], today: ISODate): Hearing[] {
  return hearings.filter((h) => h.date < today && h.outcome.status === 'open')
}
