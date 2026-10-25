import type { ISODateTime } from './types'

/**
 * How something actually turned out. Replaces a bare "completed" flag: work can be done, partly done,
 * not done, or cancelled, and each result can carry a comment and a further action.
 */
export type OutcomeStatus = 'open' | 'done' | 'partial' | 'not_done' | 'cancelled'

export interface Outcome {
  status: OutcomeStatus
  comment?: string
  /** What still needs to happen as a result. */
  nextAction?: string
  recordedAt?: ISODateTime
}

export const OPEN: Outcome = { status: 'open' }

export const OUTCOME_LABELS: Record<OutcomeStatus, string> = {
  open: 'Open',
  done: 'Done',
  partial: 'Partly done',
  not_done: 'Not done',
  cancelled: 'Cancelled',
}

export const isOpen = (o: Outcome) => o.status === 'open'
export const isClosed = (o: Outcome) => o.status !== 'open'

/** Contribution of an outcome to progress (cancelled items are excluded by callers). */
export const outcomeScore = (o: Outcome): number => (o.status === 'done' ? 1 : o.status === 'partial' ? 0.5 : 0)

/** Progress over a set of outcomes, ignoring cancelled ones. Returns 0..1, or null when nothing counts. */
export function progressOf(outcomes: Outcome[]): number | null {
  const counted = outcomes.filter((o) => o.status !== 'cancelled')
  if (counted.length === 0) return null
  return counted.reduce((sum, o) => sum + outcomeScore(o), 0) / counted.length
}
