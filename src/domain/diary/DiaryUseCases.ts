import type { ActivityLog } from '../activity/ActivityLog'
import type { PlanUseCases } from '../plans/PlanUseCases'
import { stepsOf } from '../plans/ActionPlan'
import type { ActionPlan } from '../plans/ActionPlan'
import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError, ValidationError } from '../shared/errors'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID } from '../shared/types'
import { DIARY_KIND_LABELS } from './Diary'
import type { DiaryAction, DiaryEntry } from './Diary'

type EntryInput = Omit<Draft<DiaryEntry>, 'actions'> & { actions: { id?: ID; text: string; due?: string; taskId?: ID }[] }

export class DiaryUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly entries: CrudUseCases<'diary'>,
    private readonly tasks: CrudUseCases<'task'>,
    private readonly plans: PlanUseCases,
    private readonly log: ActivityLog,
  ) {}

  /** Writes a new entry, or saves changes to one (an entry has an `id` once stored). */
  async save(userId: ID, input: EntryInput | DiaryEntry): Promise<DiaryEntry> {
    const legalCase = await this.env.repos.case.get(userId, input.caseId)
    if (!legalCase) throw new NotFoundError('Case')
    const actions: DiaryAction[] = input.actions
      .filter((a) => a.text.trim())
      .map((a) => ({ id: a.id ?? this.env.ids.next(), text: a.text, due: a.due, taskId: a.taskId }))
    const draft = { ...input, actions }

    if ('createdAt' in input) return this.entries.update(draft as DiaryEntry)
    const created = await this.entries.create(userId, draft as Draft<DiaryEntry>)
    await this.log.record(userId, {
      ref: { kind: 'case', id: legalCase.id },
      title: `${legalCase.reference} — ${legalCase.title}`,
      action: 'updated',
      summary: `Diary: ${DIARY_KIND_LABELS[created.kind].toLowerCase()} entry for ${created.date}`,
    })
    return created
  }

  /** The entry that records a hearing, if one has been written. */
  async forHearing(userId: ID, hearingId: ID): Promise<DiaryEntry | undefined> {
    return (await this.env.repos.diary.list(userId)).find((e) => e.hearingId === hearingId)
  }

  /** Turns every action that has no task yet into a task on the case, due by its date (or the next date). */
  async toTasks(userId: ID, entryId: ID): Promise<DiaryEntry> {
    const entry = await this.require(userId, entryId)
    const pending = entry.actions.filter((a) => !a.taskId)
    if (!pending.length) throw new ValidationError('Every action already has a task')
    const made = new Map<ID, ID>()
    for (const a of pending) {
      const task = await this.tasks.create(userId, {
        title: a.text,
        notes: `From the case diary, ${entry.date}`,
        workspace: 'sb',
        priority: 'normal',
        dueDate: a.due ?? entry.nextDate,
        estimate: 45,
        related: { kind: 'case', id: entry.caseId },
        outcome: { status: 'open' },
      })
      made.set(a.id, task.id)
    }
    return this.entries.update({ ...entry, actions: entry.actions.map((a) => (made.has(a.id) ? { ...a, taskId: made.get(a.id) } : a)) })
  }

  /**
   * Starts an action plan from the entry's open actions: each becomes a step (a task) due by its own
   * date, or by the next date. The plan covers the case, and the next hearing when it's listed.
   */
  async toPlan(userId: ID, entryId: ID, title?: string): Promise<ActionPlan> {
    const entry = await this.require(userId, entryId)
    const pending = entry.actions.filter((a) => !a.taskId)
    if (!pending.length) throw new ValidationError('Every action already has a task')
    const next = entry.nextDate
      ? (await this.env.repos.hearing.list(userId)).find((h) => h.caseId === entry.caseId && h.date === entry.nextDate && h.outcome.status === 'open')
      : undefined
    const plan = await this.plans.createWithSteps(
      userId,
      {
        title: title?.trim() || `Prepare for ${entry.nextPurpose || 'the next hearing'}`,
        objective: '',
        workspace: 'sb',
        status: 'active',
        dueDate: entry.nextDate,
        origin: entry.hearingId ? { kind: 'hearing', id: entry.hearingId } : { kind: 'case', id: entry.caseId },
        caseIds: [entry.caseId],
        hearingIds: next ? [next.id] : undefined,
      },
      pending.map((a) => ({ title: a.text, dueDate: a.due })),
    )
    await this.attachSteps(userId, entry, plan.id, pending)
    return plan
  }

  /** Records which tasks were created for which actions, in order. */
  async attachSteps(userId: ID, entry: DiaryEntry, planId: ID, pending: DiaryAction[]): Promise<DiaryEntry> {
    const steps = stepsOf(planId, await this.env.repos.task.list(userId))
    const made = new Map(pending.map((a, i) => [a.id, steps[i]?.id]))
    return this.entries.update({ ...entry, actions: entry.actions.map((a) => (made.get(a.id) ? { ...a, taskId: made.get(a.id) } : a)) })
  }

  async remove(userId: ID, entryId: ID): Promise<void> {
    await this.entries.remove(userId, entryId)
  }

  private async require(userId: ID, entryId: ID): Promise<DiaryEntry> {
    const entry = await this.env.repos.diary.get(userId, entryId)
    if (!entry) throw new NotFoundError('Diary entry')
    return entry
  }
}
