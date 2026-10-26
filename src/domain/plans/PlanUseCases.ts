import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError, ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID, RichDoc } from '../shared/types'
import type { ActivityLog } from '../activity/ActivityLog'
import { stepsOf } from './ActionPlan'
import type { ActionPlan, PlanScope } from './ActionPlan'
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
   * Says what the plan covers. A hearing's plan belongs to that hearing's case; a task's plan takes
   * the task's workspace (and its case, when the task came from one). Anything not chosen is cleared.
   */
  async setScope(userId: ID, planId: ID, scope: { kind: PlanScope; caseId?: ID; hearingId?: ID; taskId?: ID }): Promise<ActionPlan> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const cleared = { ...plan, caseId: undefined, hearingId: undefined, taskId: undefined }

    switch (scope.kind) {
      case 'general':
        return this.plans.update(cleared)
      case 'case': {
        if (!scope.caseId || !(await this.env.repos.case.get(userId, scope.caseId))) throw new ValidationError('Choose the case')
        return this.plans.update({ ...cleared, caseId: scope.caseId, workspace: 'sb' })
      }
      case 'hearing': {
        const hearing = scope.hearingId ? await this.env.repos.hearing.get(userId, scope.hearingId) : null
        if (!hearing) throw new ValidationError('Choose the hearing')
        return this.plans.update({ ...cleared, caseId: hearing.caseId, hearingId: hearing.id, workspace: 'sb' })
      }
      case 'task': {
        const task = scope.taskId ? await this.env.repos.task.get(userId, scope.taskId) : null
        if (!task) throw new ValidationError('Choose the task')
        if (task.planId === planId) throw new ValidationError('A plan can’t be about one of its own steps')
        const caseId = task.related?.kind === 'case' ? task.related.id : undefined
        return this.plans.update({ ...cleared, taskId: task.id, caseId, workspace: task.workspace })
      }
    }
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
