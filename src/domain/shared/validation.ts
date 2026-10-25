import type { LegalCase, Hearing } from '../cases/LegalCase'
import type { FollowUp } from '../followups/FollowUp'
import type { Goal } from '../goals/Goal'
import type { Meeting } from '../meetings/Meeting'
import type { ActionPlan } from '../plans/ActionPlan'
import type { Task } from '../tasks/Task'
import { required, ValidationError } from './errors'
import type { Draft } from './types'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const checkDate = (d: string | undefined, field: string) => {
  if (d !== undefined && !DATE.test(d)) throw new ValidationError(`${field} must be a valid date`)
}
const checkMinute = (m: number | undefined, field: string) => {
  if (m !== undefined && (!Number.isFinite(m) || m < 0 || m >= 1440)) throw new ValidationError(`${field} must be a valid time`)
}
const positive = (n: number, field: string) => {
  if (!Number.isFinite(n) || n <= 0) throw new ValidationError(`${field} must be greater than zero`)
  return Math.round(n)
}

export function normalizeTask(t: Draft<Task>): Draft<Task> {
  checkDate(t.dueDate, 'Due date')
  if (t.slot) checkDate(t.slot.date, 'Planned date')
  return { ...t, title: required(t.title, 'Title'), notes: t.notes?.trim() ?? '', estimate: positive(t.estimate, 'Estimate') }
}

export function normalizeMeeting(m: Draft<Meeting>): Draft<Meeting> {
  checkDate(m.slot.date, 'Date')
  checkMinute(m.slot.start, 'Start time')
  return {
    ...m,
    title: required(m.title, 'Title'),
    slot: { ...m.slot, duration: positive(m.slot.duration, 'Duration') },
    attendees: m.attendees.map((a) => a.trim()).filter(Boolean),
    agenda: m.agenda.filter((a) => a.topic.trim()),
  }
}

export function normalizeFollowUp(f: Draft<FollowUp>): Draft<FollowUp> {
  if (f.due) {
    checkDate(f.due.date, 'Due date')
    checkMinute(f.due.time, 'Time')
  }
  return { ...f, title: required(f.title, 'Title'), duration: positive(f.duration, 'Duration') }
}

export function normalizeCase(c: Draft<LegalCase>): Draft<LegalCase> {
  checkDate(c.filedOn, 'Filed on')
  return {
    ...c,
    reference: required(c.reference, 'Case number'),
    title: required(c.title, 'Title'),
    client: required(c.client, 'Client'),
    court: required(c.court, 'Court'),
  }
}

export function normalizeHearing(h: Draft<Hearing>): Draft<Hearing> {
  checkDate(h.date, 'Hearing date')
  checkMinute(h.time, 'Hearing time')
  return { ...h, purpose: required(h.purpose, 'Purpose'), duration: positive(h.duration, 'Duration') }
}

export function normalizePlan(p: Draft<ActionPlan>): Draft<ActionPlan> {
  checkDate(p.dueDate, 'Due date')
  return { ...p, title: required(p.title, 'Title'), objective: p.objective?.trim() ?? '' }
}

export function normalizeGoal(g: Draft<Goal>): Draft<Goal> {
  checkDate(g.startDate, 'Start date')
  checkDate(g.targetDate, 'Target date')
  if (g.targetDate <= g.startDate) throw new ValidationError('Target date must be after the start date')
  for (const kr of g.keyResults) {
    if (!kr.label.trim()) throw new ValidationError('Each key result needs a label')
    if (kr.target === kr.start) throw new ValidationError(`"${kr.label}" needs a target different from its starting value`)
  }
  return { ...g, title: required(g.title, 'Title'), planIds: [...new Set(g.planIds)] }
}
