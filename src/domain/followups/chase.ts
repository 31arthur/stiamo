import { formatClock, shiftDate } from '../shared/time'
import type { ISODate, Minutes } from '../shared/types'
import type { Attempt, AttemptResult, FollowUp, FollowUpChannel } from './FollowUp'

/** What happened when you tried: the handful of ways a call actually goes. */
export const ATTEMPT_RESULTS: Record<AttemptResult, { label: string; hint: string }> = {
  no_answer: { label: 'No answer', hint: 'Rang out, busy or switched off' },
  left_message: { label: 'Left a message', hint: 'Voicemail or told someone else' },
  call_back: { label: 'Said call later', hint: 'They asked me to try again' },
  they_will_call: { label: 'Will call me', hint: 'The ball is in their court' },
  not_ready: { label: 'Not done yet', hint: 'Spoke — still waiting on something' },
  reached: { label: 'Reached — done', hint: 'Sorted; close this follow-up' },
  unreachable: { label: 'Wrong number', hint: 'Number dead or not theirs' },
}

export const RESULT_ORDER: AttemptResult[] = ['no_answer', 'left_message', 'call_back', 'they_will_call', 'not_ready', 'reached', 'unreachable']

/** Wording follows the channel: nobody "answers" an email. */
export function attemptLabel(result: AttemptResult, channel: FollowUpChannel = 'call'): string {
  if (channel === 'call') return ATTEMPT_RESULTS[result].label
  const other: Partial<Record<AttemptResult, string>> = {
    no_answer: channel === 'visit' ? 'Not there' : 'No reply',
    left_message: channel === 'visit' ? 'Left a note' : 'Sent again',
    call_back: 'Said later',
    they_will_call: 'Will get back to me',
    unreachable: channel === 'visit' ? 'Wrong place' : 'Wrong address',
  }
  return other[result] ?? ATTEMPT_RESULTS[result].label
}

const MISSES: AttemptResult[] = ['no_answer', 'left_message']
const isMiss = (r: AttemptResult) => MISSES.includes(r)
const roundUp = (m: Minutes) => Math.ceil(m / 15) * 15
const DAY_END = 18 * 60

export interface RetrySuggestion {
  date: ISODate
  time?: Minutes
  /** Why this moment, in a few words. */
  reason: string
  /** Enough calls have failed that another channel is the better bet. */
  switchChannel?: boolean
}

/** Consecutive tries without anyone picking up, ending at the latest. */
export function missStreak(attempts: Attempt[]): number {
  let n = 0
  for (let i = attempts.length - 1; i >= 0 && isMiss(attempts[i].result); i--) n++
  return n
}

/** The time of day this contact last actually picked up, if they ever have. */
export function bestMinute(contact: string | undefined, followUps: FollowUp[]): Minutes | undefined {
  const who = contact?.trim().toLowerCase()
  if (!who) return undefined
  const connected = followUps
    .filter((f) => f.contact?.trim().toLowerCase() === who)
    .flatMap((f) => f.attempts ?? [])
    .filter((a) => a.result === 'reached' || a.result === 'not_ready')
    .sort((a, b) => `${a.date}${String(a.minute).padStart(4, '0')}`.localeCompare(`${b.date}${String(b.minute).padStart(4, '0')}`))
  const last = connected[connected.length - 1]
  return last && Math.round(last.minute / 15) * 15
}

export interface RetryHints {
  /** The time they asked to be called back at. */
  callBackAt?: Minutes
  /** The day they promised it for. */
  promisedFor?: ISODate
  /** When this contact has picked up before. */
  bestMinute?: Minutes
}

/**
 * When to try next, given how it went. Misses back off and move around the day: later today, then
 * a different time tomorrow, then two days on, and after four the advice is to switch channel.
 * What the person said (a time to call back, a day they promised) always wins over the pattern.
 * `before` is the history without this attempt; returns null when nothing more is to be scheduled.
 */
export function suggestRetry(before: Attempt[], result: AttemptResult, now: { date: ISODate; minute: Minutes }, hints: RetryHints = {}): RetrySuggestion | null {
  switch (result) {
    case 'reached':
    case 'unreachable':
      return null
    case 'call_back': {
      const asked = hints.callBackAt
      if (asked === undefined) return later(now, 120, 'Two hours on, as they asked')
      return asked > now.minute ? { date: now.date, time: asked, reason: 'The time they asked for' } : { date: shiftDate(now.date, 1), time: asked, reason: 'That time has passed — same time tomorrow' }
    }
    case 'they_will_call':
      return { date: shiftDate(now.date, 2), reason: 'Chase them if they haven’t called by then' }
    case 'not_ready':
      return hints.promisedFor ? { date: hints.promisedFor, reason: 'The day they promised' } : { date: shiftDate(now.date, 2), reason: 'Two days to get it done' }
  }

  const failed = [...before, { date: now.date, minute: now.minute, result }].filter((a) => isMiss(a.result))
  const streak = missStreak([...before, { date: now.date, minute: now.minute, result } as Attempt])
  if (streak <= 1) return later(now, 120, 'Later today — a second try often connects')
  if (streak === 2) {
    const mean = failed.reduce((s, a) => s + a.minute, 0) / failed.length
    const time = hints.bestMinute ?? (mean < 13 * 60 ? 17 * 60 : 10 * 60 + 30)
    return { date: shiftDate(now.date, 1), time, reason: hints.bestMinute !== undefined ? 'Tomorrow, when they last picked up' : 'Tomorrow, at a different time of day' }
  }
  if (streak === 3) return { date: shiftDate(now.date, 2), time: hints.bestMinute ?? 11 * 60, reason: 'Two days on — or send a message first', switchChannel: true }
  return { date: shiftDate(now.date, 3), time: hints.bestMinute ?? 11 * 60, reason: `${streak} tries without luck — a message may land better`, switchChannel: true }
}

function later(now: { date: ISODate; minute: Minutes }, delta: Minutes, reason: string): RetrySuggestion {
  const minute = roundUp(now.minute + delta)
  if (minute > DAY_END) return { date: shiftDate(now.date, 1), time: 10 * 60, reason: 'Too late today — first thing tomorrow' }
  return { date: now.date, time: minute, reason }
}

export type ChaseKind = 'fresh' | 'chasing' | 'waiting' | 'promised' | 'stalled' | 'unreachable'

export interface Chase {
  kind: ChaseKind
  tries: number
  misses: number
  last?: Attempt
  promisedFor?: ISODate
}

/** Where a follow-up stands as a chase, worked out from its call log. */
export function chaseOf(f: Pick<FollowUp, 'attempts'>): Chase {
  const attempts = f.attempts ?? []
  const last = attempts[attempts.length - 1]
  const misses = missStreak(attempts)
  const base = { tries: attempts.length, misses, last }
  if (!last) return { ...base, kind: 'fresh' }
  if (last.result === 'unreachable') return { ...base, kind: 'unreachable' }
  if (last.result === 'they_will_call') return { ...base, kind: 'waiting' }
  if (last.result === 'not_ready') return { ...base, kind: 'promised', promisedFor: last.promisedFor }
  if (misses >= 3) return { ...base, kind: 'stalled' }
  return { ...base, kind: 'chasing' }
}

/** One line for a list row: "3 tries · last: No answer, yesterday". */
export function chaseLine(f: Pick<FollowUp, 'attempts' | 'channel'>, today: ISODate): string | undefined {
  const c = chaseOf(f)
  if (!c.last) return undefined
  const when = c.last.date === today ? 'today' : c.last.date === shiftDate(today, -1) ? 'yesterday' : c.last.date
  return `${c.tries} ${c.tries === 1 ? 'try' : 'tries'} · last: ${attemptLabel(c.last.result, c.last.channel ?? f.channel)}, ${when} ${formatClock(c.last.minute)}`
}
