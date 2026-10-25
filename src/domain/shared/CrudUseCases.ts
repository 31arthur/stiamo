import type { DomainEnv, EntityMap } from './registry'
import type { Draft, EntityKind, ID } from './types'

/** Validates and normalises a draft before it's stored; throws ValidationError on bad input. */
export type Normalizer<T> = (draft: T) => T

/** List/get/create/update/remove for one aggregate, with validation and system fields handled. */
export class CrudUseCases<K extends EntityKind> {
  private readonly normalize: Normalizer<Draft<EntityMap[K]>>

  constructor(
    private readonly kind: K,
    private readonly env: DomainEnv,
    normalize?: Normalizer<Draft<EntityMap[K]>>,
  ) {
    this.normalize = normalize ?? ((d) => d)
  }

  private get repo() {
    return this.env.repos[this.kind]
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
    return this.repo.save(entity)
  }

  async update(entity: EntityMap[K]): Promise<EntityMap[K]> {
    const { id, userId, createdAt } = entity
    const normalized = this.normalize(entity as Draft<EntityMap[K]>)
    return this.repo.save({ ...normalized, id, userId, createdAt, updatedAt: this.env.clock.now().toISOString() } as EntityMap[K])
  }

  remove(userId: ID, id: ID): Promise<void> {
    return this.repo.remove(userId, id)
  }
}
