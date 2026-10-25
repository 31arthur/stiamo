import { LocalAuthRepository, DEMO_ACCOUNT } from '@/data/auth/LocalAuthRepository'
import { seedDemoData } from '@/data/seed/demoSeed'
import { createLocalRepositories, SEEDED_KEY } from '@/data/storage/localRepositories'
import { systemClock, uuidGenerator } from '@/data/storage/system'
import { AgendaUseCases } from '@/domain/agenda/AgendaUseCases'
import { GetCurrentUserUseCase } from '@/domain/auth/usecases/GetCurrentUserUseCase'
import { LoginUseCase } from '@/domain/auth/usecases/LoginUseCase'
import { LogoutUseCase } from '@/domain/auth/usecases/LogoutUseCase'
import { CaseUseCases } from '@/domain/cases/CaseUseCases'
import { MeetingUseCases } from '@/domain/meetings/MeetingUseCases'
import { PlanUseCases } from '@/domain/plans/PlanUseCases'
import { CrudUseCases } from '@/domain/shared/CrudUseCases'
import { RecordOutcomeUseCase } from '@/domain/shared/RecordOutcomeUseCase'
import type { DomainEnv } from '@/domain/shared/registry'
import {
  normalizeCase,
  normalizeFollowUp,
  normalizeGoal,
  normalizeHearing,
  normalizeMeeting,
  normalizePlan,
  normalizeTask,
} from '@/domain/shared/validation'

/** Composition root: the only place concrete data implementations are wired to domain use cases. */
export function createContainer(storage: Storage = localStorage) {
  const authRepository = new LocalAuthRepository(storage)
  const env: DomainEnv = { repos: createLocalRepositories(storage), clock: systemClock, ids: uuidGenerator }

  const crud = {
    task: new CrudUseCases('task', env, normalizeTask),
    meeting: new CrudUseCases('meeting', env, normalizeMeeting),
    followUp: new CrudUseCases('followUp', env, normalizeFollowUp),
    case: new CrudUseCases('case', env, normalizeCase),
    hearing: new CrudUseCases('hearing', env, normalizeHearing),
    plan: new CrudUseCases('plan', env, normalizePlan),
    goal: new CrudUseCases('goal', env, normalizeGoal),
  }
  const meetings = new MeetingUseCases(env, crud.meeting, crud.followUp)
  const plans = new PlanUseCases(env, crud.plan, crud.task, crud.goal)
  const cases = new CaseUseCases(env, crud.case, crud.hearing, plans)
  const outcomes = new RecordOutcomeUseCase(env, crud.task, crud.followUp, meetings)
  const agenda = new AgendaUseCases(env, meetings)

  const container = {
    auth: {
      login: new LoginUseCase(authRepository),
      logout: new LogoutUseCase(authRepository),
      getCurrentUser: new GetCurrentUserUseCase(authRepository),
    },
    crud,
    meetings,
    plans,
    cases,
    outcomes,
    agenda,
    /** Resolves once first-run demo data is in place. */
    ready: Promise.resolve(),
  }

  if (storage.getItem(SEEDED_KEY) === null) {
    container.ready = seedDemoData(container, DEMO_ACCOUNT.id, new Date()).then(() => storage.setItem(SEEDED_KEY, '1'))
  }
  return container
}

export type Container = ReturnType<typeof createContainer>
