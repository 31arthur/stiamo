import type { Meeting } from '../meetings/Meeting'
import type { Entity, EntityRef, ID, ISODate } from '../shared/types'
import type { Task } from '../tasks/Task'

export type ClientKind = 'company' | 'individual'
export type ClientStatus = 'prospect' | 'active' | 'past'

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = { company: 'Company', individual: 'Individual' }
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = { prospect: 'Prospect', active: 'Active', past: 'Past' }

/** Someone FSA does work for: the people you meet with and the projects hang off. */
export interface Client extends Entity {
  kind: ClientKind
  name: string
  /** The person you deal with, for a company. */
  contactName?: string
  phone?: string
  email?: string
  website?: string
  status: ClientStatus
  notes: string
}

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** A piece of work for a client. Its meetings, tasks and documents are what the project is made of. */
export interface Project extends Entity {
  title: string
  clientId: ID
  status: ProjectStatus
  description: string
  startDate?: ISODate
  dueDate?: ISODate
}

/** The order projects read in: what's being worked on first, finished work last. */
export const projectRank = (p: Pick<Project, 'status'>) => ['active', 'planned', 'on_hold', 'completed', 'cancelled'].indexOf(p.status)

export const isOngoing = (p: Pick<Project, 'status'>) => p.status === 'planned' || p.status === 'active' || p.status === 'on_hold'

const key = (r: EntityRef | undefined) => (r ? `${r.kind}:${r.id}` : '')

/**
 * Meetings, appointments and tasks are tied to a client or a project through `related`. A client's
 * own work is everything pointing at the client or at any of its projects.
 */
export function clientRefKeys(clientId: ID, projects: Project[]): Set<string> {
  return new Set([key({ kind: 'client', id: clientId }), ...projects.filter((p) => p.clientId === clientId).map((p) => key({ kind: 'project', id: p.id }))])
}

export const meetingsFor = (keys: Set<string>, meetings: Meeting[]): Meeting[] =>
  meetings.filter((m) => keys.has(key(m.related))).sort((a, b) => `${b.slot.date}${String(b.slot.start).padStart(4, '0')}`.localeCompare(`${a.slot.date}${String(a.slot.start).padStart(4, '0')}`))

export const tasksFor = (keys: Set<string>, tasks: Task[]): Task[] => tasks.filter((t) => keys.has(key(t.related)))

/** The client a reference points at, directly or through its project. */
export function clientOf(ref: EntityRef | undefined, projects: Project[]): ID | undefined {
  if (!ref) return undefined
  if (ref.kind === 'client') return ref.id
  if (ref.kind === 'project') return projects.find((p) => p.id === ref.id)?.clientId
  return undefined
}
