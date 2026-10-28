import { seedDemoData } from '@/data/seed/demoSeed'
import { AgendaUseCases } from '@/domain/agenda/AgendaUseCases'
import { GetCurrentUserUseCase } from '@/domain/auth/usecases/GetCurrentUserUseCase'
import { LoginUseCase } from '@/domain/auth/usecases/LoginUseCase'
import { LogoutUseCase } from '@/domain/auth/usecases/LogoutUseCase'
import { RegisterUseCase, ResetPasswordUseCase } from '@/domain/auth/usecases/RegisterUseCase'
import { ActivityLog } from '@/domain/activity/ActivityLog'
import { AttachmentUseCases } from '@/domain/attachments/AttachmentUseCases'
import { ValidationError } from '@/domain/auth/errors'
import { CaseUseCases } from '@/domain/cases/CaseUseCases'
import { ClientUseCases } from '@/domain/clients/ClientUseCases'
import { HearingActionUseCases } from '@/domain/cases/HearingActionUseCases'
import { FollowUpUseCases } from '@/domain/followups/FollowUpUseCases'
import { CounselUseCases } from '@/domain/counsel/CounselUseCases'
import { MeetingUseCases } from '@/domain/meetings/MeetingUseCases'
import { PlanUseCases } from '@/domain/plans/PlanUseCases'
import { LinkUseCases } from '@/domain/relations/LinkUseCases'
import { CrudUseCases } from '@/domain/shared/CrudUseCases'
import { RecordOutcomeUseCase } from '@/domain/shared/RecordOutcomeUseCase'
import type { DomainEnv, EntityMap, StoreKind } from '@/domain/shared/registry'
import type { Draft, ID } from '@/domain/shared/types'
import {
  normalizeCase,
  normalizeClient,
  normalizeCounsel,
  normalizeFollowUp,
  normalizeGoal,
  normalizeHearing,
  normalizeMeeting,
  normalizePlan,
  normalizeProject,
  normalizeTask,
} from '@/domain/shared/validation'
import type { Backend } from './backends'

/** What every screen can do with a collection. Offline it runs in the browser; online it is the backend's API. */
export interface CrudApi<K extends StoreKind> {
  list(userId: ID): Promise<EntityMap[K][]>
  get(userId: ID, id: ID): Promise<EntityMap[K] | null>
  create(userId: ID, draft: Draft<EntityMap[K]>): Promise<EntityMap[K]>
  update(entity: EntityMap[K]): Promise<EntityMap[K]>
  remove(userId: ID, id: ID): Promise<void>
}

/**
 * The surface the screens depend on. `createContainer` builds it from use cases that run in the browser (offline,
 * Supabase); `createApiContainer` builds it from calls to the Stiamo backend, which runs the same rules on the server.
 */
export interface Container {
  backend: 'local' | 'supabase' | 'api'
  allowSignUp: boolean
  auth: {
    login: Pick<LoginUseCase, 'execute'>
    register: Pick<RegisterUseCase, 'execute'>
    resetPassword: Pick<ResetPasswordUseCase, 'execute'>
    logout: Pick<LogoutUseCase, 'execute'>
    getCurrentUser: Pick<GetCurrentUserUseCase, 'execute'>
    onChange: (listener: Parameters<Backend['auth']['onChange']>[0]) => () => void
  }
  crud: { [K in StoreKind]: CrudApi<K> }
  meetings: Pick<MeetingUseCases, 'save' | 'remove'>
  followUps: Pick<FollowUpUseCases, 'suggest' | 'logAttempt' | 'restore'>
  plans: Pick<
    PlanUseCases,
    'createWithSteps' | 'addStep' | 'setDueDate' | 'setStepDate' | 'convertStep' | 'cover' | 'uncover' | 'duplicate' | 'saveDoc' | 'reorderSteps' | 'link' | 'unlink' | 'remove'
  >
  cases: Pick<CaseUseCases, 'open' | 'assignCounsel' | 'recordHearing' | 'saveHearing' | 'joinCases' | 'remove'>
  counsel: Pick<CounselUseCases, 'remove'>
  clients: Pick<ClientUseCases, 'remove'>
  hearingActions: Pick<HearingActionUseCases, 'toTasks' | 'toPlan'>
  outcomes: Pick<RecordOutcomeUseCase, 'execute'>
  agenda: Pick<AgendaUseCases, 'range' | 'schedule' | 'reflow' | 'restore'>
  links: Pick<LinkUseCases, 'link' | 'unlink' | 'addNote'>
  attachments: Pick<AttachmentUseCases, 'attach' | 'attachLink' | 'remove' | 'rename' | 'url'>
  /** Live views of each collection, updated on every change from any device. */
  live: {
    subscribe: <K extends StoreKind>(kind: K, userId: ID, listener: (items: EntityMap[K][]) => void, onError?: (e: Error) => void) => () => void
  }
  /** Fills the given account with a realistic sample practice. */
  seedSampleData: (userId: ID) => Promise<void>
  /** Resolves once first-run data is in place. */
  ready: Promise<void>
}

/** Composition root: the only place concrete data implementations are wired to domain use cases. */
export function createContainer(backend: Backend): Container {
  const env: DomainEnv = { repos: backend.repos, clock: backend.clock, ids: backend.ids }

  const log = new ActivityLog(env)
  const crud = {
    task: new CrudUseCases('task', env, normalizeTask, log),
    meeting: new CrudUseCases('meeting', env, normalizeMeeting, log),
    followUp: new CrudUseCases('followUp', env, normalizeFollowUp, log),
    case: new CrudUseCases('case', env, normalizeCase, log),
    hearing: new CrudUseCases('hearing', env, normalizeHearing, log),
    plan: new CrudUseCases('plan', env, normalizePlan, log),
    goal: new CrudUseCases('goal', env, normalizeGoal, log),
    counsel: new CrudUseCases('counsel', env, normalizeCounsel, log),
    client: new CrudUseCases('client', env, normalizeClient, log),
    project: new CrudUseCases('project', env, normalizeProject, log),
    link: new CrudUseCases('link', env),
    activity: new CrudUseCases('activity', env),
    attachment: new CrudUseCases('attachment', env),
  }
  const meetings = new MeetingUseCases(env, crud.meeting, crud.followUp)
  const followUps = new FollowUpUseCases(env, crud.followUp)
  const plans = new PlanUseCases(env, crud.plan, crud.task, crud.followUp, meetings, crud.goal, log)
  const cases = new CaseUseCases(env, crud.case, crud.hearing, plans, log)
  const hearingActions = new HearingActionUseCases(env, crud.hearing, crud.task, plans)
  const counsel = new CounselUseCases(env, crud.counsel, crud.case, log)
  const clients = new ClientUseCases(env, crud.client, crud.project)
  const outcomes = new RecordOutcomeUseCase(env, crud.task, crud.followUp, meetings, log)
  const agenda = new AgendaUseCases(env, meetings, log)
  const links = new LinkUseCases(env, log)
  const attachments = new AttachmentUseCases(env, backend.files, log)

  const container = {
    backend: backend.kind,
    allowSignUp: backend.allowSignUp,
    auth: {
      login: new LoginUseCase(backend.auth),
      register: backend.allowSignUp ? new RegisterUseCase(backend.auth) : { execute: () => Promise.reject(new ValidationError('Account creation is turned off. Ask the owner to add you.')) },
      resetPassword: new ResetPasswordUseCase(backend.auth),
      logout: new LogoutUseCase(backend.auth),
      getCurrentUser: new GetCurrentUserUseCase(backend.auth),
      onChange: (listener: Parameters<Backend['auth']['onChange']>[0]) => backend.auth.onChange(listener),
    },
    crud,
    meetings,
    followUps,
    plans,
    cases,
    counsel,
    clients,
    hearingActions,
    outcomes,
    agenda,
    links,
    attachments,
    live: {
      subscribe: <K extends StoreKind>(kind: K, userId: ID, listener: (items: EntityMap[K][]) => void, onError?: (e: Error) => void) =>
        (backend.repos[kind].subscribe as (u: ID, l: (items: EntityMap[K][]) => void, e?: (e: Error) => void) => () => void)(userId, listener, onError),
    },
    seedSampleData: (userId: ID) => seedDemoData(container, userId, backend.clock.now()),
    ready: Promise.resolve(),
  }

  const auto = backend.autoSeed
  if (auto && !auto.isDone()) {
    container.ready = seedDemoData(container, auto.userId, backend.clock.now()).then(auto.markDone)
  }
  return container
}

