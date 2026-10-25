import type { Entity, EntityRef, ISODateTime } from '../shared/types'

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'outcome'
  | 'scheduled'
  | 'deleted'
  | 'linked'
  | 'unlinked'
  | 'attached'
  | 'detached'
  | 'note'

export interface FieldChange {
  field: string
  from?: string
  to?: string
}

/**
 * One line of a record's history. Written automatically whenever a record is created, changed,
 * scheduled, linked or given an outcome — and by hand as notes — so every thread has a full trail.
 */
export interface Activity extends Entity {
  at: ISODateTime
  ref: EntityRef
  /** The record's title at the time, so history reads well even after renames or deletion. */
  title: string
  action: ActivityAction
  summary: string
  changes?: FieldChange[]
  /** The other record involved (the parent it was created under, the record it was linked to…). */
  related?: EntityRef
}
