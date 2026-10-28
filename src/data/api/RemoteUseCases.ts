/**
 * The use cases, as the backend runs them.
 *
 * Offline (and with Supabase) the use cases in `domain/` run in the browser against a store. With the Stiamo backend
 * the same rules run on the server — case numbers, appointment confirmations, recording a hearing, plan steps,
 * history — so each class here keeps the signature the screens already call and turns the call into one request.
 * Whatever the server decides comes back in the response; nothing is recomputed here.
 */
import { MAX_ATTACHMENT_BYTES } from '@/domain/attachments/Attachment'
import type { Attachment } from '@/domain/attachments/Attachment'
import { ValidationError } from '@/domain/shared/errors'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import type { HearingRecord, HearingRecordResult, HearingSaveResult } from '@/domain/cases/CaseUseCases'
import type { Engagement, Hearing, LegalCase } from '@/domain/cases/LegalCase'
import type { RetrySuggestion } from '@/domain/followups/chase'
import type { AttemptInput, AttemptLogged } from '@/domain/followups/FollowUpUseCases'
import type { FollowUp } from '@/domain/followups/FollowUp'
import type { ActionPlan, StepKind } from '@/domain/plans/ActionPlan'
import type { PlanStepDraft } from '@/domain/plans/PlanUseCases'
import { packDay } from '@/domain/planner/dayPlan'
import type { Block, PackOptions } from '@/domain/planner/dayPlan'
import type { Link } from '@/domain/relations/Link'
import type { Meeting } from '@/domain/meetings/Meeting'
import type { Outcome } from '@/domain/shared/outcome'
import type { OutcomeTarget, SpawnRequest } from '@/domain/shared/RecordOutcomeUseCase'
import type { AnyEntity, EntityMap, StoreKind } from '@/domain/shared/registry'
import { minutesOf, toISODate } from '@/domain/shared/time'
import type { Draft, EntityRef, ID, ISODate, RichDoc } from '@/domain/shared/types'
import { ApiHttp } from './ApiHttp'
import { ApiRepository, PATHS } from './ApiRepository'
import { ChangeBus } from './ChangeBus'

/** The caller's own date and time of day, which the server (running on UTC) cannot know. */
const localNow = () => {
  const now = new Date()
  return { date: toISODate(now), minute: minutesOf(now) }
}

const enc = encodeURIComponent

/** Shared by every remote use case: the HTTP client, and a way to say "something changed, refresh the views". */
abstract class Remote {
  constructor(
    protected readonly http: ApiHttp,
    protected readonly bus: ChangeBus,
  ) {}

  /** Runs a write and refreshes the live views once it has succeeded. */
  protected async write<T>(run: () => Promise<T>): Promise<T> {
    const result = await run()
    this.bus.touch()
    return result
  }
}

// --- records ----------------------------------------------------------------------------------------------

export class RemoteCrud<K extends StoreKind> extends Remote {
  private readonly repo: ApiRepository<EntityMap[K]>
  private readonly path: string

  constructor(
    http: ApiHttp,
    bus: ChangeBus,
    private readonly kind: K,
    private readonly writable = true,
  ) {
    super(http, bus)
    this.path = PATHS[kind]
    this.repo = new ApiRepository<EntityMap[K]>(http, kind, bus, writable)
  }

  list(userId: ID) {
    return this.repo.list(userId)
  }

  get(userId: ID, id: ID) {
    return this.repo.get(userId, id)
  }

  subscribe(userId: ID, listener: (items: EntityMap[K][]) => void, onError?: (e: Error) => void) {
    return this.repo.subscribe(userId, listener, onError)
  }

  create(_userId: ID, draft: Draft<EntityMap[K]>): Promise<EntityMap[K]> {
    this.assertWritable()
    return this.write(() => this.http.post<EntityMap[K]>(this.path, draft))
  }

  update(entity: EntityMap[K]): Promise<EntityMap[K]> {
    this.assertWritable()
    return this.write(() => this.http.put<EntityMap[K]>(`${this.path}/${enc(entity.id)}`, entity))
  }

  remove(_userId: ID, id: ID): Promise<void> {
    this.assertWritable()
    return this.write(() => this.http.delete(`${this.path}/${enc(id)}`))
  }

  private assertWritable() {
    if (!this.writable) throw new Error(`${this.kind} records are changed through their own actions`)
  }
}

export class RemoteMeetings extends Remote {
  save(_userId: ID, input: Meeting | Draft<Meeting>): Promise<Meeting> {
    return this.write(() => ('createdAt' in input ? this.http.put<Meeting>(`${PATHS.meeting}/${enc(input.id)}`, input) : this.http.post<Meeting>(PATHS.meeting, input)))
  }

  remove(_userId: ID, id: ID): Promise<void> {
    return this.write(() => this.http.delete(`${PATHS.meeting}/${enc(id)}`))
  }
}

export class RemoteFollowUps extends Remote {
  private body(input: Pick<AttemptInput, 'result' | 'callBackAt' | 'promisedFor'> & Partial<AttemptInput>) {
    return { ...input, at: localNow() }
  }

  async suggest(_userId: ID, id: ID, input: Pick<AttemptInput, 'result' | 'callBackAt' | 'promisedFor'>): Promise<RetrySuggestion | null> {
    const { suggestion } = await this.http.post<{ suggestion: RetrySuggestion | null }>(`${PATHS.followUp}/${enc(id)}/suggestion`, this.body(input))
    return suggestion ? { ...suggestion, time: suggestion.time ?? undefined } : null
  }

  logAttempt(_userId: ID, id: ID, input: AttemptInput): Promise<AttemptLogged> {
    // `next` may be absent (take the suggestion), a date, or null (leave the follow-up without one): JSON keeps all three apart.
    return this.write(async () => {
      const r = await this.http.post<{ followUp: FollowUp; before: FollowUp; suggestion: RetrySuggestion | null }>(`${PATHS.followUp}/${enc(id)}/attempts`, this.body(input))
      return { followUp: r.followUp, before: r.before, suggestion: r.suggestion ? { ...r.suggestion, time: r.suggestion.time ?? undefined } : null }
    })
  }

  /** Puts a follow-up back as it was (the undo for a try logged by mistake). */
  restore(before: FollowUp): Promise<FollowUp> {
    return this.write(() => this.http.put<FollowUp>(`${PATHS.followUp}/${enc(before.id)}`, before))
  }
}

// --- plans --------------------------------------------------------------------------------------------------

export class RemotePlans extends Remote {
  createWithSteps(_userId: ID, draft: Draft<ActionPlan>, steps: PlanStepDraft[], goalIds: ID[] = []): Promise<ActionPlan> {
    return this.write(() => this.http.post<ActionPlan>('/v1/plans/with-steps', { plan: draft, steps, goalIds }))
  }

  addStep(_userId: ID, planId: ID, step: PlanStepDraft): Promise<EntityRef> {
    return this.write(() => this.http.post<EntityRef>(`/v1/plans/${enc(planId)}/steps`, typeof step === 'string' ? { title: step } : step))
  }

  setDueDate(_userId: ID, planId: ID, date: ISODate | undefined): Promise<{ plan: ActionPlan; moved: number }> {
    return this.write(() => this.http.put(`/v1/plans/${enc(planId)}/due-date`, { date: date ?? null }))
  }

  setStepDate(_userId: ID, ref: EntityRef, date: ISODate | undefined): Promise<void> {
    return this.write(() => this.http.put(`/v1/steps/${ref.kind}/${enc(ref.id)}/date`, { date: date ?? null }))
  }

  convertStep(_userId: ID, from: EntityRef, to: StepKind): Promise<EntityRef> {
    return this.write(() => this.http.post<EntityRef>(`/v1/steps/${from.kind}/${enc(from.id)}/convert`, { to }))
  }

  cover(_userId: ID, planId: ID, target: EntityRef): Promise<ActionPlan> {
    return this.write(() => this.http.post<ActionPlan>(`/v1/plans/${enc(planId)}/cover`, target))
  }

  uncover(_userId: ID, planId: ID, target: EntityRef): Promise<ActionPlan> {
    return this.write(() => this.http.post<ActionPlan>(`/v1/plans/${enc(planId)}/uncover`, target))
  }

  duplicate(_userId: ID, planId: ID): Promise<ActionPlan> {
    return this.write(() => this.http.post<ActionPlan>(`/v1/plans/${enc(planId)}/duplicate`))
  }

  saveDoc(_userId: ID, planId: ID, doc: RichDoc, firstEditOfSession: boolean): Promise<void> {
    return this.write(() => this.http.put(`/v1/plans/${enc(planId)}/doc`, { doc, firstEditOfSession }))
  }

  reorderSteps(_userId: ID, planId: ID, orderedIds: ID[]): Promise<void> {
    return this.write(() => this.http.put(`/v1/plans/${enc(planId)}/steps/order`, { orderedIds }))
  }

  link(_userId: ID, planId: ID, goalId: ID): Promise<void> {
    return this.write(() => this.http.put(`/v1/plans/${enc(planId)}/goals/${enc(goalId)}`))
  }

  unlink(_userId: ID, planId: ID, goalId: ID): Promise<void> {
    return this.write(() => this.http.delete(`/v1/plans/${enc(planId)}/goals/${enc(goalId)}`))
  }

  remove(_userId: ID, planId: ID): Promise<void> {
    return this.write(() => this.http.delete(`${PATHS.plan}/${enc(planId)}`))
  }
}

// --- cases and hearings -------------------------------------------------------------------------------------------

export class RemoteCases extends Remote {
  open(_userId: ID, draft: Omit<Draft<LegalCase>, 'reference'>): Promise<LegalCase> {
    return this.write(() => this.http.post<LegalCase>(PATHS.case, draft))
  }

  assignCounsel(_userId: ID, caseId: ID, engagement: Engagement | null): Promise<LegalCase> {
    return this.write(() => this.http.put<LegalCase>(`${PATHS.case}/${enc(caseId)}/engagement`, { engagement }))
  }

  recordHearing(_userId: ID, hearingId: ID, record: HearingRecord): Promise<HearingRecordResult> {
    return this.write(() => this.http.post<HearingRecordResult>(`${PATHS.hearing}/${enc(hearingId)}/record`, record))
  }

  saveHearing(_userId: ID, input: Hearing | Draft<Hearing>): Promise<HearingSaveResult> {
    const id = input.id ?? crypto.randomUUID()
    return this.write(() => this.http.put<HearingSaveResult>(`${PATHS.hearing}/${enc(id)}/listing`, input))
  }

  joinCases(_userId: ID, hearingId: ID, caseIds: ID[]): Promise<HearingSaveResult> {
    return this.write(() => this.http.put<HearingSaveResult>(`${PATHS.hearing}/${enc(hearingId)}/cases`, { caseIds }))
  }

  remove(_userId: ID, caseId: ID): Promise<void> {
    return this.write(() => this.http.delete(`${PATHS.case}/${enc(caseId)}`))
  }
}

export class RemoteHearingActions extends Remote {
  toTasks(_userId: ID, hearingId: ID): Promise<Hearing> {
    return this.write(() => this.http.post<Hearing>(`${PATHS.hearing}/${enc(hearingId)}/actions/tasks`))
  }

  toPlan(_userId: ID, hearingId: ID, title?: string): Promise<ActionPlan> {
    return this.write(() => this.http.post<ActionPlan>(`${PATHS.hearing}/${enc(hearingId)}/actions/plan`, { title }))
  }
}

/** Deleting counsel, clients… the server applies the knock-on rules (cases return to us, projects go too). */
export class RemoteRemover extends Remote {
  constructor(
    http: ApiHttp,
    bus: ChangeBus,
    private readonly path: string,
  ) {
    super(http, bus)
  }

  remove(_userId: ID, id: ID): Promise<void> {
    return this.write(() => this.http.delete(`${this.path}/${enc(id)}`))
  }
}

export class RemoteOutcomes extends Remote {
  execute(_userId: ID, ref: { kind: OutcomeTarget; id: ID }, outcome: Outcome, spawn?: SpawnRequest): Promise<{ spawned?: EntityRef }> {
    return this.write(async () => {
      const r = await this.http.post<{ spawned: EntityRef | null }>('/v1/outcomes', { ref, outcome, spawn })
      return r.spawned ? { spawned: r.spawned } : {}
    })
  }
}

// --- agenda, links, attachments ------------------------------------------------------------------------------------

export class RemoteAgenda extends Remote {
  constructor(
    http: ApiHttp,
    bus: ChangeBus,
    private readonly crud: { [K in StoreKind]: RemoteCrud<K> },
  ) {
    super(http, bus)
  }

  async range(_userId: ID, from: ISODate, to: ISODate): Promise<AgendaEntry[]> {
    return (await this.http.get<{ items: AgendaEntry[] }>('/v1/agenda', { start: from, end: to })).items
  }

  /** Places an entry at a time on `date`, or clears its time (null). Returns the prior state. */
  schedule(_userId: ID, ref: EntityRef, date: ISODate, block: Block | null): Promise<AnyEntity> {
    return this.write(async () => (await this.http.put<{ before: AnyEntity }>('/v1/agenda/schedule', { ref, date, block })).before)
  }

  /** Re-flows the day (see packDay). Returns the prior state of everything that moved. */
  async reflow(userId: ID, date: ISODate, options: PackOptions): Promise<AnyEntity[]> {
    const placements = packDay(await this.range(userId, date, date), options)
    const before: AnyEntity[] = []
    for (const { entry, slot } of placements) before.push(await this.schedule(userId, entry.ref, date, slot))
    return before
  }

  /** Writes earlier snapshots back (undo). */
  async restore(_userId: ID, snapshots: AnyEntity[]): Promise<void> {
    for (const s of snapshots) await (this.crud[s.kind].update as (e: typeof s.entity) => Promise<unknown>)(s.entity)
  }
}

export class RemoteLinks extends Remote {
  link(_userId: ID, a: EntityRef, b: EntityRef, titles: { a: string; b: string }, note?: string): Promise<Link> {
    return this.write(() => this.http.post<Link>('/v1/links', { a, b, titles, note }))
  }

  unlink(_userId: ID, linkId: ID, titles: { a: string; b: string }): Promise<void> {
    return this.write(() => this.http.delete(`/v1/links/${enc(linkId)}`, { titleA: titles.a, titleB: titles.b }))
  }

  addNote(_userId: ID, ref: EntityRef, title: string, text: string): Promise<void> {
    return this.write(() => this.http.post('/v1/activity/notes', { ref, title, text }))
  }
}

export class RemoteAttachments extends Remote {
  attach(_userId: ID, owner: EntityRef, ownerTitle: string, file: File, onProgress?: (fraction: number) => void): Promise<Attachment> {
    if (file.size === 0) throw new ValidationError(`“${file.name}” is empty`)
    if (file.size > MAX_ATTACHMENT_BYTES) throw new ValidationError(`“${file.name}” is larger than the ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB limit`)
    const form = new FormData()
    form.set('file', file, file.name)
    form.set('ownerKind', owner.kind)
    form.set('ownerId', owner.id)
    form.set('ownerTitle', ownerTitle)
    return this.write(() => this.http.upload<Attachment>('/v1/attachments', form, onProgress))
  }

  /** Attaches a document that lives elsewhere (a Google Doc, a shared PDF…): nothing is stored, the link is. */
  attachLink(_userId: ID, owner: EntityRef, ownerTitle: string, address: string, name?: string): Promise<Attachment> {
    return this.write(() => this.http.post<Attachment>('/v1/attachments/links', { owner, ownerTitle, url: address, name }))
  }

  remove(_userId: ID, attachment: Attachment, ownerTitle: string): Promise<void> {
    return this.write(() => this.http.delete(`/v1/attachments/${enc(attachment.id)}`, { ownerTitle }))
  }

  rename(attachment: Attachment, caption: string): Promise<Attachment> {
    return this.write(() => this.http.patch<Attachment>(`/v1/attachments/${enc(attachment.id)}`, { caption }))
  }

  /** An address the browser can show or download: a link's own, or a short-lived one for a stored file. */
  async url(attachment: Attachment): Promise<string> {
    if (attachment.link) return attachment.link.url
    const { url } = await this.http.post<{ url: string }>(`/v1/attachments/${enc(attachment.id)}/url`)
    return this.http.url(url)
  }
}
