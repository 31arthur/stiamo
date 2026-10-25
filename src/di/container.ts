import { seedDemoData } from '@/data/seed/demoSeed'
import { AgendaUseCases } from '@/domain/agenda/AgendaUseCases'
import { GetCurrentUserUseCase } from '@/domain/auth/usecases/GetCurrentUserUseCase'
import { LoginUseCase } from '@/domain/auth/usecases/LoginUseCase'
import { LogoutUseCase } from '@/domain/auth/usecases/LogoutUseCase'
import { RegisterUseCase, ResetPasswordUseCase } from '@/domain/auth/usecases/RegisterUseCase'
import { ActivityLog } from '@/domain/activity/ActivityLog'
import { AttachmentUseCases } from '@/domain/attachments/AttachmentUseCases'
import { CaseUseCases } from '@/domain/cases/CaseUseCases'
import { MeetingUseCases } from '@/domain/meetings/MeetingUseCases'
import { PlanUseCases } from '@/domain/plans/PlanUseCases'
import { LinkUseCases } from '@/domain/relations/LinkUseCases'
import { CrudUseCases } from '@/domain/shared/CrudUseCases'
import { RecordOutcomeUseCase } from '@/domain/shared/RecordOutcomeUseCase'
import type { DomainEnv, EntityMap, StoreKind } from '@/domain/shared/registry'
import type { ID } from '@/domain/shared/types'
import {
  normalizeCase,
  normalizeFollowUp,
  normalizeGoal,
  normalizeHearing,
  normalizeMeeting,
  normalizePlan,
  normalizeTask,
} from '@/domain/shared/validation'
import type { Backend } from './backends'

/** Composition root: the only place concrete data implementations are wired to domain use cases. */
export function createContainer(backend: Backend) {
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
    link: new CrudUseCases('link', env),
    activity: new CrudUseCases('activity', env),
    attachment: new CrudUseCases('attachment', env),
  }
  const meetings = new MeetingUseCases(env, crud.meeting, crud.followUp)
  const plans = new PlanUseCases(env, crud.plan, crud.task, crud.goal, log)
  const cases = new CaseUseCases(env, crud.case, crud.hearing, plans)
  const outcomes = new RecordOutcomeUseCase(env, crud.task, crud.followUp, meetings, log)
  const agenda = new AgendaUseCases(env, meetings, log)
  const links = new LinkUseCases(env, log)
  const attachments = new AttachmentUseCases(env, backend.files, log)

  const container = {
    backend: backend.kind,
    auth: {
      login: new LoginUseCase(backend.auth),
      register: new RegisterUseCase(backend.auth),
      resetPassword: new ResetPasswordUseCase(backend.auth),
      logout: new LogoutUseCase(backend.auth),
      getCurrentUser: new GetCurrentUserUseCase(backend.auth),
      onChange: (listener: Parameters<Backend['auth']['onChange']>[0]) => backend.auth.onChange(listener),
    },
    crud,
    meetings,
    plans,
    cases,
    outcomes,
    agenda,
    links,
    attachments,
    /** Live views of each collection, updated on every change from any device. */
    live: {
      subscribe: <K extends StoreKind>(kind: K, userId: ID, listener: (items: EntityMap[K][]) => void, onError?: (e: Error) => void) =>
        (backend.repos[kind].subscribe as (u: ID, l: (items: EntityMap[K][]) => void, e?: (e: Error) => void) => () => void)(userId, listener, onError),
    },
    /** Fills the given account with a realistic sample practice. */
    seedSampleData: (userId: ID) => seedDemoData(container, userId, backend.clock.now()),
    /** Resolves once first-run demo data is in place. */
    ready: Promise.resolve(),
  }

  const auto = backend.autoSeed
  if (auto && !auto.isDone()) {
    container.ready = seedDemoData(container, auto.userId, backend.clock.now()).then(auto.markDone)
  }
  return container
}

export type Container = ReturnType<typeof createContainer>
