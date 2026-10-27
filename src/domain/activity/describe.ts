import { CASE_TYPES, caseTypeOf } from '../cases/LegalCase'
import type { Hearing, LegalCase } from '../cases/LegalCase'
import { counselLabel } from '../counsel/Counsel'
import type { Counsel } from '../counsel/Counsel'
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, PROJECT_STATUS_LABELS } from '../clients/Client'
import type { Client, Project } from '../clients/Client'
import { PLAN_SCOPE_LABELS, planCaseIds, planHearingIds, planScope } from '../plans/ActionPlan'
import type { PlanScope } from '../plans/ActionPlan'
import type { FollowUp } from '../followups/FollowUp'
import type { Goal } from '../goals/Goal'
import type { Meeting } from '../meetings/Meeting'
import type { ActionPlan } from '../plans/ActionPlan'
import { OUTCOME_LABELS } from '../shared/outcome'
import type { Outcome } from '../shared/outcome'
import { formatClock, formatDuration } from '../shared/time'
import type { EntityKind, EntityRef, Minutes } from '../shared/types'
import type { Task } from '../tasks/Task'
import type { ActivityAction, FieldChange } from './Activity'

type Records = { task: Task; meeting: Meeting; followUp: FollowUp; case: LegalCase; hearing: Hearing; plan: ActionPlan; goal: Goal; counsel: Counsel; client: Client; project: Project }

export const KIND_LABEL: Record<EntityKind, string> = {
  task: 'Task',
  meeting: 'Meeting',
  followUp: 'Follow-up',
  case: 'Case',
  hearing: 'Hearing',
  plan: 'Action plan',
  goal: 'Goal',
  counsel: 'Counsel',
  client: 'Client',
  project: 'Project',
}

export function titleOf<K extends EntityKind>(kind: K, e: Records[K]): string {
  switch (kind) {
    case 'case': {
      const c = e as LegalCase
      return `${c.reference} — ${c.title}`
    }
    case 'hearing':
      return `Hearing: ${(e as Hearing).purpose}`
    case 'counsel':
      return counselLabel(e as Counsel)
    case 'client':
      return (e as Client).name
    default:
      return (e as { title: string }).title
  }
}

/** The record this one hangs under, for "created in …" history. */
export function parentOf<K extends EntityKind>(kind: K, e: Records[K]): EntityRef | undefined {
  switch (kind) {
    case 'task': {
      const t = e as Task
      return t.planId ? { kind: 'plan', id: t.planId } : t.related
    }
    case 'followUp': {
      const f = e as FollowUp
      return f.planId ? { kind: 'plan', id: f.planId } : f.subject
    }
    case 'meeting': {
      const m = e as Meeting
      return m.planId ? { kind: 'plan', id: m.planId } : m.related
    }
    case 'hearing':
      return { kind: 'case', id: (e as Hearing).caseId }
    case 'plan': {
      const p = e as ActionPlan
      const firstCase = planCaseIds(p)[0]
      return p.origin ?? (firstCase ? { kind: 'case', id: firstCase } : undefined)
    }
    case 'project':
      return { kind: 'client', id: (e as Project).clientId }
    default:
      return undefined
  }
}

const fmtOutcome = (o: Outcome) => OUTCOME_LABELS[o.status] + (o.comment ? ` — ${o.comment}` : '')
const fmtWhen = (date?: string, time?: Minutes) => (date ? `${date}${time !== undefined ? ` ${formatClock(time)}` : ''}` : 'none')
const text = (s?: string) => (s && s.length > 60 ? `${s.slice(0, 57)}…` : s || '—')

/** Compares two versions of a record and lists what changed, in words. */
export function diff<K extends EntityKind>(kind: K, before: Records[K], after: Records[K]): { action: ActivityAction; changes: FieldChange[] } {
  const changes: FieldChange[] = []
  const add = (field: string, from: unknown, to: unknown, fmt: (v: never) => string = (v) => String(v ?? '—')) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, from: fmt(from as never), to: fmt(to as never) })
  }
  let action: ActivityAction = 'updated'
  const b = before as unknown as Record<string, unknown>
  const a = after as unknown as Record<string, unknown>

  if ('title' in a) add('Title', b.title, a.title)
  if ('outcome' in a && JSON.stringify(b.outcome) !== JSON.stringify(a.outcome)) {
    const o = a.outcome as Outcome
    changes.push({ field: 'Outcome', from: fmtOutcome(b.outcome as Outcome), to: fmtOutcome(o) })
    if (o.nextAction) changes.push({ field: 'Further action', to: o.nextAction })
    action = 'outcome'
  }

  switch (kind) {
    case 'task': {
      const [x, y] = [before as Task, after as Task]
      add('Due', x.dueDate, y.dueDate)
      add('Priority', x.priority, y.priority)
      add('Workspace', x.workspace, y.workspace)
      add('Estimate', x.estimate, y.estimate, (v: number) => formatDuration(v))
      add('Plan', x.planId, y.planId, (v?: string) => (v ? 'linked' : 'none'))
      if (JSON.stringify(x.slot) !== JSON.stringify(y.slot)) {
        changes.push({ field: 'Planned', from: fmtWhen(x.slot?.date, x.slot?.start), to: fmtWhen(y.slot?.date, y.slot?.start) })
        if (action === 'updated') action = 'scheduled'
      }
      add('Notes', x.notes, y.notes, text)
      break
    }
    case 'followUp': {
      const [x, y] = [before as FollowUp, after as FollowUp]
      if (JSON.stringify(x.due) !== JSON.stringify(y.due)) {
        changes.push({ field: 'Due', from: x.due ? fmtWhen(x.due.date, x.due.time) : 'anytime', to: y.due ? fmtWhen(y.due.date, y.due.time) : 'anytime' })
        if (action === 'updated') action = 'scheduled'
      }
      add('Channel', x.channel, y.channel)
      add('Contact', x.contact, y.contact)
      break
    }
    case 'meeting': {
      const [x, y] = [before as Meeting, after as Meeting]
      if (JSON.stringify(x.slot) !== JSON.stringify(y.slot)) {
        changes.push({ field: 'When', from: `${fmtWhen(x.slot.date, x.slot.start)} (${formatDuration(x.slot.duration)})`, to: `${fmtWhen(y.slot.date, y.slot.start)} (${formatDuration(y.slot.duration)})` })
        if (action === 'updated') action = 'scheduled'
      }
      add('Mode', x.mode, y.mode)
      add('Location', x.location, y.location)
      add('With', x.counterpart, y.counterpart)
      const topics = (m: Meeting) => m.agenda.map((i) => i.topic)
      add('Agenda', topics(x), topics(y), (v: string[]) => `${v.length} item${v.length === 1 ? '' : 's'}`)
      for (const item of y.agenda) {
        const prev = x.agenda.find((i) => i.id === item.id)
        if (prev && prev.outcome.status !== item.outcome.status) changes.push({ field: `Agenda: ${item.topic}`, from: OUTCOME_LABELS[prev.outcome.status], to: fmtOutcome(item.outcome) })
      }
      add('Minutes', x.minutes, y.minutes, text)
      add('Preparation plan', x.prepPlanId, y.prepPlanId, (v?: string) => (v ? 'created' : 'none'))
      break
    }
    case 'case': {
      const [x, y] = [before as LegalCase, after as LegalCase]
      add('Status', x.status, y.status)
      add('Type', x.type, y.type, (v: string) => CASE_TYPES[caseTypeOf(v)].label)
      add('Stage', x.stage, y.stage)
      add('Court', x.court, y.court)
      add('Court number', x.courtNumber, y.courtNumber)
      add('Summary', x.summary, y.summary, text)
      break
    }
    case 'hearing': {
      const [x, y] = [before as Hearing, after as Hearing]
      add('Date', fmtWhen(x.date, x.time), fmtWhen(y.date, y.time))
      add('Purpose', x.purpose, y.purpose)
      add('Hearing summary', x.summary, y.summary, text)
      add('Order', x.order, y.order, text)
      add('Also heard with', (x.alsoCaseIds ?? []).length, (y.alsoCaseIds ?? []).length, (v: number) => (v ? `${v} other case${v === 1 ? '' : 's'}` : 'none'))
      break
    }
    case 'plan': {
      const [x, y] = [before as ActionPlan, after as ActionPlan]
      add('Status', x.status, y.status)
      add('Due', x.dueDate, y.dueDate)
      add('Objective', x.objective, y.objective, text)
      add('Scope', planScope(x), planScope(y), (v: PlanScope) => PLAN_SCOPE_LABELS[v])
      add('Cases', planCaseIds(x).length, planCaseIds(y).length)
      add('Hearings', planHearingIds(x).length, planHearingIds(y).length)
      break
    }
    case 'counsel': {
      const [x, y] = [before as Counsel, after as Counsel]
      add('Status', x.status, y.status)
      add('Phone', x.phone, y.phone)
      add('Email', x.email, y.email)
      add('Pro bono', x.proBono, y.proBono, (v: boolean) => (v ? 'yes' : 'no'))
      add('Notes', x.notes, y.notes, text)
      break
    }
    case 'client': {
      const [x, y] = [before as Client, after as Client]
      add('Status', x.status, y.status, (v: Client['status']) => CLIENT_STATUS_LABELS[v])
      add('Kind', x.kind, y.kind, (v: Client['kind']) => CLIENT_KIND_LABELS[v])
      add('Contact', x.contactName, y.contactName)
      add('Phone', x.phone, y.phone)
      add('Email', x.email, y.email)
      add('Notes', x.notes, y.notes, text)
      break
    }
    case 'project': {
      const [x, y] = [before as Project, after as Project]
      add('Status', x.status, y.status, (v: Project['status']) => PROJECT_STATUS_LABELS[v])
      add('Start', x.startDate, y.startDate)
      add('Due', x.dueDate, y.dueDate)
      add('Description', x.description, y.description, text)
      break
    }
    case 'goal': {
      const [x, y] = [before as Goal, after as Goal]
      add('Status', x.status, y.status)
      add('Target date', x.targetDate, y.targetDate)
      for (const kr of y.keyResults) {
        const prev = x.keyResults.find((k) => k.id === kr.id)
        if (prev && prev.current !== kr.current) changes.push({ field: kr.label, from: String(prev.current), to: `${kr.current} / ${kr.target}` })
      }
      add('Linked plans', x.planIds.length, y.planIds.length)
      if (y.checkIns.length > x.checkIns.length) changes.push({ field: 'Check-in', to: `${y.checkIns[0].confidence}/5 — ${text(y.checkIns[0].note)}` })
      break
    }
  }
  return { action, changes }
}

/** One-line summary of a change set. */
export function summarize(action: ActivityAction, changes: FieldChange[]): string {
  if (action === 'outcome') return `Outcome recorded: ${changes.find((c) => c.field === 'Outcome')?.to ?? ''}`
  if (changes.length === 1) {
    const c = changes[0]
    return c.from && c.from !== '—' ? `${c.field}: ${c.from} → ${c.to}` : `${c.field}: ${c.to}`
  }
  return `Updated ${changes.map((c) => c.field.toLowerCase()).join(', ')}`
}
