import type { ExecutionItem, LedgerStatus } from '@/domain/ai/AgentApi'

/** The start of a mailbox item as the agent kept it: `From: …`, `Subject: …`, a blank line, then the start of the text. */
export function parseMail(excerpt: string): { from: string; sender: string; subject: string; body: string } {
  const from = /^From:[ \t]*(.*)$/m.exec(excerpt)?.[1]?.trim() ?? ''
  const subject = /^Subject:[ \t]*(.*)$/m.exec(excerpt)?.[1]?.trim() ?? ''
  const body = excerpt.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim()
  const sender = from.replace(/<[^>]*>/, '').trim().replace(/^"|"$/g, '') || from
  return { from, sender, subject, body }
}

/** Where an item's id says its email is: `mailbox:UIDVALIDITY:UID`. */
export function mailRef(id: string): { accountId: string; uid: number } | null {
  const parts = id.split(':')
  const uid = Number(parts[parts.length - 1])
  return parts.length >= 3 && parts[0] && Number.isInteger(uid) ? { accountId: parts[0], uid } : null
}

export interface GroupMeta {
  status: LedgerStatus
  title: string
  hint: string
  /** Waits for a person: can be approved or dismissed here. */
  pending: boolean
}

/** The groups of an execution, in the order a person wants to see them: what needs a look first. */
export const GROUPS: GroupMeta[] = [
  { status: 'needs_review', title: 'Needs review', hint: 'The agent wasn’t sure enough. Choose the right label and approve, or dismiss to leave the email where it is.', pending: true },
  { status: 'proposed', title: 'Waiting to move', hint: 'Sure enough to move to Trash, but waiting for your approval.', pending: true },
  { status: 'event_proposed', title: 'Events to approve', hint: 'Found in an email. Approve them in Attention to add them to the calendar.', pending: false },
  { status: 'queued', title: 'For your attention', hint: 'Read and summarised, waiting in Attention.', pending: false },
  { status: 'done', title: 'Done', hint: 'You dealt with these from Attention.', pending: false },
  { status: 'applied', title: 'Moved to Trash', hint: 'Moved by the agent. They are in the mailbox’s Trash folder, where you can put them back.', pending: false },
  { status: 'approved', title: 'Approved', hint: 'Approved by you.', pending: false },
  { status: 'dismissed', title: 'Dismissed', hint: 'You left these where they were.', pending: false },
  { status: 'kept', title: 'Kept', hint: 'Judged fine: they stay in the inbox.', pending: false },
  { status: 'protected', title: 'Protected', hint: 'Kept by your rules (safe senders, domains, phrases) without being judged.', pending: false },
]

export type SortKey = 'sure-asc' | 'sure-desc' | 'subject' | 'sender'

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'sure-asc', label: 'Least sure first' },
  { key: 'sure-desc', label: 'Most sure first' },
  { key: 'subject', label: 'Subject A–Z' },
  { key: 'sender', label: 'Sender A–Z' },
]

export function sortItems<T extends Pick<ExecutionItem, 'excerpt' | 'title' | 'confidence'>>(items: T[], by: SortKey): T[] {
  const key = (i: T) => (by === 'sender' ? parseMail(i.excerpt).sender : (parseMail(i.excerpt).subject || i.title)).toLowerCase()
  const out = [...items]
  if (by === 'sure-asc') out.sort((a, b) => a.confidence - b.confidence)
  else if (by === 'sure-desc') out.sort((a, b) => b.confidence - a.confidence)
  else out.sort((a, b) => key(a).localeCompare(key(b)))
  return out
}
