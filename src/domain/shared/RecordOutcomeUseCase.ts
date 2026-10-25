import type { MeetingUseCases } from '../meetings/MeetingUseCases'
import type { CrudUseCases } from './CrudUseCases'
import { NotFoundError, required } from './errors'
import type { Outcome } from './outcome'
import type { DomainEnv } from './registry'
import type { EntityRef, ID, ISODate, Minutes } from './types'
import type { WorkspaceId } from './workspace'

export type OutcomeTarget = 'task' | 'followUp' | 'meeting' | 'hearing'

/** A further action to create while recording an outcome. */
export interface SpawnRequest {
  kind: 'task' | 'followUp'
  title: string
  date: ISODate
  time?: Minutes
}

/**
 * Records how something turned out — done, partly done, not done or cancelled — with a comment and
 * an optional further action, which can be created right away as a linked task or follow-up.
 */
export class RecordOutcomeUseCase {
  constructor(
    private readonly env: DomainEnv,
    private readonly tasks: CrudUseCases<'task'>,
    private readonly followUps: CrudUseCases<'followUp'>,
    private readonly meetings: MeetingUseCases,
  ) {}

  async execute(userId: ID, ref: { kind: OutcomeTarget; id: ID }, outcome: Outcome, spawn?: SpawnRequest): Promise<{ spawned?: EntityRef }> {
    const recorded: Outcome = {
      status: outcome.status,
      comment: outcome.comment?.trim() || undefined,
      nextAction: outcome.nextAction?.trim() || undefined,
      recordedAt: outcome.status === 'open' ? undefined : this.env.clock.now().toISOString(),
    }

    let workspace: WorkspaceId = 'personal'
    let planId: ID | undefined
    let contact: string | undefined

    switch (ref.kind) {
      case 'task': {
        const t = await this.require(this.env.repos.task.get(userId, ref.id), 'Task')
        await this.tasks.update({ ...t, outcome: recorded })
        ;({ workspace, planId } = t)
        break
      }
      case 'followUp': {
        const f = await this.require(this.env.repos.followUp.get(userId, ref.id), 'Follow-up')
        await this.followUps.update({ ...f, outcome: recorded })
        ;({ workspace, contact } = f)
        break
      }
      case 'meeting': {
        const m = await this.require(this.env.repos.meeting.get(userId, ref.id), 'Meeting')
        await this.meetings.save(userId, { ...m, outcome: recorded })
        ;({ workspace } = m)
        contact = m.contact || m.counterpart
        planId = m.prepPlanId
        break
      }
      case 'hearing': {
        const h = await this.require(this.env.repos.hearing.get(userId, ref.id), 'Hearing')
        await this.env.repos.hearing.save({ ...h, outcome: recorded, updatedAt: this.env.clock.now().toISOString() })
        workspace = 'sb'
        break
      }
    }

    if (!spawn) return {}
    const title = required(spawn.title, 'Further action')
    if (spawn.kind === 'task') {
      const task = await this.tasks.create(userId, {
        title,
        notes: recorded.comment ?? '',
        workspace,
        priority: 'normal',
        dueDate: spawn.date,
        estimate: 30,
        planId,
        related: ref,
        outcome: { status: 'open' },
      })
      return { spawned: { kind: 'task', id: task.id } }
    }
    const followUp = await this.followUps.create(userId, {
      title,
      channel: 'call',
      workspace,
      contact,
      due: { date: spawn.date, time: spawn.time },
      duration: 15,
      subject: ref,
      notes: recorded.comment,
      outcome: { status: 'open' },
    })
    return { spawned: { kind: 'followUp', id: followUp.id } }
  }

  private async require<T>(p: Promise<T | null>, what: string): Promise<T> {
    const value = await p
    if (!value) throw new NotFoundError(what)
    return value
  }
}
