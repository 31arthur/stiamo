import type { PlanStepDraft, PlanUseCases } from '../plans/PlanUseCases'
import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError } from '../shared/errors'
import type { Outcome } from '../shared/outcome'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID, ISODate, Minutes } from '../shared/types'
import { nextCaseNumber } from './caseNumber'
import { coversCase, planCaseIds, planHearingIds, stepsOf } from '../plans/ActionPlan'
import type { ActionPlan } from '../plans/ActionPlan'
import { hearingCaseIds } from './LegalCase'
import type { CaseStatus, Engagement, Hearing, HearingAction, LegalCase } from './LegalCase'
import { counselLabel } from '../counsel/Counsel'
import type { ActivityLog } from '../activity/ActivityLog'

/** What is written up about a hearing beyond the summary; it lives on the hearing itself. */
export interface HearingNotes {
  bench?: string
  order?: string
  submissions?: string
  authorities?: string[]
  evidence?: string
  reflections?: string
  /** Work due before the next date. Actions with no task yet become the plan's steps when no steps were typed. */
  actions?: { id?: ID; text: string; due?: ISODate; taskId?: ID }[]
}

export interface HearingRecord {
  /** What happened at the hearing. */
  summary: string
  outcome: Outcome
  /** The next listing, if one was given. It concerns the same cases. */
  next?: { date: ISODate; time?: Minutes; purpose: string }
  /** An action plan to prepare for what comes next. */
  plan?: { title: string; objective: string; steps: PlanStepDraft[]; dueDate?: ISODate }
  /**
   * The rest of the write-up: order, submissions, authorities and the work due. When given it is the
   * whole of it (anything left out is cleared); when omitted what the hearing already has is kept.
   */
  notes?: HearingNotes
  /** Case-level changes resulting from the hearing, applied to the main case. */
  caseUpdate?: { stage?: string; status?: CaseStatus }
}

export interface HearingRecordResult {
  hearing: Hearing
  nextHearing?: Hearing
  plan?: ActionPlan
}

export class CaseUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly cases: CrudUseCases<'case'>,
    private readonly hearings: CrudUseCases<'hearing'>,
    private readonly plans: PlanUseCases,
    private readonly log: ActivityLog,
  ) {}

  /**
   * Opens a case and gives it the next case number for its organization. The year in the number is
   * the year it was filed (or today's, when no filing date is given).
   */
  async open(userId: ID, draft: Omit<Draft<LegalCase>, 'reference'>): Promise<LegalCase> {
    const year = draft.filedOn ? Number(draft.filedOn.slice(0, 4)) : this.env.clock.now().getFullYear()
    const existing = await this.env.repos.case.list(userId)
    const reference = nextCaseNumber(draft.organization, year, existing)
    if (draft.engagement) await this.requireCounsel(userId, draft.engagement.counselId)
    const opened = await this.cases.create(userId, { ...draft, reference })
    if (opened.engagement) await this.logAssignment(userId, opened, opened.engagement.counselId)
    return opened
  }

  /**
   * Briefs outside counsel on a case (or changes the brief), or takes it back with `null` so we
   * handle it ourselves. The change is written to the history of both the case and the counsel.
   */
  async assignCounsel(userId: ID, caseId: ID, engagement: Engagement | null): Promise<LegalCase> {
    const legalCase = await this.env.repos.case.get(userId, caseId)
    if (!legalCase) throw new NotFoundError('Case')
    if (engagement) await this.requireCounsel(userId, engagement.counselId)
    const previous = legalCase.engagement?.counselId
    const updated = await this.cases.update({ ...legalCase, engagement: engagement ? { ...engagement, scope: engagement.scope?.trim() || undefined, fee: engagement.fee?.trim() || undefined, notes: engagement.notes?.trim() || undefined } : undefined })

    const title = `${legalCase.reference} — ${legalCase.title}`
    const caseRef = { kind: 'case' as const, id: caseId }
    if (previous && previous !== engagement?.counselId) {
      const old = await this.env.repos.counsel.get(userId, previous)
      if (old) await this.log.record(userId, { ref: { kind: 'counsel', id: old.id }, title: counselLabel(old), action: 'unlinked', summary: `No longer briefed on “${legalCase.title}”`, related: caseRef })
    }
    if (engagement) await this.logAssignment(userId, updated, engagement.counselId)
    else await this.log.record(userId, { ref: caseRef, title, action: 'updated', summary: 'Taken back — now handled by us' })
    return updated
  }

  private async requireCounsel(userId: ID, counselId: ID) {
    const counsel = await this.env.repos.counsel.get(userId, counselId)
    if (!counsel) throw new NotFoundError('Counsel')
    return counsel
  }

  private async logAssignment(userId: ID, legalCase: LegalCase, counselId: ID) {
    const counsel = await this.env.repos.counsel.get(userId, counselId)
    if (!counsel) return
    const e = legalCase.engagement!
    const detail = e.proBono ? ' (pro bono)' : e.fee ? ` — ${e.fee}` : ''
    await this.log.record(userId, { ref: { kind: 'case', id: legalCase.id }, title: `${legalCase.reference} — ${legalCase.title}`, action: 'linked', summary: `Briefed ${counselLabel(counsel)}${detail}`, related: { kind: 'counsel', id: counsel.id } })
    await this.log.record(userId, { ref: { kind: 'counsel', id: counsel.id }, title: counselLabel(counsel), action: 'linked', summary: `Briefed on “${legalCase.title}”${detail}`, related: { kind: 'case', id: legalCase.id } })
  }

  /**
   * Writes up a hearing in one step. The write-up is the case diary entry, kept on the hearing itself
   * and shared by every case the hearing concerned: summary and outcome, order and notes, the next
   * date (listed for the same cases), an action plan whose steps are the work due, and any change to
   * the main case's stage or status.
   */
  async recordHearing(userId: ID, hearingId: ID, record: HearingRecord): Promise<HearingRecordResult> {
    const hearing = await this.env.repos.hearing.get(userId, hearingId)
    if (!hearing) throw new NotFoundError('Hearing')
    const legalCase = await this.env.repos.case.get(userId, hearing.caseId)
    if (!legalCase) throw new NotFoundError('Case')

    let nextHearing: Hearing | undefined
    if (record.next) {
      nextHearing = await this.hearings.create(userId, {
        caseId: hearing.caseId,
        alsoCaseIds: hearing.alsoCaseIds,
        date: record.next.date,
        time: record.next.time,
        duration: hearing.duration,
        purpose: record.next.purpose,
        forum: hearing.forum,
        outcome: { status: 'open' },
      })
    }

    const notes: HearingNotes = record.notes ?? { bench: hearing.bench, order: hearing.order, submissions: hearing.submissions, authorities: hearing.authorities, evidence: hearing.evidence, reflections: hearing.reflections, actions: hearing.actions }
    const actions: HearingAction[] = (notes.actions ?? []).filter((a) => a.text.trim()).map((a) => ({ id: a.id ?? this.env.ids.next(), text: a.text, due: a.due, taskId: a.taskId }))
    const pending = actions.filter((a) => !a.taskId)

    let plan: ActionPlan | undefined
    if (record.plan) {
      const typed = record.plan.steps
      const fromActions = typed.length === 0 && pending.length > 0
      plan = await this.plans.createWithSteps(
        userId,
        {
          title: record.plan.title,
          objective: record.plan.objective,
          workspace: 'sb',
          status: 'active',
          dueDate: record.plan.dueDate ?? nextHearing?.date,
          origin: { kind: 'hearing', id: hearing.id },
          caseIds: hearingCaseIds(hearing),
          // The plan is for getting ready for the next date, when there is one.
          hearingIds: nextHearing ? [nextHearing.id] : undefined,
        },
        fromActions ? pending.map((a) => ({ title: a.text, dueDate: a.due })) : typed,
      )
      if (fromActions) {
        // The steps were made from the actions without a task, in the same order: remember which is which.
        const steps = stepsOf(plan.id, await this.env.repos.task.list(userId))
        pending.forEach((a, i) => {
          a.taskId = steps[i]?.id
        })
      }
    }

    const updated = await this.hearings.update({
      ...hearing,
      summary: record.summary.trim(),
      outcome: { ...record.outcome, recordedAt: this.env.clock.now().toISOString() },
      nextHearingId: nextHearing?.id ?? hearing.nextHearingId,
      bench: notes.bench,
      order: notes.order,
      submissions: notes.submissions,
      authorities: notes.authorities,
      evidence: notes.evidence,
      reflections: notes.reflections,
      actions,
    })

    if (record.caseUpdate && (record.caseUpdate.stage !== undefined || record.caseUpdate.status !== undefined)) {
      await this.cases.update({
        ...legalCase,
        stage: record.caseUpdate.stage ?? legalCase.stage,
        status: record.caseUpdate.status ?? legalCase.status,
      })
    }

    return { hearing: updated, nextHearing, plan }
  }

  /**
   * Deletes a case. Hearings that were only about it go with it; a hearing shared with other cases
   * stays on them (another of its cases becomes the main one). Plans are kept but no longer cover
   * the case — a plan shared with other cases stays on them.
   */
  async remove(userId: ID, caseId: ID): Promise<void> {
    const gone = new Set<ID>()
    for (const h of await this.env.repos.hearing.list(userId)) {
      const all = hearingCaseIds(h)
      if (!all.includes(caseId)) continue
      const rest = all.filter((id) => id !== caseId)
      if (rest.length === 0) {
        gone.add(h.id)
        await this.env.repos.hearing.remove(userId, h.id)
      } else {
        await this.hearings.update({ ...h, caseId: rest[0], alsoCaseIds: rest.slice(1) })
      }
    }
    const now = this.env.clock.now().toISOString()
    const plans = (await this.env.repos.plan.list(userId)).filter((p) => coversCase(p, caseId))
    await this.env.repos.plan.saveMany(
      plans.map((p) => {
        const caseIds = planCaseIds(p).filter((id) => id !== caseId)
        const hearingIds = planHearingIds(p).filter((id) => !gone.has(id))
        return { ...p, caseIds: caseIds.length ? caseIds : undefined, hearingIds: hearingIds.length ? hearingIds : undefined, caseId: undefined, hearingId: undefined, updatedAt: now }
      }),
    )
    await this.cases.remove(userId, caseId)
  }
}
