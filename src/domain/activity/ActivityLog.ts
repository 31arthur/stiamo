import type { DomainEnv, EntityMap } from '../shared/registry'
import type { EntityKind, EntityRef, ID } from '../shared/types'
import type { Activity, ActivityAction, FieldChange } from './Activity'
import { diff, KIND_LABEL, parentOf, summarize, titleOf } from './describe'

type Records = Pick<EntityMap, EntityKind>

/** Appends to the history every record carries. Writing history never blocks the change itself. */
export class ActivityLog {
  constructor(private readonly env: DomainEnv) {}

  async record(userId: ID, entry: { ref: EntityRef; title: string; action: ActivityAction; summary: string; changes?: FieldChange[]; related?: EntityRef }): Promise<void> {
    const now = this.env.clock.now().toISOString()
    const activity: Activity = { ...entry, id: this.env.ids.next(), userId, at: now, createdAt: now, updatedAt: now }
    try {
      await this.env.repos.activity.save(activity)
    } catch {
      // History is best-effort; the user's change already succeeded.
    }
  }

  created<K extends EntityKind>(userId: ID, kind: K, entity: Records[K]) {
    const parent = parentOf(kind, entity)
    return this.record(userId, {
      ref: { kind, id: entity.id },
      title: titleOf(kind, entity),
      action: 'created',
      summary: `${KIND_LABEL[kind]} created`,
      related: parent,
    })
  }

  /** Logs what changed between two versions; does nothing if nothing meaningful changed. */
  async changed<K extends EntityKind>(userId: ID, kind: K, before: Records[K], after: Records[K]) {
    const { action, changes } = diff(kind, before, after)
    if (!changes.length) return
    await this.record(userId, { ref: { kind, id: after.id }, title: titleOf(kind, after), action, summary: summarize(action, changes), changes })
  }

  deleted<K extends EntityKind>(userId: ID, kind: K, entity: Records[K]) {
    return this.record(userId, { ref: { kind, id: entity.id }, title: titleOf(kind, entity), action: 'deleted', summary: `${KIND_LABEL[kind]} deleted`, related: parentOf(kind, entity) })
  }
}

export const RECORD_KINDS: EntityKind[] = ['task', 'meeting', 'followUp', 'case', 'hearing', 'plan', 'goal', 'counsel']
export const isRecordKind = (k: string): k is EntityKind => (RECORD_KINDS as string[]).includes(k)
