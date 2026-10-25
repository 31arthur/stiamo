import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Repository } from '@/domain/shared/Repository'
import type { Entity, ID } from '@/domain/shared/types'
import { describeFirebaseError } from './errors'

const BATCH_LIMIT = 450

/**
 * One aggregate stored at `users/{uid}/{collection}/{id}`. Each user's data lives under their own
 * document so security rules can grant access by uid alone.
 */
export class FirestoreRepository<T extends Entity> implements Repository<T> {
  constructor(
    private readonly db: Firestore,
    private readonly collectionName: string,
  ) {}

  private col(userId: ID) {
    return collection(this.db, 'users', userId, this.collectionName)
  }

  async list(userId: ID): Promise<T[]> {
    return guard(async () => (await getDocs(this.col(userId))).docs.map((d) => d.data() as T))
  }

  async get(userId: ID, id: ID): Promise<T | null> {
    return guard(async () => {
      const snap = await getDoc(doc(this.col(userId), id))
      return snap.exists() ? (snap.data() as T) : null
    })
  }

  async save(entity: T): Promise<T> {
    await guard(() => setDoc(doc(this.col(entity.userId), entity.id), entity))
    return entity
  }

  async saveMany(entities: T[]): Promise<void> {
    for (let i = 0; i < entities.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db)
      for (const e of entities.slice(i, i + BATCH_LIMIT)) batch.set(doc(this.col(e.userId), e.id), e)
      await guard(() => batch.commit())
    }
  }

  async remove(userId: ID, id: ID): Promise<void> {
    await guard(() => deleteDoc(doc(this.col(userId), id)))
  }

  subscribe(userId: ID, listener: (items: T[]) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(
      this.col(userId),
      (snap) => listener(snap.docs.map((d) => d.data() as T)),
      (error) => onError?.(new Error(describeFirebaseError(error))),
    )
  }
}

async function guard<R>(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn()
  } catch (error) {
    throw new Error(describeFirebaseError(error))
  }
}
