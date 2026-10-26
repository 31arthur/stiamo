import type { PlanUseCases } from '../plans/PlanUseCases'
import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError } from '../shared/errors'
import type { Outcome } from '../shared/outcome'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID, ISODate, Minutes } from '../shared/types'
import { nextCaseNumber } from './caseNumber'
import type { ActionPlan } from '../plans/ActionPlan'
import type { CaseStatus, Hearing, LegalCase } from './LegalCase'

export interface HearingRecord {
  /** What happened at the hearing. */
  summary: string
  outcome: Outcome
  /** The next listing, if one was given. */
  next?: { date: ISODate; time?: Minutes; purpose: string }
  /** An action plan to prepare for what comes next. */
  plan?: { title: string; objective: string; steps: string[]; dueDate?: ISODate }
  /** Case-level changes resulting from the hearing. */
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
  ) {}

  /**
   * Opens a case and gives it the next case number for its organization. The year in the number is
   * the year it was filed (or today's, when no filing date is given).
   */
  async open(userId: ID, draft: Omit<Draft<LegalCase>, 'reference'>): Promise<LegalCase> {
    const year = draft.filedOn ? Number(draft.filedOn.slice(0, 4)) : this.env.clock.now().getFullYear()
    const existing = await this.env.repos.case.list(userId)
    const reference = nextCaseNumber(draft.organization, year, existing)
    return this.cases.create(userId, { ...draft, reference })
  }

  /**
   * Writes up a hearing in one step: its summary and outcome, the next date, an action plan for the
   * next stage (with its steps as tasks) and any change to the case's stage or status.
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
        date: record.next.date,
        time: record.next.time,
        duration: hearing.duration,
        purpose: record.next.purpose,
        forum: hearing.forum,
        outcome: { status: 'open' },
      })
    }

    const updated = await this.hearings.update({
      ...hearing,
      summary: record.summary.trim(),
      outcome: { ...record.outcome, recordedAt: this.env.clock.now().toISOString() },
      nextHearingId: nextHearing?.id ?? hearing.nextHearingId,
    })

    let plan: ActionPlan | undefined
    if (record.plan) {
      plan = await this.plans.createWithSteps(
        userId,
        {
          title: record.plan.title,
          objective: record.plan.objective,
          workspace: 'sb',
          status: 'active',
          dueDate: record.plan.dueDate ?? nextHearing?.date,
          origin: { kind: 'hearing', id: hearing.id },
          caseId: hearing.caseId,
        },
        record.plan.steps,
      )
    }

    if (record.caseUpdate && (record.caseUpdate.stage !== undefined || record.caseUpdate.status !== undefined)) {
      await this.cases.update({
        ...legalCase,
        stage: record.caseUpdate.stage ?? legalCase.stage,
        status: record.caseUpdate.status ?? legalCase.status,
      })
    }

    return { hearing: updated, nextHearing, plan }
  }

  /** Deletes a case with its hearings; its plans are kept but detached. */
  async remove(userId: ID, caseId: ID): Promise<void> {
    for (const h of await this.env.repos.hearing.list(userId)) {
      if (h.caseId === caseId) await this.env.repos.hearing.remove(userId, h.id)
    }
    const now = this.env.clock.now().toISOString()
    const plans = (await this.env.repos.plan.list(userId)).filter((p) => p.caseId === caseId)
    await this.env.repos.plan.saveMany(plans.map((p) => ({ ...p, caseId: undefined, updatedAt: now })))
    await this.cases.remove(userId, caseId)
  }
}
