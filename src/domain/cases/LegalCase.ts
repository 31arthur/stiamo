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

/** The kind of matter. */
export type CaseType = 'pow' | 'public_interest' | 'industrial_dispute' | 'minimum_wages' | 'workmen_compensation' | 'other'

export const CASE_TYPES: Record<CaseType, { label: string; description: string }> = {
  pow: { label: 'PoW Case', description: 'Unpaid or delayed wages — Payment of Wages Act' },
  public_interest: { label: 'Public Interest Case', description: 'Filed for a wider group or cause, not one individual' },
  industrial_dispute: { label: 'Industrial Disputes Case', description: 'Termination, retrenchment, settlements — Industrial Disputes Act' },
  minimum_wages: { label: 'MW Case', description: 'Pay below the notified rate — Minimum Wages Act' },
  workmen_compensation: { label: 'Workmen Compensation Case', description: 'Compensation for injury or death at work' },
  other: { label: 'Other', description: 'Anything that doesn’t fit the above' },
}

export const CASE_TYPE_ORDER = Object.keys(CASE_TYPES) as CaseType[]

/** Older records may carry a type that no longer exists; those read as "Other" (a PIL as public interest). */
export const caseTypeOf = (raw: string | undefined): CaseType => (raw && raw in CASE_TYPES ? (raw as CaseType) : raw === 'pil' ? 'public_interest' : 'other')

/**
 * Set when a case is briefed to outside counsel. A case with no engagement is handled by us,
 * which is the usual situation.
 */
export interface Engagement {
  counselId: ID
  engagedOn?: ISODate
  /** What they're briefed to do: "Appear at all hearings", "Draft and file only"… */
  scope?: string
  proBono: boolean
  /** The agreed fee in words, e.g. "₹25,000 fixed + ₹3,000 per hearing". */
  fee?: string
  notes?: string
}

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
  /** Court or forum. */
  court?: string
  /** Outside counsel briefed on the case. Absent means we handle it ourselves. */
  engagement?: Engagement
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
