import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError, ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { Draft, EntityRef, ID, ISODate, Minutes, RichDoc } from '../shared/types'
import type { ActivityLog } from '../activity/ActivityLog'
import { planCaseIds, planHearingIds, planSteps } from './ActionPlan'
import type { ActionPlan, StepKind, StepPool } from './ActionPlan'
import { hearingCaseIds } from '../cases/LegalCase'
import { defaultConfirmations } from '../meetings/Meeting'
import type { Meeting } from '../meetings/Meeting'
import type { MeetingUseCases } from '../meetings/MeetingUseCases'
import { linkTouches } from '../relations/Link'
import { OPEN } from '../shared/outcome'
import type { Outcome } from '../shared/outcome'
import { toISODate } from '../shared/time'
import type { FollowUp } from '../followups/FollowUp'
import type { Task } from '../tasks/Task'

/** A step to create: what it is (a task unless said otherwise), when it is due, and optionally at what time. */
export interface StepDraft {
  title: string
  kind?: StepKind
  /** Its own day. Left out, it starts from the plan's; `null` is deliberately no day. */
  dueDate?: ISODate | null
  time?: Minutes
  notes?: string
}

/** A step to create with a plan: just its title, or with its own kind and due date. */
export type PlanStepDraft = string | StepDraft

/** An appointment with no time given is booked for the morning. */
const DEFAULT_START: Minutes = 10 * 60
const APPOINTMENT_LENGTH: Minutes = 30

/** A step in a form every kind can be built from, so one can be turned into another. */
interface StepSnapshot {
  kind: StepKind
  title: string
  notes: string
  workspace: ActionPlan['workspace']
  planId?: ID
  order?: number
  date?: ISODate
  time?: Minutes
  duration: Minutes
  contact?: string
  about?: EntityRef
  outcome: Outcome
}

export class PlanUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly plans: CrudUseCases<'plan'>,
    private readonly tasks: CrudUseCases<'task'>,
    private readonly followUps: CrudUseCases<'followUp'>,
    private readonly meetings: MeetingUseCases,
    private readonly goals: CrudUseCases<'goal'>,
    private readonly log?: ActivityLog,
  ) {}

  /** Creates a plan, its steps, and links it to the given goals. */
  async createWithSteps(userId: ID, draft: Draft<ActionPlan>, steps: PlanStepDraft[], goalIds: ID[] = []): Promise<ActionPlan> {
    const plan = await this.plans.create(userId, draft)
    let order = 0
    for (const step of steps.map((s) => (typeof s === 'string' ? { title: s } : s))) {
      const title = step.title.trim()
      if (title) await this.createStep(userId, plan, { ...step, title }, order++)
    }
    for (const goalId of goalIds) await this.link(userId, plan.id, goalId)
    return plan
  }

  /** Adds a step at the end. It has its own due date: the one given, else the plan's to start from. */
  async addStep(userId: ID, planId: ID, step: PlanStepDraft): Promise<EntityRef> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const draft = typeof step === 'string' ? { title: step } : step
    const title = draft.title.trim()
    if (!title) throw new ValidationError('A step needs a title')
    const steps = planSteps(planId, await this.pool(userId))
    return this.createStep(userId, plan, { ...draft, title }, steps.length ? Math.max(...steps.map((s) => s.order ?? 0)) + 1 : 0)
  }

  /**
   * Changes the plan's due date. Open steps that were still on the old date — the ones that simply
   * took the plan's — move with it; steps with a day of their own stay where they are.
   */
  async setDueDate(userId: ID, planId: ID, date: ISODate | undefined): Promise<{ plan: ActionPlan; moved: number }> {
    const plan = await this.env.repos.plan.get(userId, planId)
    if (!plan) throw new NotFoundError('Action plan')
    const before = plan.dueDate
    const saved = await this.plans.update({ ...plan, dueDate: date })
    let moved = 0
    if (before && date && before !== date) {
      for (const step of planSteps(planId, await this.pool(userId))) {
        if (step.outcome.status === 'open' && step.date === before) {
          await this.setStepDate(userId, step.ref, date)
          moved++
        }
      }
    }
    return { plan: saved, moved }
  }

  /** Moves a step to another day. A task's planned slot moves with it; an appointment keeps its time. */
  async setStepDate(userId: ID, ref: EntityRef, date: ISODate | undefined): Promise<void> {
    const { repos } = this.env
    if (ref.kind === 'task') {
      const t = await repos.task.get(userId, ref.id)
      if (!t) throw new NotFoundError('Task')
      await this.tasks.update({ ...t, dueDate: date, slot: t.slot && date ? { ...t.slot, date } : t.slot })
    } else if (ref.kind === 'followUp') {
      const f = await repos.followUp.get(userId, ref.id)
      if (!f) throw new NotFoundError('Follow-up')
      await this.followUps.update({ ...f, due: date ? { date, time: f.due?.time } : undefined })
    } else if (ref.kind === 'meeting') {
      const m = await repos.meeting.get(userId, ref.id)
      if (!m) throw new NotFoundError('Appointment')
      if (!date) throw new ValidationError('An appointment needs a day')
      await this.meetings.save(userId, { ...m, slot: { ...m.slot, date } })
    } else {
      throw new ValidationError('Only tasks, follow-ups and appointments are steps')
    }
  }

  /**
   * Turns a step into another kind — a task into a follow-up, an appointment into a task. The record
   * keeps its id, plan, place, due day, notes and outcome, so whatever points at it (a hearing's
   * action, a hand-made link) still does.
   */
  async convertStep(userId: ID, from: EntityRef, to: StepKind): Promise<EntityRef> {
    const snap = await this.snapshot(userId, from)
    if (snap.kind === to) return from
    if (from.kind === 'task' && (await this.env.repos.plan.list(userId)).some((p) => p.taskId === from.id)) {
      throw new ValidationError('An action plan is about this task — change that first')
    }
    const made = await this.build(userId, to, snap, from.id)
    const links = (await this.env.repos.link.list(userId)).filter((l) => linkTouches(l, from))
    const swap = (r: EntityRef) => (r.kind === from.kind && r.id === from.id ? made : r)
    for (const l of links) await this.env.repos.link.save({ ...l, a: swap(l.a), b: swap(l.b) })
    if (from.kind === 'task') await this.tasks.remove(userId, from.id)
    else if (from.kind === 'followUp') await this.followUps.remove(userId, from.id)
    else await this.meetings.remove(userId, from.id)
    return made
  }

  private async pool(userId: ID): Promise<StepPool> {
    const { repos } = this.env
    const [tasks, followUps, meetings] = await Promise.all([repos.task.list(userId), repos.followUp.list(userId), repos.meeting.list(userId)])
    return { tasks, followUps, meetings }
  }

  private today() {
    return toISODate(this.env.clock.now())
  }

  /** Creates a step of the draft's kind inside a plan, due on its own day (the plan's when none is given). */
  private createStep(userId: ID, plan: ActionPlan, d: StepDraft, order: number): Promise<EntityRef> {
    const kind = d.kind ?? 'task'
    return this.build(userId, kind, {
      kind,
      title: d.title,
      notes: d.notes ?? '',
      workspace: plan.workspace,
      planId: plan.id,
      order,
      date: d.dueDate === null ? undefined : (d.dueDate ?? plan.dueDate),
      time: d.time,
      duration: 0,
      about: plan.origin,
      outcome: OPEN,
    })
  }

  private async build(userId: ID, kind: StepKind, s: StepSnapshot, id?: ID): Promise<EntityRef> {
    if (kind === 'task') {
      const t = await this.tasks.create(userId, {
        id,
        title: s.title,
        notes: s.notes,
        workspace: s.workspace,
        priority: 'normal',
        dueDate: s.date,
        slot: s.date && s.time !== undefined ? { date: s.date, start: s.time, duration: s.duration || 45 } : undefined,
        estimate: s.duration || 45,
        planId: s.planId,
        order: s.order,
        related: s.about,
        outcome: s.outcome,
      })
      return { kind: 'task', id: t.id }
    }
    if (kind === 'followUp') {
      const f = await this.followUps.create(userId, {
        id,
        title: s.title,
        channel: 'call',
        workspace: s.workspace,
        contact: s.contact,
        due: s.date ? { date: s.date, time: s.time } : undefined,
        duration: s.duration || 15,
        subject: s.about,
        notes: s.notes || undefined,
        planId: s.planId,
        order: s.order,
        outcome: s.outcome,
      })
      return { kind: 'followUp', id: f.id }
    }
    const m = await this.meetings.save(userId, {
      id,
      kind: 'appointment',
      title: s.title,
      workspace: s.workspace,
      slot: { date: s.date ?? this.today(), start: s.time ?? DEFAULT_START, duration: s.duration || APPOINTMENT_LENGTH },
      mode: 'in_person',
      counterpart: s.contact,
      contact: s.contact,
      attendees: [],
      purpose: s.notes || undefined,
      agenda: [],
      confirmations: defaultConfirmations('appointment'),
      planId: s.planId,
      order: s.order,
      related: s.about,
      outcome: s.outcome,
    })
    return { kind: 'meeting', id: m.id }
  }

  private async snapshot(userId: ID, ref: EntityRef): Promise<StepSnapshot> {
    const { repos } = this.env
    if (ref.kind === 'task') {
      const t: Task | null = await repos.task.get(userId, ref.id)
      if (!t) throw new NotFoundError('Task')
      return { kind: 'task', title: t.title, notes: t.notes, workspace: t.workspace, planId: t.planId, order: t.order, date: t.dueDate ?? t.slot?.date, time: t.slot?.start, duration: t.slot?.duration ?? t.estimate, about: t.related, outcome: t.outcome }
    }
    if (ref.kind === 'followUp') {
      const f: FollowUp | null = await repos.followUp.get(userId, ref.id)
      if (!f) throw new NotFoundError('Follow-up')
      return { kind: 'followUp', title: f.title, notes: f.notes ?? '', workspace: f.workspace, planId: f.planId, order: f.order, date: f.due?.date, time: f.due?.time, duration: f.duration, contact: f.contact, about: f.subject, outcome: f.outcome }
    }
    if (ref.kind === 'meeting') {
      const m: Meeting | null = await repos.meeting.get(userId, ref.id)
      if (!m) throw new NotFoundError('Appointment')
      return { kind: 'appointment', title: m.title, notes: m.purpose ?? '', workspace: m.workspace, planId: m.planId, order: m.order, date: m.slot.date, time: m.slot.start, duration: m.slot.duration, contact: m.contact || m.counterpart, about: m.related, outcome: m.outcome }
    }
    throw new ValidationError('Only tasks, follow-ups and appointments are steps')
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
        return this.save(plan, { caseIds: [...caseIds, ...hearingCaseIds(hearing)], hearingIds: [...hearingIds, hearing.id], taskId: undefined, workspace: 'sb' })
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
      const remaining = caseIds.filter((id) => id !== target.id)
      // A hearing shared with another case the plan still covers stays on the plan.
      const theirs = new Set(
        (await this.env.repos.hearing.list(userId))
          .filter((h) => hearingCaseIds(h).includes(target.id) && !hearingCaseIds(h).some((id) => remaining.includes(id)))
          .map((h) => h.id),
      )
      return this.save(plan, { caseIds: remaining, hearingIds: hearingIds.filter((id) => !theirs.has(id)) })
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
    for (const step of planSteps(planId, await this.pool(userId))) {
      const t = step.kind === 'task' ? await this.env.repos.task.get(userId, step.id) : null
      if (t) {
        await this.tasks.create(userId, { title: t.title, notes: t.notes, workspace: t.workspace, priority: t.priority, estimate: t.estimate, planId: copy.id, order: order++, outcome: OPEN })
      } else {
        await this.createStep(userId, copy, { title: step.title, kind: step.kind }, order++)
      }
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

  /** Persists a new step order, across tasks, follow-ups and appointments alike. */
  async reorderSteps(userId: ID, planId: ID, orderedIds: ID[]): Promise<void> {
    const pool = await this.pool(userId)
    const position = new Map(orderedIds.map((id, i) => [id, i]))
    const now = this.env.clock.now().toISOString()
    const place = <T extends { id: ID }>(xs: T[]) => xs.filter((x) => position.has(x.id)).map((x) => ({ ...x, order: position.get(x.id)!, updatedAt: now }))
    const { repos } = this.env
    await repos.task.saveMany(place(pool.tasks.filter((t) => t.planId === planId)))
    await repos.followUp.saveMany(place(pool.followUps.filter((f) => f.planId === planId)))
    await repos.meeting.saveMany(place(pool.meetings.filter((m) => m.planId === planId)))
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
    const pool = await this.pool(userId)
    const free = <T extends { planId?: ID; order?: number; updatedAt: string }>(xs: T[]) => xs.filter((x) => x.planId === planId).map((x) => ({ ...x, planId: undefined, order: undefined, updatedAt: now }))
    await repos.task.saveMany(free(pool.tasks))
    await repos.followUp.saveMany(free(pool.followUps))
    await repos.meeting.saveMany(free(pool.meetings))
    const goals = (await repos.goal.list(userId)).filter((g) => g.planIds.includes(planId))
    await repos.goal.saveMany(goals.map((g) => ({ ...g, planIds: g.planIds.filter((id) => id !== planId), updatedAt: now })))
    const meetings = (await repos.meeting.list(userId)).filter((m) => m.prepPlanId === planId)
    await repos.meeting.saveMany(meetings.map((m) => ({ ...m, prepPlanId: undefined, updatedAt: now })))
    await this.plans.remove(userId, planId)
  }
}
