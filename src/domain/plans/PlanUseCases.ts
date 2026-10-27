import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError, ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { Draft, EntityRef, ID, ISODate, RichDoc } from '../shared/types'
import type { ActivityLog } from '../activity/ActivityLog'
import { planCaseIds, planHearingIds, stepsOf } from './ActionPlan'
import type { ActionPlan } from './ActionPlan'
import type { Task } from '../tasks/Task'

/** A step to create with a plan: just its title, or with its own due date. */
export type PlanStepDraft = string | { title: string; dueDate?: ISODate }

export class PlanUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly plans: CrudUseCases<'plan'>,
    private readonly tasks: CrudUseCases<'task'>,
    private readonly goals: CrudUseCases<'goal'>,
    private readonly log?: ActivityLog,
  ) {}

  /** Creates a plan, its steps as tasks, and links it to the given goals. */
  async createWithSteps(userId: ID, draft: Draft<ActionPlan>, steps: PlanStepDraft[], goalIds: ID[] = []): Promise<ActionPlan> {
    const plan = await this.plans.create(userId, draft)
    let order = 0
    const drafts = steps
      .map((s) => (typeof s === 'string' ? { title: s.trim() } : { title: s.title.trim(), dueDate: s.dueDate }))
      .filter((s) => s.title)
    for (const { title, dueDate } of drafts) {
      await this.tasks.create(userId, {
        title,
        notes: '',
        workspace: plan.workspace,
        priority: 'normal',
        dueDate: dueDate ?? plan.dueDate,
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
   * Makes the plan apply to one more case, hearing or task. A plan can cover several cases and
   * hearings at once — the same approach reused across a batch of matters or across dates — and
   * stays one page with one set of steps. A hearing brings its case along; a task is exclusive
   * (a plan is either about one task or about cases/hearings).
   */
  async cover(userId: ID, planId: ID, target: EntityRef): Promise<ActionPlan> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const caseIds = planCaseIds(plan)
    const hearingIds = planHearingIds(plan)

    switch (target.kind) {
      case 'case': {
        if (!(await this.env.repos.case.get(userId, target.id))) throw new ValidationError('That case no longer exists')
        return this.save(plan, { caseIds: [...caseIds, target.id], hearingIds, taskId: undefined, workspace: 'sb' })
      }
      case 'hearing': {
        const hearing = await this.env.repos.hearing.get(userId, target.id)
        if (!hearing) throw new ValidationError('That hearing no longer exists')
        return this.save(plan, { caseIds: [...caseIds, hearing.caseId], hearingIds: [...hearingIds, hearing.id], taskId: undefined, workspace: 'sb' })
      }
      case 'task': {
        const task = await this.env.repos.task.get(userId, target.id)
        if (!task) throw new ValidationError('That task no longer exists')
        if (task.planId === planId) throw new ValidationError('A plan can’t be about one of its own steps')
        const caseId = task.related?.kind === 'case' ? task.related.id : undefined
        return this.save(plan, { caseIds: caseId ? [caseId] : [], hearingIds: [], taskId: task.id, workspace: task.workspace })
      }
      default:
        throw new ValidationError('A plan can cover cases, hearings or a task')
    }
  }

  /**
   * Stops the plan applying to a case, hearing or its task. Dropping a case also drops that case's
   * hearings; dropping a hearing leaves the plan on the case.
   */
  async uncover(userId: ID, planId: ID, target: EntityRef): Promise<ActionPlan> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const caseIds = planCaseIds(plan)
    const hearingIds = planHearingIds(plan)

    if (target.kind === 'task') return this.save(plan, { caseIds, hearingIds, taskId: undefined })
    if (target.kind === 'hearing') return this.save(plan, { caseIds, hearingIds: hearingIds.filter((id) => id !== target.id) })
    if (target.kind === 'case') {
      const theirs = new Set((await this.env.repos.hearing.list(userId)).filter((h) => h.caseId === target.id).map((h) => h.id))
      return this.save(plan, { caseIds: caseIds.filter((id) => id !== target.id), hearingIds: hearingIds.filter((id) => !theirs.has(id)) })
    }
    return plan
  }

  /**
   * An independent copy: the same page and objective, with every step reset to open. For when a
   * hearing or case needs the same approach but its own progress. Starts covering nothing.
   */
  async duplicate(userId: ID, planId: ID): Promise<ActionPlan> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const copy = await this.plans.create(userId, {
      title: `${plan.title} (copy)`,
      objective: plan.objective,
      workspace: plan.workspace,
      status: 'draft',
      doc: plan.doc,
    })
    let order = 0
    for (const step of stepsOf(planId, await this.env.repos.task.list(userId))) {
      await this.tasks.create(userId, {
        title: step.title,
        notes: step.notes,
        workspace: step.workspace,
        priority: step.priority,
        estimate: step.estimate,
        planId: copy.id,
        order: order++,
        outcome: { status: 'open' },
      })
    }
    return copy
  }

  private save(plan: ActionPlan, change: Partial<ActionPlan>): Promise<ActionPlan> {
    const unique = (ids?: ID[]) => (ids?.length ? [...new Set(ids)] : undefined)
    const caseIds = unique(change.caseIds)
    const hearingIds = unique(change.hearingIds)
    return this.plans.update({ ...plan, ...change, caseIds, hearingIds, caseId: undefined, hearingId: undefined })
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
