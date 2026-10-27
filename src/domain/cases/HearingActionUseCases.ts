import { stepsOf } from '../plans/ActionPlan'
import type { ActionPlan } from '../plans/ActionPlan'
import type { PlanUseCases } from '../plans/PlanUseCases'
import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError, ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { ID } from '../shared/types'
import { hearingCaseIds } from './LegalCase'
import type { Hearing, HearingAction } from './LegalCase'

/** Turns the work noted on a hearing into tasks, or into an action plan. Each action then follows its task. */
export class HearingActionUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly hearings: CrudUseCases<'hearing'>,
    private readonly tasks: CrudUseCases<'task'>,
    private readonly plans: PlanUseCases,
  ) {}

  /** Makes a task for every action that has none, due by its date (or the next hearing's), filed on the case. */
  async toTasks(userId: ID, hearingId: ID): Promise<Hearing> {
    const hearing = await this.require(userId, hearingId)
    const pending = (hearing.actions ?? []).filter((a) => !a.taskId)
    if (!pending.length) throw new ValidationError('Every action already has a task')
    const next = await this.nextOf(userId, hearing)
    const made = new Map<ID, ID>()
    for (const a of pending) {
      const task = await this.tasks.create(userId, {
        title: a.text,
        notes: `From the hearing of ${hearing.date}`,
        workspace: 'sb',
        priority: 'normal',
        dueDate: a.due ?? next?.date,
        estimate: 45,
        related: { kind: 'case', id: hearing.caseId },
        outcome: { status: 'open' },
      })
      made.set(a.id, task.id)
    }
    return this.hearings.update({ ...hearing, actions: (hearing.actions ?? []).map((a) => (made.has(a.id) ? { ...a, taskId: made.get(a.id) } : a)) })
  }

  /**
   * Starts an action plan from the actions that have no task yet: each becomes a step due by its own
   * date. The plan covers every case the hearing concerned, and the next hearing when it is listed.
   */
  async toPlan(userId: ID, hearingId: ID, title?: string): Promise<ActionPlan> {
    const hearing = await this.require(userId, hearingId)
    const pending = (hearing.actions ?? []).filter((a) => !a.taskId)
    if (!pending.length) throw new ValidationError('Every action already has a task')
    const next = await this.nextOf(userId, hearing)
    const plan = await this.plans.createWithSteps(
      userId,
      {
        title: title?.trim() || `Prepare for ${next?.purpose ?? 'the next hearing'}`,
        objective: '',
        workspace: 'sb',
        status: 'active',
        dueDate: next?.date,
        origin: { kind: 'hearing', id: hearing.id },
        caseIds: hearingCaseIds(hearing),
        hearingIds: next ? [next.id] : undefined,
      },
      pending.map((a) => ({ title: a.text, dueDate: a.due })),
    )
    await this.attachSteps(userId, hearing, plan.id, pending)
    return plan
  }

  /** Records which task was made for which action, in order. */
  async attachSteps(userId: ID, hearing: Hearing, planId: ID, pending: HearingAction[]): Promise<Hearing> {
    const steps = stepsOf(planId, await this.env.repos.task.list(userId))
    const made = new Map(pending.map((a, i) => [a.id, steps[i]?.id]))
    return this.hearings.update({ ...hearing, actions: (hearing.actions ?? []).map((a) => (made.get(a.id) ? { ...a, taskId: made.get(a.id) } : a)) })
  }

  private async nextOf(userId: ID, hearing: Hearing) {
    const next = hearing.nextHearingId ? await this.env.repos.hearing.get(userId, hearing.nextHearingId) : null
    return next && next.outcome.status === 'open' ? next : undefined
  }

  private async require(userId: ID, hearingId: ID): Promise<Hearing> {
    const hearing = await this.env.repos.hearing.get(userId, hearingId)
    if (!hearing) throw new NotFoundError('Hearing')
    return hearing
  }
}
