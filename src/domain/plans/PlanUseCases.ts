import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID, RichDoc } from '../shared/types'
import type { ActivityLog } from '../activity/ActivityLog'
import { stepsOf } from './ActionPlan'
import type { ActionPlan } from './ActionPlan'
import type { Task } from '../tasks/Task'

export class PlanUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly plans: CrudUseCases<'plan'>,
    private readonly tasks: CrudUseCases<'task'>,
    private readonly goals: CrudUseCases<'goal'>,
    private readonly log?: ActivityLog,
  ) {}

  /** Creates a plan, its steps as tasks, and links it to the given goals. */
  async createWithSteps(userId: ID, draft: Draft<ActionPlan>, steps: string[], goalIds: ID[] = []): Promise<ActionPlan> {
    const plan = await this.plans.create(userId, draft)
    let order = 0
    for (const title of steps.map((s) => s.trim()).filter(Boolean)) {
      await this.tasks.create(userId, {
        title,
        notes: '',
        workspace: plan.workspace,
        priority: 'normal',
        dueDate: plan.dueDate,
        estimate: 45,
        planId: plan.id,
        order: order++,
        related: plan.origin,
        outcome: { status: 'open' },
      })
    }
    for (const goalId of goalIds) await this.link(userId, plan.id, goalId)
    return plan
  }

  async addStep(userId: ID, planId: ID, title: string): Promise<Task> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const steps = stepsOf(planId, await this.env.repos.task.list(userId))
    return this.tasks.create(userId, {
      title,
      notes: '',
      workspace: plan.workspace,
      priority: 'normal',
      dueDate: plan.dueDate,
      estimate: 45,
      planId,
      order: steps.length ? Math.max(...steps.map((s) => s.order ?? 0)) + 1 : 0,
      outcome: { status: 'open' },
    })
  }

  /**
   * Saves the plan's page content. `firstEditOfSession` writes a single "page edited" line to the
   * history; autosaves after that stay quiet so the thread isn't flooded.
   */
  async saveDoc(userId: ID, planId: ID, doc: RichDoc, firstEditOfSession: boolean): Promise<void> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    await this.env.repos.plan.save({ ...plan, doc, updatedAt: this.env.clock.now().toISOString() })
    if (firstEditOfSession) await this.log?.record(userId, { ref: { kind: 'plan', id: planId }, title: plan.title, action: 'updated', summary: 'Edited the plan page' })
  }

  /** Persists a new step order. */
  async reorderSteps(userId: ID, planId: ID, orderedTaskIds: ID[]): Promise<void> {
    const tasks = (await this.env.repos.task.list(userId)).filter((t) => t.planId === planId)
    const position = new Map(orderedTaskIds.map((id, i) => [id, i]))
    const now = this.env.clock.now().toISOString()
    await this.env.repos.task.saveMany(
      tasks.filter((t) => position.has(t.id)).map((t) => ({ ...t, order: position.get(t.id)!, updatedAt: now })),
    )
  }

  async link(userId: ID, planId: ID, goalId: ID): Promise<void> {
    const goal = await this.env.repos.goal.get(userId, goalId)
    if (!goal) throw new NotFoundError('Goal')
    if (!goal.planIds.includes(planId)) await this.goals.update({ ...goal, planIds: [...goal.planIds, planId] })
  }

  async unlink(userId: ID, planId: ID, goalId: ID): Promise<void> {
    const goal = await this.env.repos.goal.get(userId, goalId)
    if (goal) await this.goals.update({ ...goal, planIds: goal.planIds.filter((id) => id !== planId) })
  }

  /** Deletes a plan; its steps stay as standalone tasks and goal/meeting links are removed. */
  async remove(userId: ID, planId: ID): Promise<void> {
    const now = this.env.clock.now().toISOString()
    const { repos } = this.env
    const steps = (await repos.task.list(userId)).filter((t) => t.planId === planId)
    await repos.task.saveMany(steps.map((t) => ({ ...t, planId: undefined, order: undefined, updatedAt: now })))
    const goals = (await repos.goal.list(userId)).filter((g) => g.planIds.includes(planId))
    await repos.goal.saveMany(goals.map((g) => ({ ...g, planIds: g.planIds.filter((id) => id !== planId), updatedAt: now })))
    const meetings = (await repos.meeting.list(userId)).filter((m) => m.prepPlanId === planId)
    await repos.meeting.saveMany(meetings.map((m) => ({ ...m, prepPlanId: undefined, updatedAt: now })))
    await this.plans.remove(userId, planId)
  }
}
