import type { ActivityLog } from '../activity/ActivityLog'
import { isRecordKind } from '../activity/ActivityLog'
import { linkTouches } from '../relations/Link'
import type { DomainEnv, EntityMap, StoreKind } from './registry'
import type { Draft, EntityKind, ID } from './types'

/** Validates and normalises a draft before it's stored; throws ValidationError on bad input. */
export type Normalizer<T> = (draft: T) => T

type RecordOf<K extends StoreKind> = K extends EntityKind ? EntityMap[K] : never

/**
 * List/get/create/update/remove for one aggregate, with validation and system fields handled.
 * Every change to a record is written to its history; deleting a record also removes its links.
 */
export class CrudUseCases<K extends StoreKind> {
  private readonly normalize: Normalizer<Draft<EntityMap[K]>>

  constructor(
    private readonly kind: K,
    private readonly env: DomainEnv,
    normalize?: Normalizer<Draft<EntityMap[K]>>,
    private readonly log?: ActivityLog,
  ) {
    this.normalize = normalize ?? ((d) => d)
  }

  private get repo() {
    return this.env.repos[this.kind]
  }

  private get history() {
    return this.log && isRecordKind(this.kind) ? { log: this.log, kind: this.kind as EntityKind } : null
  }

  list(userId: ID): Promise<EntityMap[K][]> {
    return this.repo.list(userId)
  }

  get(userId: ID, id: ID): Promise<EntityMap[K] | null> {
    return this.repo.get(userId, id)
  }

  async create(userId: ID, draft: Draft<EntityMap[K]>): Promise<EntityMap[K]> {
    const now = this.env.clock.now().toISOString()
    const entity = {
      ...this.normalize(draft),
      id: draft.id ?? this.env.ids.next(),
      userId,
      createdAt: now,
      updatedAt: now,
    } as EntityMap[K]
    const saved = await this.repo.save(entity)
    const h = this.history
    if (h) await h.log.created(userId, h.kind, saved as RecordOf<K>)
    return saved
  }

  async update(entity: EntityMap[K]): Promise<EntityMap[K]> {
    const { id, userId, createdAt } = entity
    const h = this.history
    const before = h ? await this.repo.get(userId, id) : null
    const normalized = this.normalize(entity as Draft<EntityMap[K]>)
    const saved = await this.repo.save({ ...normalized, id, userId, createdAt, updatedAt: this.env.clock.now().toISOString() } as EntityMap[K])
    if (h && before) await h.log.changed(userId, h.kind, before as RecordOf<K>, saved as RecordOf<K>)
    return saved
  }

  async remove(userId: ID, id: ID): Promise<void> {
    const h = this.history
    const before = h ? await this.repo.get(userId, id) : null
    await this.repo.remove(userId, id)
    if (h) {
      const ref = { kind: h.kind, id }
      for (const link of await this.env.repos.link.list(userId)) if (linkTouches(link, ref)) await this.env.repos.link.remove(userId, link.id)
      if (before) await h.log.deleted(userId, h.kind, before as RecordOf<K>)
    }
  }
}
