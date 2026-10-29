import { ApiAuthRepository } from '@/data/api/ApiAuthRepository'
import { ApiHttp } from '@/data/api/ApiHttp'
import { RemoteDrive } from '@/data/api/RemoteDrive'
import type { ApiConfig } from '@/data/api/config'
import { ChangeBus } from '@/data/api/ChangeBus'
import { PATHS } from '@/data/api/ApiRepository'
import {
  RemoteAgenda,
  RemoteAttachments,
  RemoteCases,
  RemoteCrud,
  RemoteFollowUps,
  RemoteHearingActions,
  RemoteLinks,
  RemoteMeetings,
  RemoteOutcomes,
  RemotePlans,
  RemoteRemover,
} from '@/data/api/RemoteUseCases'
import { BrowserSessionStore, purgeLegacySessions } from '@/data/api/session'
import type { SessionStore } from '@/data/api/session'
import { ValidationError } from '@/domain/auth/errors'
import { GetCurrentUserUseCase } from '@/domain/auth/usecases/GetCurrentUserUseCase'
import { LoginUseCase } from '@/domain/auth/usecases/LoginUseCase'
import { LogoutUseCase } from '@/domain/auth/usecases/LogoutUseCase'
import { RegisterUseCase, ResetPasswordUseCase } from '@/domain/auth/usecases/RegisterUseCase'
import type { EntityMap, StoreKind } from '@/domain/shared/registry'
import type { ID } from '@/domain/shared/types'
import type { Container } from './container'
import { signUpEnabled } from './flags'

/**
 * The container for running against the Stiamo backend. Sign-in, the tokens and every rule live behind one
 * address; the browser keeps the session (an access token that lasts minutes, and a refresh token that renews it).
 */
export function createApiContainer(config: ApiConfig, options: { sessions?: SessionStore; storage?: Storage } = {}): Container {
  const storage = options.storage ?? localStorage
  purgeLegacySessions(storage)
  const sessions = options.sessions ?? new BrowserSessionStore(storage)
  const http = new ApiHttp(config.baseUrl, sessions)
  const bus = new ChangeBus()
  const auth = new ApiAuthRepository(http, sessions)
  const allowSignUp = signUpEnabled()

  // History, links and attachments are changed through their own actions, so those collections are read-only here.
  const crud: { [K in StoreKind]: RemoteCrud<K> } = {
    task: new RemoteCrud(http, bus, 'task'),
    meeting: new RemoteCrud(http, bus, 'meeting'),
    followUp: new RemoteCrud(http, bus, 'followUp'),
    case: new RemoteCrud(http, bus, 'case'),
    hearing: new RemoteCrud(http, bus, 'hearing'),
    plan: new RemoteCrud(http, bus, 'plan'),
    goal: new RemoteCrud(http, bus, 'goal'),
    counsel: new RemoteCrud(http, bus, 'counsel'),
    client: new RemoteCrud(http, bus, 'client'),
    project: new RemoteCrud(http, bus, 'project'),
    link: new RemoteCrud(http, bus, 'link', false),
    activity: new RemoteCrud(http, bus, 'activity', false),
    attachment: new RemoteCrud(http, bus, 'attachment', false),
  }

  return {
    backend: 'api',
    allowSignUp,
    auth: {
      login: new LoginUseCase(auth),
      register: allowSignUp ? new RegisterUseCase(auth) : { execute: () => Promise.reject(new ValidationError('Account creation is turned off. Ask the owner to add you.')) },
      resetPassword: new ResetPasswordUseCase(auth),
      logout: new LogoutUseCase(auth),
      getCurrentUser: new GetCurrentUserUseCase(auth),
      onChange: (listener) => auth.onChange(listener),
    },
    crud,
    meetings: new RemoteMeetings(http, bus),
    followUps: new RemoteFollowUps(http, bus),
    plans: new RemotePlans(http, bus),
    cases: new RemoteCases(http, bus),
    counsel: new RemoteRemover(http, bus, PATHS.counsel),
    clients: new RemoteRemover(http, bus, PATHS.client),
    hearingActions: new RemoteHearingActions(http, bus),
    outcomes: new RemoteOutcomes(http, bus),
    agenda: new RemoteAgenda(http, bus, crud),
    links: new RemoteLinks(http, bus),
    attachments: new RemoteAttachments(http, bus),
    drive: new RemoteDrive(http),
    live: {
      subscribe: <K extends StoreKind>(kind: K, userId: ID, listener: (items: EntityMap[K][]) => void, onError?: (e: Error) => void) =>
        crud[kind].subscribe(userId, listener as never, onError),
    },
    seedSampleData: () => Promise.reject(new Error('Sample data is only for the offline demo.')),
    ready: Promise.resolve(),
  }
}
