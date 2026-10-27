import type { Hearing, LegalCase } from '../cases/LegalCase'
import type { FollowUp } from '../followups/FollowUp'
import type { Meeting, MeetingKind } from '../meetings/Meeting'
import type { Outcome } from '../shared/outcome'
import type { EntityRef, ISODate, Minutes } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'
import type { Task, TaskPriority } from '../tasks/Task'
import { taskDate } from '../tasks/Task'

export type AgendaKind = 'task' | 'meeting' | 'followUp' | 'hearing'

/** One thing on a day, whatever its source. The calendar and the planner work on these. */
export interface AgendaEntry {
  /** Stable key, `${kind}:${id}`. */
  key: string
  ref: EntityRef
  kind: AgendaKind
  title: string
  subtitle?: string
  date: ISODate
  /** Present when the entry has a time on that day. */
  slot?: { start: Minutes; duration: Minutes }
  /** Planned or default duration, used when it's placed on the timeline. */
  duration: Minutes
  workspace: WorkspaceId
  outcome: Outcome
  /** Fixed in time: reflow flows around it. */
  pinned: boolean
  /** Can be dragged to another time. */
  movable: boolean
  meetingKind?: MeetingKind
  priority?: TaskPriority
}

export interface AgendaSources {
  tasks: Task[]
  meetings: Meeting[]
  followUps: FollowUp[]
  hearings: Hearing[]
  cases: LegalCase[]
}

export const entryKey = (ref: EntityRef) => `${ref.kind}:${ref.id}`

const KIND_ORDER: Record<AgendaKind, number> = { hearing: 0, meeting: 1, followUp: 2, task: 3 }

/** Collects every dated item between `from` and `to` (inclusive), timed items first in time order. */
export function buildAgenda(src: AgendaSources, from: ISODate, to: ISODate): AgendaEntry[] {
  const inRange = (d?: ISODate): d is ISODate => !!d && d >= from && d <= to
  const entries: AgendaEntry[] = []
  const caseById = new Map(src.cases.map((c) => [c.id, c]))

  for (const t of src.tasks) {
    const date = taskDate(t)
    if (!inRange(date)) continue
    const ref: EntityRef = { kind: 'task', id: t.id }
    entries.push({
      key: entryKey(ref),
      ref,
      kind: 'task',
      title: t.title,
      date,
      slot: t.slot && { start: t.slot.start, duration: t.slot.duration },
      duration: t.slot?.duration ?? t.estimate,
      workspace: t.workspace,
      outcome: t.outcome,
      pinned: false,
      movable: true,
      priority: t.priority,
    })
  }

  for (const m of src.meetings) {
    if (!inRange(m.slot.date)) continue
    const ref: EntityRef = { kind: 'meeting', id: m.id }
    entries.push({
      key: entryKey(ref),
      ref,
      kind: 'meeting',
      title: m.title,
      subtitle: m.counterpart,
      date: m.slot.date,
      slot: { start: m.slot.start, duration: m.slot.duration },
      duration: m.slot.duration,
      workspace: m.workspace,
      outcome: m.outcome,
      pinned: true,
      movable: true,
      meetingKind: m.kind,
    })
  }

  for (const f of src.followUps) {
    if (!f.due || !inRange(f.due.date)) continue
    const ref: EntityRef = { kind: 'followUp', id: f.id }
    entries.push({
      key: entryKey(ref),
      ref,
      kind: 'followUp',
      title: f.title,
      subtitle: f.contact,
      date: f.due.date,
      slot: f.due.time !== undefined ? { start: f.due.time, duration: f.duration } : undefined,
      duration: f.duration,
      workspace: f.workspace,
      outcome: f.outcome,
      // Confirmations are tied to the appointment's time; other follow-ups can flow.
      pinned: !!f.trigger,
      movable: true,
    })
  }

  for (const h of src.hearings) {
    if (!inRange(h.date)) continue
    const legalCase = caseById.get(h.caseId)
    const others = (h.alsoCaseIds ?? []).map((id) => caseById.get(id)?.reference).filter(Boolean)
    const ref: EntityRef = { kind: 'hearing', id: h.id }
    entries.push({
      key: entryKey(ref),
      ref,
      kind: 'hearing',
      title: `Hearing — ${legalCase?.title ?? 'Case'}`,
      subtitle: [[legalCase?.reference, ...others].filter(Boolean).join(' + '), h.purpose].filter(Boolean).join(' · '),
      date: h.date,
      slot: h.time !== undefined ? { start: h.time, duration: h.duration } : undefined,
      duration: h.duration,
      workspace: 'sb',
      outcome: h.outcome,
      pinned: true,
      movable: false,
    })
  }

  return entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.slot?.start ?? Infinity) - (b.slot?.start ?? Infinity) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title),
  )
}
