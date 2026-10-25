import type { FirebaseOptions } from 'firebase/app'
import { DEMO_ACCOUNT, LocalAuthRepository } from '@/data/auth/LocalAuthRepository'
import { FirebaseAuthRepository } from '@/data/firebase/FirebaseAuthRepository'
import { initFirebase } from '@/data/firebase/firebaseApp'
import { FirestoreRepository } from '@/data/firebase/FirestoreRepository'
import { createLocalRepositories, SEEDED_KEY } from '@/data/storage/localRepositories'
import { systemClock, uuidGenerator } from '@/data/storage/system'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'
import type { Clock, IdGenerator } from '@/domain/shared/Repository'
import type { Repositories } from '@/domain/shared/registry'
import type { ID } from '@/domain/shared/types'

/** Everything that differs between running online (Firebase) and offline (browser storage). */
export interface Backend {
  kind: 'firebase' | 'local'
  auth: AuthRepository
  repos: Repositories
  clock: Clock
  ids: IdGenerator
  /** Offline demo: seed this user's sample data once on start-up. */
  autoSeed?: { userId: ID; isDone: () => boolean; markDone: () => void }
}

export function localBackend(storage: Storage = localStorage): Backend {
  return {
    kind: 'local',
    auth: new LocalAuthRepository(storage),
    repos: createLocalRepositories(storage),
    clock: systemClock,
    ids: uuidGenerator,
    autoSeed: {
      userId: DEMO_ACCOUNT.id,
      isDone: () => storage.getItem(SEEDED_KEY) !== null,
      markDone: () => storage.setItem(SEEDED_KEY, '1'),
    },
  }
}

export const COLLECTIONS: Record<keyof Repositories, string> = {
  task: 'tasks',
  meeting: 'meetings',
  followUp: 'followUps',
  case: 'cases',
  hearing: 'hearings',
  plan: 'plans',
  goal: 'goals',
}

export function firebaseBackend(config: FirebaseOptions): Backend {
  const { auth, db } = initFirebase(config)
  const repo = <K extends keyof Repositories>(k: K) => new FirestoreRepository(db, COLLECTIONS[k]) as unknown as Repositories[K]
  return {
    kind: 'firebase',
    auth: new FirebaseAuthRepository(auth),
    repos: {
      task: repo('task'),
      meeting: repo('meeting'),
      followUp: repo('followUp'),
      case: repo('case'),
      hearing: repo('hearing'),
      plan: repo('plan'),
      goal: repo('goal'),
    },
    clock: systemClock,
    ids: uuidGenerator,
  }
}
