import { DEMO_ACCOUNT, LocalAuthRepository } from '@/data/auth/LocalAuthRepository'
import { createLocalRepositories, SEEDED_KEY } from '@/data/storage/localRepositories'
import { systemClock, uuidGenerator } from '@/data/storage/system'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'
import type { FileStore } from '@/domain/attachments/Attachment'
import { LocalFileStore } from '@/data/files/LocalFileStore'
import { signUpEnabled } from './flags'
import type { Clock, IdGenerator } from '@/domain/shared/Repository'
import type { Repositories } from '@/domain/shared/registry'
import type { ID } from '@/domain/shared/types'

/** Everything that differs between running online (Supabase) and offline (browser storage). */
export interface Backend {
  kind: 'supabase' | 'local'
  auth: AuthRepository
  repos: Repositories
  clock: Clock
  ids: IdGenerator
  files: FileStore
  /** Show account creation. See flags.ts. */
  allowSignUp: boolean
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
    files: new LocalFileStore(),
    allowSignUp: signUpEnabled(),
    autoSeed: {
      userId: DEMO_ACCOUNT.id,
      isDone: () => storage.getItem(SEEDED_KEY) !== null,
      markDone: () => storage.setItem(SEEDED_KEY, '1'),
    },
  }
}
