import type { ActivityLog } from '../activity/ActivityLog'
import type { MeetingUseCases } from '../meetings/MeetingUseCases'
import { packDay } from '../planner/dayPlan'
import type { Block, PackOptions } from '../planner/dayPlan'
import { clampBlock } from '../planner/dayPlan'
import { NotFoundError, ValidationError } from '../shared/errors'
import type { AnyEntity, DomainEnv } from '../shared/registry'
import type { EntityRef, ID, ISODate } from '../shared/types'
import { buildAgenda } from './agenda'
import type { AgendaEntry } from './agenda'

/** Reads the unified agenda and moves things around on it. Every change returns an undo snapshot. */
export class AgendaUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly meetings: MeetingUseCases,
    private readonly log?: ActivityLog,
  ) {}

  async range(userId: ID, from: ISODate, to: ISODate): Promise<AgendaEntry[]> {
    const { repos } = this.env
    const [tasks, meetings, followUps, hearings, cases] = await Promise.all([
      repos.task.list(userId),
      repos.meeting.list(userId),
      repos.followUp.list(userId),
      repos.hearing.list(userId),
      repos.case.list(userId),
    ])
    return buildAgenda({ tasks, meetings, followUps, hearings, cases }, from, to)
  }

  /** Places an entry at a time on `date`, or clears its time (null). Returns the prior state. */
  async schedule(userId: ID, ref: EntityRef, date: ISODate, block: Block | null): Promise<AnyEntity> {
    const { repos, clock } = this.env
    const now = clock.now().toISOString()
    const b = block && clampBlock(block)

    switch (ref.kind) {
      case 'task': {
        const t = await repos.task.get(userId, ref.id)
        if (!t) throw new NotFoundError('Task')
        const next = {
          ...t,
          slot: b ? { date, ...b } : undefined,
          // Keep it on this day when it's taken off the timeline.
          dueDate: b ? t.dueDate : (t.dueDate ?? date),
          updatedAt: now,
        }
        await repos.task.save(next)
        await this.log?.changed(userId, 'task', t, next)
        return { kind: 'task', entity: t }
      }
      case 'followUp': {
        const f = await repos.followUp.get(userId, ref.id)
        if (!f) throw new NotFoundError('Follow-up')
        const next = { ...f, due: { date, time: b?.start }, duration: b?.duration ?? f.duration, updatedAt: now }
        await repos.followUp.save(next)
        await this.log?.changed(userId, 'followUp', f, next)
        return { kind: 'followUp', entity: f }
      }
      case 'meeting': {
        const m = await repos.meeting.get(userId, ref.id)
        if (!m) throw new NotFoundError('Meeting')
        if (!b) throw new ValidationError('Meetings always have a time')
        await this.meetings.save(userId, { ...m, slot: { date, ...b } })
        return { kind: 'meeting', entity: m }
      }
      default:
        throw new ValidationError('Hearings are set by the court and can’t be moved here')
    }
  }

  /** Re-flows the day (see packDay). Returns the prior state of everything that moved. */
  async reflow(userId: ID, date: ISODate, options: PackOptions): Promise<AnyEntity[]> {
    const placements = packDay(await this.range(userId, date, date), options)
    const before: AnyEntity[] = []
    for (const { entry, slot } of placements) before.push(await this.schedule(userId, entry.ref, date, slot))
    return before
  }

  /** Writes earlier snapshots back (undo). */
  async restore(userId: ID, snapshots: AnyEntity[]): Promise<void> {
    const now = this.env.clock.now().toISOString()
    for (const s of snapshots) {
      if (s.kind === 'meeting') await this.meetings.save(userId, s.entity)
      else await (this.env.repos[s.kind].save as (e: typeof s.entity) => Promise<unknown>)({ ...s.entity, updatedAt: now })
    }
  }
}
