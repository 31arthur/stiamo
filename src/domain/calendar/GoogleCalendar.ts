import type { ISODate } from '../shared/types'
import type { WorkspaceId } from '../shared/workspace'

/** One calendar inside a Google account: the main one, a shared team calendar, holidays… */
export interface CalendarSource {
  id: string
  name: string
  color: string
  /** owner, writer, reader or freeBusyReader. */
  role: string
  /** Stiamo can add to it. */
  writable: boolean
  /** Its events are shown in Stiamo. */
  enabled: boolean
  /** This workspace's meetings and hearings are sent here. */
  export: boolean
}

/** A Google account connected to one workspace. */
export interface CalendarAccount {
  id: string
  workspace: WorkspaceId
  email: string
  /** `ok`, or `reconnect` when Google no longer accepts the access. */
  status: 'ok' | 'reconnect'
  error: string
  lastSyncAt: string | null
  calendars: CalendarSource[]
}

export interface CalendarStatus {
  /** The server has a Google OAuth client, so accounts can be connected. */
  configured: boolean
  /** The server can send meetings and hearings to Google. */
  sends: boolean
  timezone: string
  accounts: CalendarAccount[]
}

/** An event from Google, on the person's own clock. */
export interface GoogleEvent {
  id: string
  sourceId: string
  title: string
  location: string
  allDay: boolean
  /** First day, and last day (inclusive) when it runs over several. */
  date: ISODate
  endDate: ISODate
  /** Minutes after midnight; absent for an all-day event. */
  startMinute?: number
  endMinute?: number
  link: string
  meet: string
  attendees: number
  workspace: WorkspaceId
  color: string
  calendar: string
  account: string
}

export interface SyncResult {
  pulled: number
  sent: { added: number; changed: number; removed: number }
  errors: string[]
}

export interface CalendarApi {
  status(): Promise<CalendarStatus>
  /** Where to send the browser so the person can allow access to a Google account. */
  start(workspace: WorkspaceId, email?: string): Promise<{ url: string }>
  setSource(id: string, changes: { enabled?: boolean; export?: boolean; color?: string }): Promise<void>
  disconnect(accountId: string): Promise<void>
  events(from: ISODate, to: ISODate): Promise<{ timezone: string; items: GoogleEvent[] }>
  sync(timezone?: string): Promise<SyncResult>
}

const OFFLINE = 'Google calendars need the Stiamo backend.'

/** Used when there is no backend to read calendars through (offline, Supabase). */
export const NO_CALENDAR: CalendarApi = new Proxy({} as CalendarApi, { get: () => () => Promise.reject(new Error(OFFLINE)) })

/** What a day shows from Google: the events on it, all-day ones first and the rest in time order. */
export function googleOn(events: GoogleEvent[], day: ISODate): GoogleEvent[] {
  return events.filter((e) => e.date <= day && day <= e.endDate).sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || (a.startMinute ?? 0) - (b.startMinute ?? 0) || a.title.localeCompare(b.title))
}
