import type { FollowUp } from '../followups/FollowUp'
import type { ISODate } from '../shared/types'
import type { Task } from '../tasks/Task'
import type { Contact } from './Contacts'
import { emailOf, phoneOf } from './dial'

export interface ContactActivity {
  /** Tries to reach them, across every follow-up. */
  tries: number
  /** Of those, the ones that got through. */
  reached: number
  lastReached?: ISODate
  lastTried?: ISODate
  openFollowUps: number
  openTasks: number
  followUps: FollowUp[]
  tasks: Task[]
}

/** The last ten digits of a number, so +91 98765 43210 and 098765 43210 are the same person. */
const tail = (n?: string) => n?.replace(/\D/g, '').slice(-10)

/**
 * What the practice has done with a person: their follow-ups and tasks, and how the calls went. An item belongs to a contact when it points at
 * them (it was picked from their contacts), or when the number or address written on it is theirs. A name alone is never enough to say so.
 */
export function activityOf(contact: Pick<Contact, 'id' | 'phones' | 'emails'>, followUps: FollowUp[], tasks: Task[]): ContactActivity {
  const numbers = new Set(contact.phones.map((p) => tail(p.value)).filter((n): n is string => !!n && n.length >= 7))
  const mails = new Set(contact.emails.map((e) => e.value.toLowerCase()))
  const mine = (x: { contact?: string; contactId?: string }) => {
    if (x.contactId === contact.id) return true
    const n = tail(phoneOf(x.contact))
    const m = emailOf(x.contact)?.toLowerCase()
    return (!!n && numbers.has(n)) || (!!m && mails.has(m))
  }
  const fu = followUps.filter(mine)
  const ts = tasks.filter(mine)
  const attempts = fu.flatMap((f) => f.attempts ?? [])
  const reached = attempts.filter((a) => a.result === 'reached')
  const latest = (dates: ISODate[]) => dates.sort().at(-1)
  return {
    tries: attempts.length,
    reached: reached.length,
    lastReached: latest(reached.map((a) => a.date)),
    lastTried: latest(attempts.map((a) => a.date)),
    openFollowUps: fu.filter((f) => f.outcome.status === 'open').length,
    openTasks: ts.filter((t) => t.outcome.status === 'open').length,
    followUps: fu.sort((a, b) => (b.due?.date ?? '').localeCompare(a.due?.date ?? '')),
    tasks: ts,
  }
}
