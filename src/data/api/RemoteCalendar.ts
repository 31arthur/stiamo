import type { CalendarApi, CalendarStatus, GoogleEvent, SyncResult } from '@/domain/calendar/GoogleCalendar'
import type { ISODate } from '@/domain/shared/types'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { ApiHttp } from './ApiHttp'

/** Google calendars through the backend's `calendar` service. Google stays the source: events here are a copy refreshed from it. */
export class RemoteCalendar implements CalendarApi {
  constructor(private readonly http: ApiHttp) {}

  status() {
    return this.http.get<CalendarStatus>('/v1/calendar/status')
  }

  start(workspace: WorkspaceId, email?: string) {
    return this.http.post<{ url: string }>('/v1/calendar/oauth/start', { workspace, email })
  }

  async setSource(id: string, changes: { enabled?: boolean; export?: boolean; color?: string }) {
    await this.http.put(`/v1/calendar/sources/${encodeURIComponent(id)}`, changes)
  }

  async disconnect(accountId: string) {
    await this.http.delete(`/v1/calendar/accounts/${encodeURIComponent(accountId)}`)
  }

  events(from: ISODate, to: ISODate) {
    return this.http.get<{ timezone: string; items: GoogleEvent[] }>('/v1/calendar/events', { from, to })
  }

  sync(timezone?: string) {
    return this.http.post<SyncResult>('/v1/calendar/sync', { timezone })
  }
}
