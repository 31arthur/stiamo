import type { FirebaseOptions } from 'firebase/app'
import { FirebaseFileStore } from '@/data/files/FirebaseFileStore'
import { FirebaseAuthRepository } from '@/data/firebase/FirebaseAuthRepository'
import { initFirebase } from '@/data/firebase/firebaseApp'
import { FirestoreRepository } from '@/data/firebase/FirestoreRepository'
import { systemClock, uuidGenerator } from '@/data/storage/system'
import type { Repositories } from '@/domain/shared/registry'
import type { Backend } from './backends'

// Kept apart from backends.ts so the Firebase SDK loads as its own chunk, only when configured.
export const COLLECTIONS: Record<keyof Repositories, string> = {
  task: 'tasks',
  meeting: 'meetings',
  followUp: 'followUps',
  case: 'cases',
  hearing: 'hearings',
  plan: 'plans',
  goal: 'goals',
  link: 'links',
  activity: 'activity',
  attachment: 'attachments',
}

export function firebaseBackend(config: FirebaseOptions): Backend {
  const { auth, db, storage } = initFirebase(config)
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
      link: repo('link'),
      activity: repo('activity'),
      attachment: repo('attachment'),
    },
    files: new FirebaseFileStore(storage, db),
    clock: systemClock,
    ids: uuidGenerator,
  }
}
