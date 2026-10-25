import type { Repository } from '@/domain/shared/Repository'
import type { Entity, ID } from '@/domain/shared/types'

/**
 * A collection persisted as one JSON array in Web Storage, for offline/demo use and tests.
 * Values are copied on the way in and out; subscribers hear about writes from this tab and others.
 */
export class LocalRepository<T extends Entity> implements Repository<T> {
  private listeners = new Set<{ userId: ID; listener: (items: T[]) => void }>()

  constructor(
    private readonly key: string,
    private readonly storage: Storage = localStorage,
  ) {
    if (typeof window !== 'undefined' && storage === window.localStorage) {
      window.addEventListener('storage', (e) => e.key === this.key && this.notify())
    }
  }

  async list(userId: ID): Promise<T[]> {
    return this.readAll().filter((e) => e.userId === userId)
  }

  async get(userId: ID, id: ID): Promise<T | null> {
    return this.readAll().find((e) => e.id === id && e.userId === userId) ?? null
  }

  async save(entity: T): Promise<T> {
    this.upsert([entity])
    return structuredClone(entity)
  }

  async saveMany(entities: T[]): Promise<void> {
    if (entities.length) this.upsert(entities)
  }

  async remove(userId: ID, id: ID): Promise<void> {
    this.writeAll(this.readAll().filter((e) => !(e.id === id && e.userId === userId)))
  }

  subscribe(userId: ID, listener: (items: T[]) => void): () => void {
    const entry = { userId, listener }
    this.listeners.add(entry)
    queueMicrotask(() => this.listeners.has(entry) && listener(this.readAll().filter((e) => e.userId === userId)))
    return () => this.listeners.delete(entry)
  }

  private notify() {
    if (!this.listeners.size) return
    const all = this.readAll()
    for (const { userId, listener } of this.listeners) listener(all.filter((e) => e.userId === userId))
  }

  private upsert(entities: T[]) {
    const all = this.readAll()
    for (const entity of entities) {
      const clean = JSON.parse(JSON.stringify(entity)) as T
      const index = all.findIndex((e) => e.id === entity.id && e.userId === entity.userId)
      if (index === -1) all.push(clean)
      else all[index] = clean
    }
    this.writeAll(all)
  }

  private readAll(): T[] {
    try {
      const raw = this.storage.getItem(this.key)
      return raw ? (JSON.parse(raw) as T[]) : []
    } catch {
      return []
    }
  }

  private writeAll(items: T[]) {
    this.storage.setItem(this.key, JSON.stringify(items))
    this.notify()
  }
}
