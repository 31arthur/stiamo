import type { WorkspaceId, WorkspaceScope } from '../shared/workspace'

export interface ContactChannel {
  value: string
  /** work, mobile, home… as Google labels it; may be empty. */
  label: string
}

/** A person from a Google address book, in one workspace (or every workspace they are in, when looking at all of them). */
export interface Contact {
  id: string
  name: string
  organisation: string
  title: string
  emails: ContactChannel[]
  phones: ContactChannel[]
  notes: string
  photo: string
  /** The workspaces this contact is in. */
  workspaces: WorkspaceId[]
  /** The Google accounts it comes from. */
  accounts: string[]
}

/** A Google account linked to one workspace for its contacts. The same account can be linked to several workspaces; a workspace can have several accounts. */
export interface ContactAccount {
  id: string
  workspace: WorkspaceId
  email: string
  /** `ok`, or `reconnect` when Google no longer accepts the access. */
  status: 'ok' | 'reconnect'
  error: string
  contacts: number
  lastSyncAt: string | null
}

export interface ContactsStatus {
  /** The server has a Google OAuth client, so accounts can be linked. */
  configured: boolean
  accounts: ContactAccount[]
}

export interface ContactsApi {
  status(): Promise<ContactsStatus>
  /** One workspace's contacts, or everyone's together; sorted by name. */
  list(scope: WorkspaceScope, q: string, limit: number): Promise<{ items: Contact[]; total: number }>
  /** Where to send the person to let Stiamo read a Google account's contacts. */
  start(workspace: WorkspaceId, email?: string): Promise<{ url: string }>
  /** The same Google account in another workspace too: no new sign-in. */
  link(accountId: string, workspace: WorkspaceId): Promise<ContactAccount>
  /** Reads the contacts again, for one account link or all of them. */
  sync(accountId?: string): Promise<{ contacts: number; problems: string[] }>
  unlink(accountId: string): Promise<void>
}

const OFFLINE = 'Google contacts need the Stiamo backend.'

/** Used when there is no backend to read contacts through (offline, Supabase). */
export const NO_CONTACTS: ContactsApi = new Proxy({} as ContactsApi, { get: () => () => Promise.reject(new Error(OFFLINE)) })

/** Up to two letters to stand in for a photo. */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'
