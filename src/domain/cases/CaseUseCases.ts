import type { PlanStepDraft, PlanUseCases } from '../plans/PlanUseCases'
import type { DiaryInput } from '../diary/Diary'
import type { DiaryUseCases } from '../diary/DiaryUseCases'
import type { CrudUseCases } from '../shared/CrudUseCases'
import { NotFoundError } from '../shared/errors'
import type { Outcome } from '../shared/outcome'
import type { DomainEnv } from '../shared/registry'
import type { Draft, ID, ISODate, Minutes } from '../shared/types'
import { nextCaseNumber } from './caseNumber'
import { coversCase, planCaseIds, planHearingIds } from '../plans/ActionPlan'
import type { ActionPlan } from '../plans/ActionPlan'
import type { CaseStatus, Engagement, Hearing, LegalCase } from './LegalCase'
import { counselLabel } from '../counsel/Counsel'
import type { ActivityLog } from '../activity/ActivityLog'

export interface HearingRecord {
  /** What happened at the hearing. */
  summary: string
  outcome: Outcome
  /** The next listing, if one was given. */
  next?: { date: ISODate; time?: Minutes; purpose: string }
  /** An action plan to prepare for what comes next. */
  plan?: { title: string; objective: string; steps: PlanStepDraft[]; dueDate?: ISODate }
  /**
   * The case diary entry for the hearing: order, submissions, authorities and the work due before the
   * next date. Written alongside the hearing, and revised when the hearing is revised. Actions with no
   * task yet become the plan's steps when the plan is made and no steps were typed.
   */
  diary?: DiaryInput
  /** Case-level changes resulting from the hearing. */
  caseUpdate?: { stage?: string; status?: CaseStatus }
}

export interface HearingRecordResult {
  hearing: Hearing
  nextHearing?: Hearing
  plan?: ActionPlan
  diaryEntryId?: ID
}

export class CaseUseCases {
  constructor(
    private readonly env: DomainEnv,
    private readonly cases: CrudUseCases<'case'>,
    private readonly hearings: CrudUseCases<'hearing'>,
    private readonly plans: PlanUseCases,
    private readonly log: ActivityLog,
    private readonly diary?: DiaryUseCases,
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

    const existingEntry = await this.diary?.forHearing(userId, hearing.id)
    const actions = record.diary?.actions ?? existingEntry?.actions ?? []
    const pending = actions.filter((a) => !a.taskId && a.text.trim())

    let plan: ActionPlan | undefined
    let planFromActions = false
    if (record.plan) {
      const typed = record.plan.steps
      planFromActions = typed.length === 0 && pending.length > 0
      plan = await this.plans.createWithSteps(
        userId,
        {
          title: record.plan.title,
          objective: record.plan.objective,
          workspace: 'sb',
          status: 'active',
          dueDate: record.plan.dueDate ?? nextHearing?.date,
          origin: { kind: 'hearing', id: hearing.id },
          caseIds: [hearing.caseId],
          // The plan is for getting ready for the next date, when there is one.
          hearingIds: nextHearing ? [nextHearing.id] : undefined,
        },
        planFromActions ? pending.map((a) => ({ title: a.text, dueDate: a.due })) : typed,
      )
    }

    let diaryEntryId: ID | undefined
    const d = record.diary ?? {}
    const hasDiaryContent = !!(record.summary.trim() || d.order?.trim() || d.submissions?.trim() || d.evidence?.trim() || d.reflections?.trim() || d.authorities?.length || actions.some((a) => a.text.trim()))
    if (this.diary && (hasDiaryContent || existingEntry)) {
      const base = existingEntry ?? { caseId: hearing.caseId, hearingId: hearing.id, kind: 'court' as const, date: hearing.date, authorities: [] as string[], actions: [] }
      const saved = await this.diary.save(userId, {
        ...base,
        bench: d.bench ?? existingEntry?.bench ?? hearing.forum,
        proceedings: record.summary,
        order: d.order ?? existingEntry?.order,
        submissions: d.submissions ?? existingEntry?.submissions,
        authorities: d.authorities ?? existingEntry?.authorities ?? [],
        evidence: d.evidence ?? existingEntry?.evidence,
        reflections: d.reflections ?? existingEntry?.reflections,
        nextDate: record.next?.date ?? existingEntry?.nextDate,
        nextPurpose: record.next?.purpose ?? existingEntry?.nextPurpose,
        actions,
      })
      diaryEntryId = saved.id
      // The saved actions without a task are the ones the plan's steps were made from, in the same order.
      if (plan && planFromActions) await this.diary.attachSteps(userId, saved, plan.id, saved.actions.filter((a) => !a.taskId))
    }

    if (record.caseUpdate && (record.caseUpdate.stage !== undefined || record.caseUpdate.status !== undefined)) {
      await this.cases.update({
        ...legalCase,
        stage: record.caseUpdate.stage ?? legalCase.stage,
        status: record.caseUpdate.status ?? legalCase.status,
      })
    }

    return { hearing: updated, nextHearing, plan, diaryEntryId }
  }

  /** Deletes a case with its hearings; its plans are kept but no longer cover it (a plan shared with other cases stays on them). */
  async remove(userId: ID, caseId: ID): Promise<void> {
    const mine = (await this.env.repos.hearing.list(userId)).filter((h) => h.caseId === caseId)
    const gone = new Set(mine.map((h) => h.id))
    for (const h of mine) await this.env.repos.hearing.remove(userId, h.id)
    for (const e of await this.env.repos.diary.list(userId)) if (e.caseId === caseId) await this.env.repos.diary.remove(userId, e.id)
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
