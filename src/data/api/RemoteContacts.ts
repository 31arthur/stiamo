import type { Contact, ContactAccount, ContactsApi, ContactsStatus } from '@/domain/contacts/Contacts'
import type { WorkspaceId, WorkspaceScope } from '@/domain/shared/workspace'
import { ApiHttp } from './ApiHttp'

/** Google contacts through the backend's `calendar` service (it holds the Google sign-in). Google stays the source: these are a copy, read again every hour. */
export class RemoteContacts implements ContactsApi {
  constructor(private readonly http: ApiHttp) {}

  status() {
    return this.http.get<ContactsStatus>('/v1/calendar/contacts/status')
  }

  list(scope: WorkspaceScope, q: string, limit: number) {
    return this.http.get<{ items: Contact[]; total: number }>('/v1/calendar/contacts', { workspace: scope === 'all' ? undefined : scope, q: q || undefined, limit })
  }

  start(workspace: WorkspaceId, email?: string) {
    return this.http.post<{ url: string }>('/v1/calendar/contacts/oauth/start', { workspace, email })
  }

  link(accountId: string, workspace: WorkspaceId) {
    return this.http.post<ContactAccount>(`/v1/calendar/contacts/accounts/${encodeURIComponent(accountId)}/link`, { workspace })
  }

  sync(accountId?: string) {
    return this.http.post<{ contacts: number; problems: string[] }>('/v1/calendar/contacts/sync', { accountId })
  }

  async unlink(accountId: string) {
    await this.http.delete(`/v1/calendar/contacts/accounts/${encodeURIComponent(accountId)}`)
  }
}
