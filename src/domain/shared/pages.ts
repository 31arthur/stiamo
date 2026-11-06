import type { WorkspaceId, WorkspaceScope } from './workspace'
import { WORKSPACE_IDS } from './workspace'

/** The pages every workspace has by default and can switch off for itself. */
export const TOGGLEABLE_PAGES = [
  { id: 'today', label: 'Today', hint: 'The day at a glance' },
  { id: 'calendar', label: 'Calendar', hint: 'Meetings, hearings and due dates' },
  { id: 'mail', label: 'Mail', hint: 'The workspace’s mailboxes' },
  { id: 'contacts', label: 'Contacts', hint: 'Google contacts' },
  { id: 'tasks', label: 'Tasks', hint: '' },
  { id: 'follow-ups', label: 'Follow-ups', hint: '' },
  { id: 'meetings', label: 'Meetings', hint: '' },
  { id: 'plans', label: 'Action plans', hint: '' },
  { id: 'goals', label: 'Goals', hint: '' },
] as const

export type PageId = (typeof TOGGLEABLE_PAGES)[number]['id']

export const PAGE_IDS = TOGGLEABLE_PAGES.map((p) => p.id) as PageId[]

/** What is switched off, per workspace. Everything is on until it is switched off. */
export type HiddenPages = Partial<Record<WorkspaceId, PageId[]>>

export const isPage = (section: string): section is PageId => (PAGE_IDS as string[]).includes(section)

/** Whether a page is on. "All workspaces" shows a page when at least one workspace has it. */
export function pageEnabled(hidden: HiddenPages, scope: WorkspaceScope, page: string): boolean {
  if (!isPage(page)) return true
  if (scope === 'all') return WORKSPACE_IDS.some((ws) => !hidden[ws]?.includes(page))
  return !hidden[scope]?.includes(page)
}

/** The workspaces that have a page on. */
export const workspacesWith = (hidden: HiddenPages, page: PageId): WorkspaceId[] => WORKSPACE_IDS.filter((ws) => !hidden[ws]?.includes(page))

/** Where to send someone who followed a link to a page that is off here: the first page that is on. */
export function firstEnabled(hidden: HiddenPages, scope: WorkspaceScope): string {
  return PAGE_IDS.find((p) => pageEnabled(hidden, scope, p)) ?? 'agents'
}
