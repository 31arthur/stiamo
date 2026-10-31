import type { WorkspaceId } from '../shared/workspace'

/** A mailbox connected to a workspace. The password is never sent back. */
export interface MailAccount {
  id: string
  workspace: WorkspaceId
  label: string
  address: string
  host: string
  port: number
  security: 'ssl' | 'starttls'
  username: string
  /** Why the last attempt to reach the server failed, in words for people; empty when it works. */
  error: string
  createdAt: string
}

export interface NewMailAccount {
  workspace: WorkspaceId
  label: string
  address: string
  host: string
  port: number
  security: 'ssl' | 'starttls'
  username: string
  password: string
}

export type MailAccountChanges = Partial<Omit<NewMailAccount, 'address'>>

export type FolderRole = 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | ''

export interface MailFolder {
  /** The server's own name, which is what the other calls take. */
  name: string
  label: string
  role: FolderRole
  unseen: number
  total: number
}

export interface MailPerson {
  name: string
  address: string
}

export interface MailSummary {
  uid: number
  subject: string
  sender: MailPerson
  date: string | null
  snippet: string
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
}

export interface MailPage {
  messages: MailSummary[]
  total: number
  /** Pass as `before` to read further back; null at the start of the mailbox. */
  nextBefore: number | null
  uidValidity: number
}

export interface MailAttachment {
  index: number
  filename: string
  contentType: string
  size: number
}

export interface MailMessage extends Omit<MailSummary, 'snippet' | 'hasAttachments'> {
  to: MailPerson[]
  cc: MailPerson[]
  text: string
  /** Already cleaned by the server; shown in a sandboxed frame. */
  html: string
  hasRemoteContent: boolean
  attachments: MailAttachment[]
  messageId: string
}

/** What the live feed says: its state, and that something in the folder changed (so ask for the list again). */
export type LiveState = 'connecting' | 'live' | 'down' | 'auth'
export type LiveEvent = { type: 'state'; state: LiveState } | { type: 'changed' }

export interface MailApi {
  accounts(): Promise<MailAccount[]>
  connect(account: NewMailAccount): Promise<MailAccount>
  edit(id: string, changes: MailAccountChanges): Promise<MailAccount>
  disconnect(id: string): Promise<void>
  test(id: string): Promise<void>
  folders(accountId: string): Promise<MailFolder[]>
  page(accountId: string, folder: string, opts: { before?: number; q?: string }): Promise<MailPage>
  message(accountId: string, folder: string, uid: number): Promise<MailMessage>
  mark(accountId: string, folder: string, uid: number, flags: { seen?: boolean; flagged?: boolean }): Promise<void>
  download(accountId: string, folder: string, uid: number, attachment: MailAttachment): Promise<Blob>
  /** Opens the live feed for a folder (IMAP IDLE on the server). Reconnects by itself until `signal` is aborted. */
  watch(accountId: string, folder: string, onEvent: (e: LiveEvent) => void, signal: AbortSignal): void
}

/** Ready-made server settings for the common providers. */
export const MAIL_PRESETS = [
  { id: 'gmail', name: 'Gmail', host: 'imap.gmail.com', port: 993, security: 'ssl', hint: 'Use an app password: Google account, Security, 2-step verification, App passwords.' },
  { id: 'outlook', name: 'Outlook / Microsoft 365', host: 'outlook.office365.com', port: 993, security: 'ssl', hint: 'Your organisation must allow IMAP sign-in with a password.' },
  { id: 'zoho', name: 'Zoho', host: 'imap.zoho.com', port: 993, security: 'ssl', hint: 'Use an app-specific password from Zoho security settings.' },
  { id: 'other', name: 'Other', host: '', port: 993, security: 'ssl', hint: 'Your provider IMAP address, usually port 993 with SSL.' },
] as const

const OFFLINE = 'Mail needs the Stiamo backend.'

/** Used when there is no backend to read mail through (offline, Supabase). */
export const NO_MAIL: MailApi = new Proxy({} as MailApi, { get: () => () => Promise.reject(new Error(OFFLINE)) })
