import type { Outcome } from '../shared/outcome'
import { instantKey } from '../shared/time'
import type { Entity, ID, ISODate, Minutes } from '../shared/types'

export type CaseStatus = 'active' | 'on_hold' | 'disposed' | 'closed'

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  disposed: 'Disposed',
  closed: 'Closed',
}

/** A legal matter handled by S&B Consultants. */
export interface LegalCase extends Entity {
  /** Court case number or internal reference. */
  reference: string
  title: string
  client: string
  court: string
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
