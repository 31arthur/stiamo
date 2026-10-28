import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import { minutesOf, toISODate } from '../shared/time'
import type { ID, ISODate, Minutes } from '../shared/types'
import { bestMinute, suggestRetry } from './chase'
import type { RetrySuggestion } from './chase'
import type { Attempt, AttemptResult, FollowUp, FollowUpChannel } from './FollowUp'

export interface AttemptInput {
  result: AttemptResult
  note?: string
  /** For "said call later": the time they asked for. */
  callBackAt?: Minutes
  /** For "not done yet": the day they promised it for. */
  promisedFor?: ISODate
  /** Overrides the suggested next try; `null` leaves the follow-up without a date. */
  next?: { date: ISODate; time?: Minutes } | null
  /** Carry on by another channel from here. */
  switchTo?: FollowUpChannel
}

export interface AttemptLogged {
  followUp: FollowUp
  /** The record as it was before, to put back if this was a slip. */
  before: FollowUp
  suggestion: RetrySuggestion | null
}

/**
 * A follow-up is a chase: it stays open through every try, each try is written down, and the next one
 * is set for you from how the last went — until someone is reached and it is done.
 */
export class FollowUpUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly followUps: CrudUseCases<'followUp'>,
  ) {}

  /** What the next try would be if this result were logged now. */
  async suggest(userId: ID, id: ID, input: Pick<AttemptInput, 'result' | 'callBackAt' | 'promisedFor'>): Promise<RetrySuggestion | null> {
    const f = await this.require(userId, id)
    return this.suggestion(userId, f, input)
  }

  async logAttempt(userId: ID, id: ID, input: AttemptInput): Promise<AttemptLogged> {
    const before = await this.require(userId, id)
    const now = this.env.clock.now()
    const attempt: Attempt = {
      date: toISODate(now),
      minute: minutesOf(now),
      result: input.result,
      channel: before.channel,
      note: input.note?.trim() || undefined,
      promisedFor: input.result === 'not_ready' ? input.promisedFor : undefined,
    }
    const suggestion = await this.suggestion(userId, before, input)
    const attempts = [...(before.attempts ?? []), attempt]

    let due = before.due
    if (input.result === 'reached') due = before.due
    else if (input.result === 'unreachable') due = undefined
    else if (input.next !== undefined) due = input.next ? { date: input.next.date, time: input.next.time } : undefined
    else if (suggestion) due = { date: suggestion.date, time: suggestion.time }

    const next: FollowUp = {
      ...before,
      attempts,
      due,
      channel: input.switchTo ?? before.channel,
      outcome:
        input.result === 'reached'
          ? { status: 'done', comment: attempt.note ?? before.outcome.comment, recordedAt: now.toISOString() }
          : before.outcome,
    }
    const followUp = await this.followUps.update(next)
    return { followUp, before, suggestion }
  }

  /** Puts a follow-up back as it was (the undo for a try logged by mistake). */
  restore(before: FollowUp): Promise<FollowUp> {
    return this.followUps.update(before)
  }

  private async suggestion(userId: ID, f: FollowUp, input: Pick<AttemptInput, 'result' | 'callBackAt' | 'promisedFor'>) {
    const now = this.env.clock.now()
    const mine = await this.env.repos.followUp.list(userId)
    return suggestRetry(f.attempts ?? [], input.result, { date: toISODate(now), minute: minutesOf(now) }, { callBackAt: input.callBackAt, promisedFor: input.promisedFor, bestMinute: bestMinute(f.contact, mine) })
  }

  private async require(userId: ID, id: ID): Promise<FollowUp> {
    const f = await this.env.repos.followUp.get(userId, id)
    if (!f) throw new NotFoundError('Follow-up')
    return f
  }
}
