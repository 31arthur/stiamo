import type { Entity, ID } from './types'

/** Persistence port for one aggregate. Implementations live in the data layer. */
export interface Repository<T extends Entity> {
  list(userId: ID): Promise<T[]>
  get(userId: ID, id: ID): Promise<T | null>
  save(entity: T): Promise<T>
  saveMany(entities: T[]): Promise<void>
  remove(userId: ID, id: ID): Promise<void>
  /**
   * Live view of the user's records: called with the full list now and after every change,
   * including changes made on other devices. Returns an unsubscribe function.
   */
  subscribe(userId: ID, listener: (items: T[]) => void, onError?: (error: Error) => void): () => void
}

/** Supplies ids and timestamps so domain logic stays deterministic under test. */
export interface Clock {
  now(): Date
}

export interface IdGenerator {
  next(): ID
}
