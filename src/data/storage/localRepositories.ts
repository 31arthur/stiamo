import type { Repositories } from '@/domain/shared/registry'
import { LocalRepository } from './LocalRepository'

const PREFIX = 'stiamo.v2'

/** Storage keys from the first data model; removed on start-up. */
const LEGACY_KEYS = ['stiamo.calendar-items', 'stiamo.seeded']

export function createLocalRepositories(storage: Storage = localStorage): Repositories {
  for (const key of LEGACY_KEYS) storage.removeItem(key)
  return {
    task: new LocalRepository(`${PREFIX}.tasks`, storage),
    meeting: new LocalRepository(`${PREFIX}.meetings`, storage),
    followUp: new LocalRepository(`${PREFIX}.follow-ups`, storage),
    case: new LocalRepository(`${PREFIX}.cases`, storage),
    hearing: new LocalRepository(`${PREFIX}.hearings`, storage),
    plan: new LocalRepository(`${PREFIX}.plans`, storage),
    goal: new LocalRepository(`${PREFIX}.goals`, storage),
    link: new LocalRepository(`${PREFIX}.links`, storage),
    activity: new LocalRepository(`${PREFIX}.activity`, storage),
  }
}

export const SEEDED_KEY = `${PREFIX}.seeded`
