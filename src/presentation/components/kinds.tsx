import { Briefcase, Building2, CalendarClock, CheckSquare, FolderKanban, Gavel, ListChecks, PhoneCall, Scale, Target, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import type { MeetingKind } from '@/domain/meetings/Meeting'
import type { EntityKind } from '@/domain/shared/types'

export const KIND_META: Record<EntityKind, { label: string; plural: string; icon: LucideIcon; path: string }> = {
  task: { label: 'Task', plural: 'Tasks', icon: CheckSquare, path: '/tasks' },
  meeting: { label: 'Meeting', plural: 'Meetings', icon: Users, path: '/meetings' },
  followUp: { label: 'Follow-up', plural: 'Follow-ups', icon: PhoneCall, path: '/follow-ups' },
  case: { label: 'Case', plural: 'Cases', icon: Scale, path: '/cases' },
  hearing: { label: 'Hearing', plural: 'Hearings', icon: Gavel, path: '/cases' },
  plan: { label: 'Action plan', plural: 'Action plans', icon: ListChecks, path: '/plans' },
  goal: { label: 'Goal', plural: 'Goals', icon: Target, path: '/goals' },
  counsel: { label: 'Counsel', plural: 'Counsel', icon: Briefcase, path: '/counsel' },
  client: { label: 'Client', plural: 'Clients', icon: Building2, path: '/clients' },
  project: { label: 'Project', plural: 'Projects', icon: FolderKanban, path: '/projects' },
}

export const MEETING_KIND_ICON: Record<MeetingKind, LucideIcon> = { appointment: CalendarClock, meeting: Users }

export function entryIcon(e: Pick<AgendaEntry, 'kind' | 'meetingKind'>): LucideIcon {
  if (e.kind === 'meeting' && e.meetingKind) return MEETING_KIND_ICON[e.meetingKind]
  return KIND_META[e.kind].icon
}

export function entryLabel(e: Pick<AgendaEntry, 'kind' | 'meetingKind'>): string {
  if (e.kind === 'meeting') return e.meetingKind === 'appointment' ? 'Appointment' : 'Meeting'
  return KIND_META[e.kind].label
}
