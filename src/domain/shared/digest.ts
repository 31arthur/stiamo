import { addDays, format, parseISO } from 'date-fns'
import { nextHearing, unrecordedHearings } from '../cases/LegalCase'
import type { Hearing, LegalCase } from '../cases/LegalCase'
import { isOngoing } from '../clients/Client'
import type { Client, Project } from '../clients/Client'
import type { FollowUp } from '../followups/FollowUp'
import type { Goal } from '../goals/Goal'
import type { Meeting } from '../meetings/Meeting'
import { isOverdue } from '../tasks/Task'
import type { Task } from '../tasks/Task'
import type { ISODate } from './types'
import type { WorkspaceId } from './workspace'
import { WORKSPACE_IDS } from './workspace'

export interface DigestStat {
  label: string
  value: number
  tone?: 'danger' | 'warning' | 'success'
}

/** The one thing coming up next in a workspace, and where to go for it. */
export interface DigestNext {
  label: string
  detail: string
  to: string
}

/** A workspace in a few numbers: what is slipping, what is busy, and what is next. */
export interface WorkspaceDigest {
  id: WorkspaceId
  stats: DigestStat[]
  next?: DigestNext
  /** Where the workspace's own work starts. */
  to: string
}

export interface DigestInput {
  tasks: Task[]
  followUps: FollowUp[]
  meetings: Meeting[]
  cases: LegalCase[]
  hearings: Hearing[]
  clients: Client[]
  projects: Project[]
  goals: Goal[]
}

const inDays = (today: ISODate, n: number) => format(addDays(parseISO(today), n), 'yyyy-MM-dd')

/** Bite-sized figures for every workspace, so the "all workspaces" view can show what matters from each. */
export function buildDigests(input: DigestInput, today: ISODate): WorkspaceDigest[] {
  const week = inDays(today, 7)
  const common = (ws: WorkspaceId): DigestStat[] => {
    const tasks = input.tasks.filter((t) => t.workspace === ws && t.outcome.status === 'open')
    const overdue = tasks.filter((t) => isOverdue(t, today)).length
    const chase = input.followUps.filter((f) => f.workspace === ws && f.outcome.status === 'open' && !!f.due && f.due.date <= today).length
    const meetings = input.meetings.filter((m) => m.workspace === ws && m.outcome.status === 'open' && m.slot.date >= today && m.slot.date <= week).length
    return [
      { label: 'Open tasks', value: tasks.length, ...(overdue ? { tone: 'danger' as const } : {}) },
      { label: 'Overdue', value: overdue, ...(overdue ? { tone: 'danger' as const } : { tone: 'success' as const }) },
      { label: 'To chase', value: chase, ...(chase ? { tone: 'warning' as const } : {}) },
      { label: 'Meetings this week', value: meetings },
    ]
  }

  return WORKSPACE_IDS.map((id): WorkspaceDigest => {
    if (id === 'sb') {
      const active = input.cases.filter((c) => c.status === 'active')
      const toWrite = unrecordedHearings(input.hearings, today).length
      const soon = input.hearings.filter((h) => h.outcome.status === 'open' && h.date >= today && h.date <= week).length
      const upcoming = active
        .map((c) => ({ c, h: nextHearing(c.id, input.hearings, today) }))
        .filter((x): x is { c: LegalCase; h: Hearing } => !!x.h)
        .sort((a, b) => a.h.date.localeCompare(b.h.date))[0]
      return {
        id,
        to: '/cases',
        stats: [
          { label: 'Active cases', value: active.length },
          { label: 'Hearings in 7 days', value: soon, ...(soon ? { tone: 'warning' as const } : {}) },
          { label: 'Hearings to write up', value: toWrite, tone: toWrite ? 'danger' : 'success' },
          ...common(id).slice(2, 3),
        ],
        next: upcoming && { label: upcoming.c.title, detail: `${upcoming.h.purpose || 'Hearing'} · ${format(parseISO(upcoming.h.date), 'EEE d MMM')}`, to: `/cases/${upcoming.c.id}` },
      }
    }
    if (id === 'fsa') {
      const ongoing = input.projects.filter(isOngoing)
      const late = ongoing.filter((p) => p.dueDate && p.dueDate < today).length
      const due = ongoing.filter((p) => p.dueDate && p.dueDate >= today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0]
      return {
        id,
        to: '/projects',
        stats: [
          { label: 'Projects underway', value: ongoing.length },
          { label: 'Past their date', value: late, tone: late ? 'danger' : 'success' },
          { label: 'Active clients', value: input.clients.filter((c) => c.status === 'active').length },
          ...common(id).slice(0, 1),
        ],
        next: due && { label: due.title, detail: `Due ${format(parseISO(due.dueDate!), 'EEE d MMM')}`, to: `/projects/${due.id}` },
      }
    }
    const stats = common(id)
    if (id === 'personal') stats.push({ label: 'Goals under way', value: input.goals.filter((g) => g.status === 'active' && (g.workspace ?? 'personal') === 'personal').length })
    return { id, to: '/tasks', stats }
  })
}
