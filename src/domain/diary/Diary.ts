import type { Entity, ID, ISODate } from '../shared/types'
import type { Task } from '../tasks/Task'

/**
 * The case diary: what an advocate writes up after each date in court, and for the work done in
 * chambers between dates. Indian practice keeps two: a **court diary** (date, case, bench, what was
 * argued, authorities cited, the order, the next date and what it's fixed for) and a **chamber
 * diary** (the day-to-day work: conferences, studying papers, drafting). Here both live on the case,
 * and what has to be done before the next date is kept as actions that become tasks or a plan.
 */
export type DiaryKind = 'court' | 'chamber'

export const DIARY_KIND_LABELS: Record<DiaryKind, string> = { court: 'Court', chamber: 'Chambers' }

/** Something to do as a result of the entry. It can be turned into a task, which it then follows. */
export interface DiaryAction {
  id: ID
  text: string
  due?: ISODate
  taskId?: ID
}

export interface DiaryEntry extends Entity {
  caseId: ID
  /** For a court entry written after a hearing: the hearing it records. */
  hearingId?: ID
  kind: DiaryKind
  /** The day of the hearing, or of the work done. */
  date: ISODate
  /** For chamber work: what it was ("Conference with client", "Drafted reply"). */
  title?: string
  /** The bench or presiding officer. */
  bench?: string
  /** What happened: the proceedings of the day, or the work done. */
  proceedings: string
  /** The order passed and directions given, in a few lines. */
  order?: string
  /** What was argued by either side. */
  submissions?: string
  /** Judgments and provisions cited. */
  authorities: string[]
  /** Witnesses examined or still to be examined; documents exhibited. */
  evidence?: string
  /** Your own read: the bench's leaning, what to do differently, what to watch. */
  reflections?: string
  /** What the matter was adjourned to, and what it's fixed for. */
  nextDate?: ISODate
  nextPurpose?: string
  /** Work due before the next date. */
  actions: DiaryAction[]
}

/** The fields the diary adds to recording a hearing; actions may be new (no id yet). */
export interface DiaryInput {
  kind?: DiaryKind
  title?: string
  bench?: string
  order?: string
  submissions?: string
  authorities?: string[]
  evidence?: string
  reflections?: string
  actions?: { id?: ID; text: string; due?: ISODate; taskId?: ID }[]
}

const stamp = (e: DiaryEntry) => `${e.date}${e.createdAt}`

/** A case's entries, newest first. */
export const entriesOf = (caseId: ID, entries: DiaryEntry[]): DiaryEntry[] => entries.filter((e) => e.caseId === caseId).sort((a, b) => stamp(b).localeCompare(stamp(a)))

/** True when an action's task has been closed (done, or deliberately dropped). */
export const actionClosed = (a: DiaryAction, tasks: Task[]) => {
  const t = a.taskId ? tasks.find((x) => x.id === a.taskId) : undefined
  return !!t && t.outcome.status !== 'open'
}

/** Actions that still need doing: with no task yet, or whose task is open. */
export const pendingActions = (e: DiaryEntry, tasks: Task[]) => e.actions.filter((a) => !actionClosed(a, tasks))

export const entryText = (e: DiaryEntry) =>
  [e.title, e.bench, e.proceedings, e.order, e.submissions, e.evidence, e.reflections, e.nextPurpose, ...e.authorities, ...e.actions.map((a) => a.text)].filter(Boolean).join(' ').toLowerCase()

/** Every word of the query must appear somewhere in the entry. */
export function searchEntries(entries: DiaryEntry[], query: string): DiaryEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? entries.filter((e) => words.every((w) => entryText(e).includes(w))) : entries
}
