import { stepById } from '../plans/ActionPlan'
import type { StepPool } from '../plans/ActionPlan'
import type { ID } from '../shared/types'
import type { Task } from '../tasks/Task'
import { hearingCaseIds } from './LegalCase'
import type { Hearing, HearingAction, LegalCase } from './LegalCase'

/**
 * The case diary is the hearing record itself: there is no separate entry to keep in step. A
 * hearing that has been written up (or has an order or work noted on it) is a diary entry, and one
 * entry serves every case the hearing concerned.
 */
export const isDiaryEntry = (h: Hearing) => h.outcome.status !== 'open' || !!(h.summary || h.order || h.actions?.length)

/** Recorded hearings, newest first. */
export const diaryOf = (hearings: Hearing[]): Hearing[] =>
  hearings.filter(isDiaryEntry).sort((a, b) => `${b.date}${b.time ?? 0}`.localeCompare(`${a.date}${a.time ?? 0}`))

/** True when an action's step (its task, follow-up or appointment) has been closed: done, or deliberately dropped. */
export const actionClosed = (a: HearingAction, pool: StepPool | Task[]) => {
  const s = a.taskId ? stepById(a.taskId, pool) : undefined
  return !!s && s.outcome.status !== 'open'
}

/** Actions that still need doing: with nothing made for them yet, or whose step is open. */
export const pendingActions = (h: Hearing, pool: StepPool | Task[]) => (h.actions ?? []).filter((a) => !actionClosed(a, pool))

const text = (h: Hearing, cases: LegalCase[]) =>
  [
    h.purpose,
    h.bench,
    h.summary,
    h.order,
    h.submissions,
    h.evidence,
    h.reflections,
    h.outcome.comment,
    ...(h.authorities ?? []),
    ...(h.actions ?? []).map((a) => a.text),
    ...hearingCaseIds(h).flatMap((id) => {
      const c = cases.find((x) => x.id === id)
      return c ? [c.reference, c.title, c.client] : []
    }),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Every word of the query must appear somewhere in the entry (or in the cases it concerns). */
export function searchDiary(hearings: Hearing[], cases: LegalCase[], query: string): Hearing[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? hearings.filter((h) => words.every((w) => text(h, cases).includes(w))) : hearings
}

/**
 * Listings that would be folded into `hearing` if `caseIds` were added to it: another case's listing
 * on the same day that hasn't been written up. (One that has been written up is left alone — it
 * already has its own record.)
 */
export const mergeCandidates = (hearing: Pick<Hearing, 'id' | 'caseId' | 'date'>, caseIds: ID[], hearings: Hearing[]): Hearing[] =>
  hearings.filter(
    (o) => o.id !== hearing.id && o.date === hearing.date && o.outcome.status === 'open' && !isDiaryEntry(o) && hearingCaseIds(o).some((id) => id !== hearing.caseId && caseIds.includes(id)),
  )

export const touchesCase = (h: Hearing, caseId: ID) => hearingCaseIds(h).includes(caseId)
