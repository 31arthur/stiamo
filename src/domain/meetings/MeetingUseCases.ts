import type { CrudUseCases } from '../shared/CrudUseCases'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID } from '../shared/types'
import { syncConfirmations } from './confirmations'
import type { Meeting } from './Meeting'

/** Saving or deleting a meeting keeps its confirmation follow-ups in step. */
export class MeetingUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly meetings: CrudUseCases<'meeting'>,
    private readonly followUps: CrudUseCases<'followUp'>,
  ) {}

  async save(userId: ID, input: Meeting | Draft<Meeting>): Promise<Meeting> {
    const saved = 'createdAt' in input ? await this.meetings.update(input) : await this.meetings.create(userId, input)
    await this.syncConfirmations(userId, saved)
    return saved
  }

  async remove(userId: ID, id: ID): Promise<void> {
    const all = await this.env.repos.followUp.list(userId)
    const generated = all.filter((f) => f.trigger && f.subject?.kind === 'meeting' && f.subject.id === id && f.outcome.status === 'open')
    for (const f of generated) await this.followUps.remove(userId, f.id)
    await this.meetings.remove(userId, id)
  }

  private async syncConfirmations(userId: ID, meeting: Meeting) {
    const sync = syncConfirmations(meeting, await this.env.repos.followUp.list(userId))
    for (const draft of sync.create) await this.followUps.create(userId, draft)
    for (const f of sync.update) await this.followUps.update(f)
    for (const f of sync.remove) await this.followUps.remove(userId, f.id)
  }
}
